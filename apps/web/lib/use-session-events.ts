'use client';
import { useEffect, useReducer, useState } from 'react';
import { api, ApiError, eventsUrl, type SessionEvent } from './api';
import { initialState, reduce } from './session-state';
import { permanentSessionError, shouldFallBack, SILENT_STREAM_MS, streamSilent } from './session-logic';

const TERMINAL = new Set(['COMPLETED', 'PARTIAL', 'FAILED']);
export type ConnectionStatus = 'connecting' | 'reconnecting' | 'live' | 'polling' | 'closed' | 'error';

/**
 * Subscribes to the session's SSE stream. The server replays stored events first, so a
 * reload or reconnect rebuilds the same state. Falls back to polling the session endpoint
 * (status and report id) when the browser closes the stream, after repeated errors, or when the
 * stream stays silent (a proxy that buffers it).
 */
export function useSessionEvents(id: string) {
  const [state, dispatch] = useReducer(reduce, initialState);
  const [connection, setConnection] = useState<ConnectionStatus>('connecting');

  useEffect(() => {
    dispatch({ type: 'reset' });
    setConnection('connecting');
    let errors = 0;
    let poll: ReturnType<typeof setInterval> | null = null;
    let disposed = false;
    let polling = false;
    let revision: string | null = null;
    let received = 0;
    const startedAt = Date.now();
    const es = new EventSource(eventsUrl(id), { withCredentials: true });
    es.onopen = () => { if (!disposed) { errors = 0; setConnection('live'); } };
    es.onmessage = (m) => {
      if (disposed) return;
      errors = 0;
      received++;
      const e = JSON.parse(m.data) as SessionEvent;
      dispatch(e);
      if (e.type === 'session.status' && TERMINAL.has(e.status)) {
        es.close();
        setConnection('closed');
      }
    };
    es.onerror = () => {
      if (disposed) return;
      setConnection('reconnecting');
      // EventSource retries transient errors itself, but gives up for good on a non-200 reply.
      if (shouldFallBack(es.readyState, ++errors)) fallBack();
    };
    const silence = setTimeout(() => { if (!disposed && streamSilent(received, Date.now() - startedAt)) fallBack(); }, SILENT_STREAM_MS);
    function fallBack() {
      if (poll) return;
      es.close();
      setConnection('polling');
      const refresh = async () => {
        if (disposed || polling) return;
        polling = true;
        try {
        const s = await api.getSessionStatus(id);
        if (disposed) return;
        if (s.revision !== revision) {
          const snapshot = await api.getEventSnapshot(id);
          if (disposed) return;
          snapshot.forEach(dispatch);
          revision = s.revision;
          // The replay may be newer than the status read that preceded it.
          // Never overwrite its terminal status with an older polling response.
          const latestStatus = snapshot.find((event) => event.type === 'session.status');
          if (latestStatus?.type === 'session.status' && TERMINAL.has(latestStatus.status)) {
            if (poll) clearInterval(poll);
            setConnection('closed');
            return;
          }
        }
        if (TERMINAL.has(s.status)) {
          if (poll) clearInterval(poll);
          setConnection('closed');
        }
        } catch (error) {
          if (!disposed && error instanceof ApiError && permanentSessionError(error.status)) {
            if (poll) clearInterval(poll);
            setConnection('error');
            dispatch({ id: 'connection:error', type: 'session.status', status: 'FAILED', error: error.message });
          }
        } finally { polling = false; }
      };
      poll = setInterval(() => void refresh(), 1500);
      void refresh();
    }
    return () => {
      disposed = true;
      clearTimeout(silence);
      es.close();
      if (poll) clearInterval(poll);
    };
  }, [id]);

  return { state, connection };
}
