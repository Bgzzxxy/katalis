export default function App() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--bg-canvas)",
        color: "var(--text-primary)",
        display: "grid",
        placeItems: "center",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-hairline)",
          borderRadius: "6px",
          padding: "16px 20px",
          fontSize: "13px",
        }}
      >
        katalis
      </div>
    </main>
  );
}