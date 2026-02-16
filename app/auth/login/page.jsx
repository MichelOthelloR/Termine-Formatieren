"use client";

import { useState, useContext, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { SupabaseContext } from "../../../components/SupabaseProvider";

function LoginInner() {
  const supabase = useContext(SupabaseContext);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectedFrom = searchParams.get("redirectedFrom") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setBusy(false);

    if (error) {
      setErr(error.message);
      return;
    }

    router.replace(redirectedFrom); // ← zurück zur gewünschten Seite
  };

  return (
    <div style={{ padding: 40, color: "white", maxWidth: 420 }}>
      <h2 style={{ marginBottom: 12 }}>Login</h2>

      <form onSubmit={handleLogin}>
        <input
          placeholder="E-Mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            display: "block",
            width: "100%",
            marginBottom: 10,
            padding: 10,
            borderRadius: 6,
            border: "1px solid #334155",
            background: "#0f172a",
            color: "white",
          }}
        />
        <input
          type="password"
          placeholder="Passwort"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            display: "block",
            width: "100%",
            marginBottom: 10,
            padding: 10,
            borderRadius: 6,
            border: "1px solid #334155",
            background: "#0f172a",
            color: "white",
          }}
        />
        <button
          type="submit"
          disabled={busy}
          style={{
            padding: "10px 16px",
            borderRadius: 6,
            border: "none",
            background: "#3b82f6",
            color: "white",
            cursor: "pointer",
          }}
        >
          {busy ? "Anmelden…" : "Einloggen"}
        </button>
      </form>

      {err && <div style={{ marginTop: 10, color: "#fca5a5" }}>{err}</div>}

      <p style={{ marginTop: 16, fontSize: 14, color: "#94a3b8" }}>
        Noch kein Konto? <Link href="/auth/register">Registrieren</Link>
      </p>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 40, color: "white", maxWidth: 420 }}>
          Lade Login…
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}