import Link from "next/link";

export default function Landing() {
  return (
    <div style={{
      backgroundColor: "#000000",
      color: "#FFFFFF",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      fontFamily: "system-ui, sans-serif",
      padding: "2rem",
      textAlign: "center"
    }}>
      <main>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: "4rem",
          fontWeight: 400,
          margin: "0 0 1.5rem 0",
          letterSpacing: "-0.02em"
        }}>
          Natural Design
        </h1>

        <p style={{
          fontSize: "1.25rem",
          color: "#888888",
          maxWidth: "600px",
          margin: "0 auto 3rem auto",
          lineHeight: "1.6"
        }}>
          Alignment, Insight, and Interaction Dynamics.
        </p>

        <Link
          href="/dashboard"
          style={{
            display: "inline-block",
            border: "1px solid #333333",
            padding: "1rem 2rem",
            color: "#FFFFFF",
            textDecoration: "none",
            fontSize: "0.9rem",
            letterSpacing: "0.05em",
            transition: "border-color 0.2s ease"
          }}
        >
          ENTER SYSTEM
        </Link>
      </main>

      <footer style={{
        position: "absolute",
        bottom: "2rem",
        fontSize: "0.75rem",
        color: "#444444"
      }}>
        DEFRAG OS &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
