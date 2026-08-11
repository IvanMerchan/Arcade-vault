import Link from "next/link";

export default function NotFound() {
  return (
    <div className="fade-in" style={{ textAlign: "center", padding: "96px 32px" }}>
      <div
        className="pixel neon-magenta"
        style={{ fontSize: "clamp(24px, 5vw, 40px)", marginBottom: 16 }}
      >
        GAME OVER
      </div>
      <div
        className="pixel"
        style={{ fontSize: 12, color: "var(--ink-faint)", letterSpacing: "0.16em", marginBottom: 32 }}
      >
        CARTUCHO NO ENCONTRADO
      </div>
      <Link className="btn lg" href="/">
        VOLVER AL VAULT
      </Link>
    </div>
  );
}
