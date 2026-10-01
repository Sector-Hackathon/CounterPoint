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
    let errors = 0;
    let poll: ReturnType<typeof setInterval> | null = null;
    const es = new EventSource(eventsUrl(id));
    es.onmessage = (m) => {
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
      es.close();
      setConnection('polling');
      poll = setInterval(async () => {
        const s = await api.getSession(id).catch(() => null);
        if (!s) return;
        pollToEvents(s).forEach(dispatch);
        if (TERMINAL.has(s.status) && poll) clearInterval(poll);
      }, 1500);
    };
    return () => {
      es.close();
      if (poll) clearInterval(poll);
    };
  }, [id]);

  return { state, connection };
}
