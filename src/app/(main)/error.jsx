"use client";

export default function MainError({ error, reset }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: "2rem",
        textAlign: "center",
        gap: "1rem",
      }}
    >
      <h2
        style={{
          fontSize: "1.25rem",
          fontWeight: 600,
          color: "var(--color-fg)",
        }}
      >
        Something went wrong
      </h2>
      <p
        style={{
          color: "var(--color-muted)",
          maxWidth: "28rem",
          lineHeight: 1.5,
        }}
      >
        {error?.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={() => reset()}
        style={{
          marginTop: "0.5rem",
          padding: "0.5rem 1.25rem",
          borderRadius: "0.5rem",
          border: "1px solid var(--color-border)",
          background: "var(--color-bg)",
          color: "var(--color-fg)",
          cursor: "pointer",
          fontSize: "0.875rem",
          fontWeight: 500,
        }}
      >
        Try again
      </button>
    </div>
  );
}
