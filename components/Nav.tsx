"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/components/SessionProvider";

export function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user, signOut } = useSession();

  const isHomeActive = pathname === "/";
  const isLibraryActive =
    pathname === "/biblioteca" || pathname.startsWith("/juegos") || pathname.startsWith("/jugar");
  const isHallActive = pathname === "/salon";

  const close = () => setOpen(false);

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo">
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">ARCADE <span className="neon-magenta">VAULT</span></div>
        </Link>
        <div className="links">
          <Link href="/" className={isHomeActive ? "active" : ""}>Inicio</Link>
          <Link href="/biblioteca" className={isLibraryActive ? "active" : ""}>Biblioteca</Link>
          <Link href="/salon" className={isHallActive ? "active" : ""}>Salón de la Fama</Link>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>
        {user ? (
          <button className="btn ghost auth-btn" onClick={signOut}>{user.name} ▾</button>
        ) : (
          <Link className="btn auth-btn" href="/auth">Iniciar Sesión</Link>
        )}
        <button className="btn ghost hamburger" onClick={() => setOpen(true)} aria-label="Menú">≡</button>
      </nav>

      <div className={"av-mobile-backdrop" + (open ? " open" : "")} onClick={close}></div>
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>MENÚ</div>
        <Link href="/" className={isHomeActive ? "active" : ""} onClick={close}>Inicio</Link>
        <Link href="/biblioteca" className={isLibraryActive ? "active" : ""} onClick={close}>Biblioteca</Link>
        <Link href="/salon" className={isHallActive ? "active" : ""} onClick={close}>Salón de la Fama</Link>
        <Link href="/auth" className={pathname === "/auth" ? "active" : ""} onClick={close}>{user ? "Cuenta" : "Iniciar Sesión"}</Link>
        <div style={{ flex: 1 }}></div>
        <div className="pixel" style={{ fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.16em" }}>CRÉDITOS · 03</div>
      </aside>
    </>
  );
}
