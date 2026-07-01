/**
 * Live approval/notification events over the backend WebSocket (/api/ws).
 * Auth rides the httpOnly access_token cookie sent during the WS handshake.
 * Auto-reconnects with a short backoff. Push-only: we never send frames.
 */
import { useEffect, useRef } from "react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

function wsUrl() {
  // http(s)://host  ->  ws(s)://host/api/ws
  return `${BACKEND_URL.replace(/^http/, "ws")}/api/ws`;
}

export function useApprovalsSocket(onEvent) {
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  useEffect(() => {
    let closed = false;
    let retry;
    let socket;

    const connect = () => {
      try {
        socket = new WebSocket(wsUrl());
      } catch {
        return;
      }
      socket.onmessage = (e) => {
        try {
          cbRef.current?.(JSON.parse(e.data));
        } catch {
          /* ignore non-JSON frames like "pong" */
        }
      };
      socket.onclose = () => {
        if (!closed) retry = setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      try {
        socket?.close();
      } catch {
        /* noop */
      }
    };
  }, []);
}
