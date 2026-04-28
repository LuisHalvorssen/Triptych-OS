"use client";

import { useEffect, useState } from "react";

export type ToastKind = "error" | "success" | "info";

export interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
}

const DEFAULT_TTL_MS = 4000;

// Module-level store. Avoids needing a React Context provider — any caller
// can dispatch via `toast.error(...)` and any component can subscribe via
// `useToasts()`.
let toasts: ToastItem[] = [];
type Listener = (next: ToastItem[]) => void;
const listeners = new Set<Listener>();

function emit() {
  const snapshot = toasts;
  listeners.forEach((l) => l(snapshot));
}

function push(kind: ToastKind, message: string, ttl = DEFAULT_TTL_MS): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  toasts = [...toasts, { id, kind, message }];
  emit();
  if (ttl > 0) {
    setTimeout(() => dismiss(id), ttl);
  }
  return id;
}

export function dismiss(id: string): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  error: (m: string, ttl?: number) => push("error", m, ttl),
  success: (m: string, ttl?: number) => push("success", m, ttl),
  info: (m: string, ttl?: number) => push("info", m, ttl),
};

export function useToasts(): ToastItem[] {
  const [state, setState] = useState<ToastItem[]>(toasts);
  useEffect(() => {
    const l: Listener = (next) => setState(next);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return state;
}
