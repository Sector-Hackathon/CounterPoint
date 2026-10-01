'use client';
import { useEffect, useReducer, useState } from 'react';
import { api, eventsUrl, type SessionEvent } from './api';
import { initialState, reduce } from './session-state';

const TERMINAL = new Set(['COMPLETED', 'PARTIAL', 'FAILED']);

/**
 * Subscribes to the session's SSE stream. The server replays stored events first, so a
 * reload or reconnect rebuilds the same state. Falls back to polling the session endpoint
 * (status only) if EventSource errors three times in a row.
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
      if (++errors < 3) return; // EventSource reconnects on its own
      es.close();
      setConnection('polling');
      poll = setInterval(async () => {
        const s = await api.getSession(id).catch(() => null);
        if (!s) return;
        dispatch({ id: `status:${s.status}`, type: 'session.status', status: s.status, error: s.error });
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
