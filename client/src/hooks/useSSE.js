import { useEffect, useRef } from "react";
import { api } from "../lib/api";

// Opens an SSE stream to /events using a one-time ticket, calling `onMessage`
// on every event. The browser auto-reconnects; we close the socket on unmount
// or when `deps` change. `enabled` gates whether to connect at all.
export function useSSE(onMessage, { enabled = true, deps = [] } = {}) {
  // Keep the latest handler so events always hit the current closure.
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    if (!enabled) return;

    let es = null;
    let failSince = null;

    async function connect() {
      let ticket;
      try {
        const data = await api.post("/sseTicket");
        ticket = data.ticket;
      } catch {
        return;
      }

      es = new EventSource(
        `${import.meta.env.VITE_API_URL}/events?ticket=${encodeURIComponent(ticket)}`
      );

      es.onmessage = () => handlerRef.current();
      es.onerror = () => {
        if (!failSince) failSince = Date.now();
        if (Date.now() - failSince > 30_000) es.close();
      };
      es.onopen = () => {
        failSince = null;
      };
    }

    connect();

    return () => {
      if (es) es.close();
    };
    // deps is spread so each caller controls when to reconnect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);
}
