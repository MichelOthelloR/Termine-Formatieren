"use client";
import { useContext, useState } from "react";
import { SupabaseContext } from "../../../components/SupabaseProvider";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const supabase = useContext(SupabaseContext);
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false); // 👈 Toggle visible
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [err, setErr] = useState("");

  // 🔒 Passwort-Regeln: 12 Zeichen, Zahl, Sonderzeichen
  const isStrongPassword = (pw) => {
    const minLength = pw.length >= 12;
    const hasNumber = /\d/.test(pw);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>_\-+]/.test(pw);
    return minLength && hasNumber && hasSpecial;
  };

  const onRegister = async () => {
    setErr("");
    setMessage("");

    if (!isStrongPassword(password)) {
      setErr("Passwort zu schwach. Mindestens 12 Zeichen, eine Zahl und ein Sonderzeichen erforderlich.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    setBusy(false);

    if (error) {
      setErr(error.message);
      return;
    }

    // 📨 Hinweis nach erfolgreicher Registrierung
    setMessage("Registrierung erfolgreich! Bitte überprüfe deine E‑Mail‑Adresse und bestätige dein Konto.");
  };

  return (
    <div style={{ padding: 40, maxWidth: 420 }}>
      <h1>Registrieren</h1>

      {/* E-Mail */}
      <input
        placeholder="E-Mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 8, borderRadius: 6 }}
      />

{/* Passwort + Show/Hide */}
<div
  style={{
    display: "flex",
    alignItems: "center",
    marginBottom: 8,
    background: "white",          // ← Feld ist jetzt weiß
    borderRadius: 6,
    padding: "0 8px",
    border: "1px solid #ccc"      // leichte Umrandung wie bei Standardformularen
  }}
>
  <input
    type={showPw ? "text" : "password"}
    placeholder="Passwort (mind. 12 Zeichen, Zahl & Sonderzeichen)"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    style={{
      flex: 1,
      padding: 10,
      background: "transparent",  // wichtig, damit der weiße Hintergrund sichtbar bleibt
      border: "none",
      color: "#000",               // schwarze Schrift
      outline: "none"
    }}
  />

  <button
    type="button"
    onClick={() => setShowPw(!showPw)}
    style={{
      background: "transparent",
      border: "none",
      color: "#3b82f6",
      cursor: "pointer",
      fontSize: 12,
      padding: "0 6px"
    }}
  >
    {showPw ? "Verbergen" : "Anzeigen"}
  </button>
</div>

      {/* Registrieren Button */}
      <button
        onClick={onRegister}
        disabled={busy}
        style={{
          width: "100%",
          padding: "10px 16px",
          borderRadius: 6,
          background: "#3b82f6",
          color: "white",
          border: "none",
          marginTop: 10,
          cursor: "pointer"
        }}
      >
        {busy ? "Erstelle Account…" : "Account erstellen"}
      </button>

      {/* Fehler */}
      {err && (
        <div style={{ marginTop: 12, color: "#fca5a5", fontWeight: 500 }}>
          {err}
        </div>
      )}

      {/* Erfolg */}
      {message && (
        <div style={{ marginTop: 12, color: "#4ade80", fontWeight: 500 }}>
          {message}
        </div>
      )}

      {/* Login Link */}

<p style={{ marginTop: 20 }}>
  Bereits ein Konto?{" "}
  <a href="/auth/login" style={{ color: "#3b82f6" }}>
    Login
  </a>
</p>


    </div>
  );
}