"use client";

import { useEffect, useRef, useState } from "react";

export default function GatePage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    // Apply the theme the user had previously (cookie readable from client).
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith("triptych-theme="));
    const theme =
      match && decodeURIComponent(match.split("=")[1] ?? "") === "light"
        ? "light"
        : "dark";
    document.documentElement.setAttribute("data-theme", theme);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.href = "/";
      } else {
        setError(true);
        setPassword("");
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    } catch {
      setError(true);
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        color: "var(--text-primary)",
        padding: 32,
      }}
    >
      <div
        style={{
          fontFamily: "'Syne', sans-serif",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.3em",
          fontSize: 11,
          marginBottom: 40,
        }}
      >
        <span style={{ color: "var(--accent-blue)" }}>TRIPTYCH</span>{" "}
        <span style={{ color: "var(--text-subtle)" }}>OS</span>
      </div>

      <form
        onSubmit={onSubmit}
        style={{ width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 12 }}
      >
        <label
          htmlFor="pw"
          style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 10,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
            textAlign: "center",
          }}
        >
          Password
        </label>
        <input
          id="pw"
          ref={inputRef}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) setError(false);
          }}
          disabled={loading}
          style={{
            width: "100%",
            background: "var(--surface)",
            border: `1px solid ${error ? "var(--accent-red)" : "var(--border)"}`,
            borderRadius: 2,
            color: "var(--text-primary)",
            padding: "13px 16px",
            fontSize: 14,
            fontFamily: "'IBM Plex Mono', monospace",
            outline: "none",
            textAlign: "center",
            letterSpacing: "0.3em",
            boxSizing: "border-box",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => {
            if (!error) e.currentTarget.style.borderColor = "var(--accent-blue)";
          }}
          onBlur={(e) => {
            if (!error) e.currentTarget.style.borderColor = "var(--border)";
          }}
        />
        <button
          type="submit"
          disabled={!password || loading}
          style={{
            background: !password || loading ? "var(--surface)" : "var(--accent-blue)",
            border: `1px solid ${!password || loading ? "var(--border)" : "var(--accent-blue)"}`,
            color: !password || loading ? "var(--text-subtle)" : "#fff",
            padding: "13px 22px",
            borderRadius: 2,
            cursor: !password || loading ? "not-allowed" : "pointer",
            fontSize: 11,
            fontFamily: "'Syne', sans-serif",
            fontWeight: 800,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            transition: "all 0.15s",
          }}
        >
          {loading ? "…" : "Enter"}
        </button>
        <div
          style={{
            minHeight: 18,
            textAlign: "center",
            fontFamily: "'Syne', sans-serif",
            fontSize: 10,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--accent-red)",
            opacity: error ? 1 : 0,
            transition: "opacity 0.2s",
          }}
        >
          Incorrect password
        </div>
      </form>
    </div>
  );
}
