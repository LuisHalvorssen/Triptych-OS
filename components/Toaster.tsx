"use client";

import { dismiss, useToasts, type ToastItem } from "@/lib/toast";

export function Toaster() {
  const items = useToasts();
  if (items.length === 0) return null;
  return (
    <div
      aria-live="polite"
      role="status"
      className="toaster-root"
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column-reverse",
        gap: 8,
        zIndex: 60,
        pointerEvents: "none",
      }}
    >
      {items.map((t) => (
        <ToastPill key={t.id} item={t} />
      ))}
    </div>
  );
}

function ToastPill({ item }: { item: ToastItem }) {
  if (item.kind === "action") {
    return <ActionToast item={item} />;
  }
  const accent =
    item.kind === "error"
      ? "var(--accent-red)"
      : item.kind === "info"
        ? "var(--accent-blue)"
        : "#3A8A5A";
  return (
    <button
      onClick={() => dismiss(item.id)}
      style={{
        pointerEvents: "auto",
        background: "var(--surface)",
        border: `1px solid ${accent}`,
        color: accent,
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

// Dark pill with embedded action (e.g., "Task completed · UNDO").
function ActionToast({ item }: { item: ToastItem }) {
  const action = item.action;
  return (
    <div
      className="action-toast"
      style={{
        pointerEvents: "auto",
        background: "#1A1A2E",
        color: "#FFFFFF",
        borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        animation: "tp-toast-in 0.24s ease",
        display: "flex",
        alignItems: "stretch",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          padding: "0 16px",
          display: "inline-flex",
          alignItems: "center",
          fontFamily: "'Syne', sans-serif",
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: "0.06em",
          minHeight: 44,
        }}
      >
        {item.message}
      </span>
      {action && (
        <button
          onClick={() => {
            action.onClick();
            dismiss(item.id);
          }}
          style={{
            background: "transparent",
            border: "none",
            borderLeft: "1px solid rgba(255,255,255,0.12)",
            color: "#E8530E",
            padding: "0 18px",
            minHeight: 44,
            minWidth: 44,
            cursor: "pointer",
            fontFamily: "'Syne', sans-serif",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
