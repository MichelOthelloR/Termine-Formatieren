"use client";

import Link from "next/link";
import { useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { SupabaseContext } from "./SupabaseProvider";

export default function Header() {
  const supabase = useContext(SupabaseContext);
  const [session, setSession] = useState(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;

    if (!supabase) return () => {};

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      if (!mounted) return;
      setSession(sess ?? null);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [supabase]);

  const isActive = (href) =>
    href === "/"
      ? pathname === "/"
      : pathname.startsWith(href);

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        width: "100%",
        background: "#0b1220",
        borderBottom: "1px solid #1f2937",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "white",
          gap: 12,
        }}
      >
        {/* Brand / Titel */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ textDecoration: "none", color: "white" }}>
            <strong style={{ fontSize: 16 }}>Termin‑Formatierer Pro</strong>
          </Link>
        </div>

        {/* Navigation */}
        <nav
          aria-label="Hauptnavigation"
          style={{ display: "flex", alignItems: "center", gap: 16 }}
        >
          <Link
            href="/"
            style={{
              color: isActive("/") ? "#93c5fd" : "#cbd5e1",
              textDecoration: "none",
              fontWeight: isActive("/") ? 700 : 500,
            }}
          >
            Formatierer
          </Link>

          <Link
            href="/modules"
            style={{
              color: isActive("/modules") ? "#93c5fd" : "#cbd5e1",
              textDecoration: "none",
              fontWeight: isActive("/modules") ? 700 : 500,
            }}
          >
            Module verwalten
          </Link>
        </nav>

        {/* Auth-Section (rechts) */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {session ? (
            <>
              <span
                style={{
                  fontSize: 12,
                  color: "#94a3b8",
                  maxWidth: 220,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={session.user?.email ?? ""}
              >
                {session.user?.email}
              </span>
              <button
                onClick={handleLogout}
                style={{
                  background: "transparent",
                  border: "1px solid #334155",
                  color: "#e2e8f0",
                  padding: "6px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                style={{ color: "#cbd5e1", textDecoration: "none" }}
              >
                Login
              </Link>
              <Link
                href="/auth/register"
                style={{
                  color: "white",
                  textDecoration: "none",
                  background: "#3b82f6",
                  padding: "6px 10px",
                  borderRadius: 6,
                }}
              >
                Registrieren
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}