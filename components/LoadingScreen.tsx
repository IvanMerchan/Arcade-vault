export function LoadingScreen() {
  return (
    <div className="fade-in" style={{ textAlign: "center", padding: "96px 32px" }}>
      <div className="spinner"></div>
      <div className="pixel neon-cyan" style={{ fontSize: 12, letterSpacing: "0.16em", marginTop: 20 }}>
        CARGANDO
      </div>
    </div>
  );
}
