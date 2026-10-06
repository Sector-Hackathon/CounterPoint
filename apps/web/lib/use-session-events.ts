'use client';
import { useEffect, useReducer, useState } from 'react';
import { api, eventsUrl, type SessionEvent } from './api';
import { initialState, reduce } from './session-state';
import { pollToEvents, shouldFallBack } from './session-logic';

const TERMINAL = new Set(['COMPLETED', 'PARTIAL', 'FAILED']);

/**
 * Subscribes to the session's SSE stream. The server replays stored events first, so a
 * reload or reconnect rebuilds the same state. Falls back to polling the session endpoint
 * (status and report id) when the browser closes the stream or after repeated errors.
 */
export function useSessionEvents(id: string) {
  const [state, dispatch] = useReducer(reduce, initialState);
  const [connection, setConnection] = useState<'live' | 'polling' | 'closed'>('live');

  useEffect(() => {
    dispatch({ type: 'reset' });
    setConnection('live');
    let errors = 0;
    let poll: ReturnType<typeof setInterval> | null = null;
    let disposed = false;
    let polling = false;
    const es = new EventSource(eventsUrl(id));
    es.onmessage = (m) => {
      if (disposed) return;
      errors = 0;
      const e = JSON.parse(m.data) as SessionEvent;
      dispatch(e);
      if (e.type === 'session.status' && TERMINAL.has(e.status)) {
        es.close();
        setConnection('closed');
      }
    };
    es.onerror = () => {
      // EventSource retries transient errors itself, but gives up for good on a non-200 reply.
      if (!shouldFallBack(es.readyState, ++errors)) return;
      if (poll) return;
      es.close();
      setConnection('polling');
      const refresh = async () => {
        if (disposed || polling) return;
        polling = true;
        try {
        const snapshot = await api.getEventSnapshot(id).catch(() => null);
        if (disposed) return;
        if (snapshot) {
          snapshot.forEach(dispatch);
          const status = snapshot.find((e) => e.type === 'session.status');
          if (status?.type === 'session.status' && TERMINAL.has(status.status)) {
            if (poll) clearInterval(poll);
            setConnection('closed');
          }
          return;
        }
        const s = await api.getSession(id).catch(() => null);
        if (!s || disposed) return;
        pollToEvents(s).forEach(dispatch);
        if (TERMINAL.has(s.status)) {
          if (poll) clearInterval(poll);
          setConnection('closed');
        }
        } finally { polling = false; }
      };
      poll = setInterval(() => void refresh(), 1500);
      void refresh();
    };
    return () => {
      disposed = true;
      es.close();
      if (poll) clearInterval(poll);
    };
  }, [id]);

  return { state, connection };
}
