"use client";

import { dismiss, useToasts, type ToastItem } from "@/lib/toast";

export function Toaster() {
  const items = useToasts();
  if (items.length === 0) return null;
  return (
    <div
      aria-live="polite"
      role="status"
      style={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column-reverse",
        gap: 8,
        zIndex: 60,
        pointerEvents: "none",
        maxWidth: "calc(100vw - 32px)",
      }}
    >
      {items.map((t) => (
        <ToastPill key={t.id} item={t} />
      ))}
    </div>
  );
}

function ToastPill({ item }: { item: ToastItem }) {
  const isError = item.kind === "error";
  return (
    <button
      onClick={() => dismiss(item.id)}
      style={{
        pointerEvents: "auto",
        background: "var(--surface)",
        border: `1px solid ${isError ? "var(--accent-red)" : "#3A8A5A"}`,
        color: isError ? "var(--accent-red)" : "#3A8A5A",
        padding: "10px 16px",
        borderRadius: 3,
        fontSize: 11,
        fontFamily: "'Syne', sans-serif",
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        cursor: "pointer",
        minWidth: 220,
        textAlign: "center",
        boxShadow: "0 4px 18px rgba(0,0,0,0.25)",
        animation: "tp-toast-in 0.24s ease",
      }}
    >
      {item.message}
    </button>
  );
}
