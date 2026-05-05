interface Props {
  title: string;
  subtitle: string;
}

export function ScopePlaceholder({ title, subtitle }: Props) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "120px 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: "'Syne', sans-serif",
          fontWeight: 800,
          fontSize: 32,
          letterSpacing: "0.02em",
          color: "var(--text-primary)",
          marginBottom: 12,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 12,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        {subtitle}
      </div>
    </div>
  );
}
