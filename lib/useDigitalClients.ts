"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import type { DigitalClient } from "@/lib/types";

const POLL_INTERVAL_MS = 5000;

// Mirrors the useScopedTasks pattern but for the digital_clients table.
// Polls every 5s when the tab is visible and no mutation is in flight.
export function useDigitalClients() {
  const [clients, setClients] = useState<DigitalClient[]>([]);
  const inflightRef = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const { clients } = await api.get<{ clients: DigitalClient[] }>(
        "/api/clients"
      );
      setClients(clients);
    } catch (err) {
      console.error("[clients] refresh failed:", err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { clients } = await api.get<{ clients: DigitalClient[] }>(
          "/api/clients"
        );
        if (!cancelled) setClients(clients);
      } catch (err) {
        if (cancelled) return;
        console.error("[clients] initial load failed:", err);
        toast.error("Couldn't load clients");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;
      if (inflightRef.current > 0) return;
      await refresh();
    };
    const handle = setInterval(tick, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(handle);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const inflight = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
    inflightRef.current++;
    try {
      return await fn();
    } finally {
      inflightRef.current--;
    }
  }, []);

  const createClient = useCallback(
    async (payload: Partial<DigitalClient>): Promise<DigitalClient | null> => {
      try {
        const { client } = await inflight(() =>
          api.post<{ client: DigitalClient }>("/api/clients", payload)
        );
        setClients((prev) =>
          prev.some((c) => c.id === client.id) ? prev : [client, ...prev]
        );
        return client;
      } catch (err) {
        console.error("[clients] create error:", err);
        toast.error("Couldn't create client");
        return null;
      }
    },
    [inflight]
  );

  const updateClient = useCallback(
    async (id: string, patch: Partial<DigitalClient>) => {
      let previous: DigitalClient | undefined;
      setClients((prev) => {
        previous = prev.find((c) => c.id === id);
        return prev.map((c) => (c.id === id ? { ...c, ...patch } : c));
      });
      try {
        await inflight(() => api.patch(`/api/clients/${id}`, patch));
      } catch (err) {
        console.error("[clients] update error:", err);
        toast.error("Update failed");
        if (previous) {
          const snap = previous;
          setClients((prev) => prev.map((c) => (c.id === id ? snap : c)));
        }
      }
    },
    [inflight]
  );

  const archiveClient = useCallback(
    (id: string) =>
      updateClient(id, {
        status: "archived",
        archived_at: new Date().toISOString(),
      }),
    [updateClient]
  );

  return { clients, createClient, updateClient, archiveClient };
}
