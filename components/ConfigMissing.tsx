// Rendered when required env vars aren't set. Always client-facing (shown
// in the browser) rather than a thrown error so we get a clear message
// instead of a blank page.
export function ConfigMissing({ missing }: { missing: string[] }) {
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
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: "'Syne', sans-serif",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.3em",
          fontSize: 11,
          marginBottom: 32,
        }}
      >
        <span style={{ color: "var(--accent-blue)" }}>TRIPTYCH</span>{" "}
        <span style={{ color: "var(--text-subtle)" }}>OS</span>
      </div>
      <div
        style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 11,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--accent-red)",
          marginBottom: 16,
        }}
      >
        Configuration missing
      </div>
      <div
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 12,
          color: "var(--text-secondary)",
          maxWidth: 480,
          lineHeight: 1.6,
        }}
      >
        The following environment variable{missing.length > 1 ? "s are" : " is"} not set:
      </div>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "12px 0 24px",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 12,
          color: "var(--text-primary)",
        }}
      >
        {missing.map((name) => (
          <li key={name} style={{ padding: "2px 0" }}>
            {name}
          </li>
        ))}
      </ul>
      <div
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          color: "var(--text-subtle)",
          maxWidth: 480,
          lineHeight: 1.6,
        }}
      >
        Add {missing.length > 1 ? "them" : "it"} to{" "}
        <code>.env.local</code> for local dev or to the Vercel project
        settings for production, then redeploy.
      </div>
    </div>
  );
}
