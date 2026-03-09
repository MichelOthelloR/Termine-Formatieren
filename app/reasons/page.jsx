"use client";

import { Suspense, useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import AuthGuard from "../../components/AuthGuard";
import { SupabaseContext } from "../../components/SupabaseProvider";

const AGE_BANDS = [
  { id: "18_25", label: "18–25 Jahre" },
  { id: "26_39", label: "26–39 Jahre" },
  { id: "40_55", label: "40–55 Jahre" },
  { id: "55_PLUS", label: "55+ Jahre" },
];

function getPronoun(salutation) {
  if (salutation === "Herr") return "er";
  if (salutation === "Frau") return "sie";
  return "";
}

function applyPlaceholders(template, salutation, lastName) {
  if (!template) return "";

  const name = (lastName || "").trim();
  const pronoun = getPronoun(salutation);

  return template
    .replaceAll("#ANREDE#", salutation || "")
    .replaceAll("#NAME#", name)
    .replaceAll("#PRONOM#", pronoun);
}

function ReasonsPageInner() {
  const supabase = useContext(SupabaseContext);
  const searchParams = useSearchParams();

  const [summary, setSummary] = useState(null);
  const [salutation, setSalutation] = useState("Herr");
  const [lastName, setLastName] = useState("");
  const [ageBand, setAgeBand] = useState("18_25");

  const [loadingReasons, setLoadingReasons] = useState(false);
  const [reasons, setReasons] = useState([]);
  const [error, setError] = useState("");

  // 1) Daten aus dem Formatierer (Summary) lesen
  useEffect(() => {
    const encoded = searchParams.get("summary");
    if (!encoded) return;

    try {
      const json = atob(encoded);
      const parsed = JSON.parse(json);
      if (parsed && Array.isArray(parsed.subjects)) {
        setSummary(parsed);
      }
    } catch (err) {
      console.error("Konnte Summary aus Query-Parameter nicht laden", err);
      setError(
        "Die übergebenen Daten konnten nicht gelesen werden. Bitte rufe diese Seite erneut über den Formatierer auf."
      );
    }
  }, [searchParams]);

  // 2) Begründungs-Texte aus Supabase laden
  useEffect(() => {
    async function loadReasons() {
      if (!supabase || !summary || !summary.subjects?.length) return;

      setLoadingReasons(true);
      setError("");

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setError("Du bist nicht eingeloggt.");
          return;
        }

        const subjects = summary.subjects.map((s) => s.subject);

        const { data, error: dbError } = await supabase
          .from("module_reasons")
          .select("*")
          .eq("user_id", user.id)
          .in("subject", subjects);

        if (dbError) {
          console.error("Fehler beim Laden der Begründungen:", dbError);
          setError("Begründungen konnten nicht geladen werden.");
          return;
        }

        setReasons(data || []);
      } finally {
        setLoadingReasons(false);
      }
    }

    loadReasons();
  }, [supabase, summary]);

  // 3) Pro Modul die passende Begründung auswählen und Platzhalter füllen
  const resolvedReasons = useMemo(() => {
    if (!summary || !summary.subjects) return [];

    return summary.subjects.map(({ subject, count }) => {
      const bookingType = count === 1 ? "single" : "multiple";

      const candidates = reasons.filter(
        (r) => r.subject === subject && r.booking_type === bookingType
      );

      // 1. Versuch: exakt passende Altersgruppe
      let row =
        candidates.find((r) => r.age_band === ageBand) ||
        // 2. Versuch: allgemeine Begründung ohne Altersgruppe
        candidates.find((r) => r.age_band == null);

      const template = row?.template || null;

      const text =
        template && lastName.trim()
          ? applyPlaceholders(template, salutation, lastName)
          : template || "";

      return {
        subject,
        count,
        rawTemplate: template,
        text,
      };
    });
  }, [summary, reasons, salutation, lastName, ageBand]);

  return (
    <AuthGuard>
      <div
        style={{
          padding: 24,
          maxWidth: 900,
          margin: "0 auto",
          color: "white",
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
          Begründungen pro Modul
        </h1>

        {!summary && (
          <p style={{ marginBottom: 20, color: "#fbbf24" }}>
            Keine Terminübersicht übergeben. Bitte rufe diese Seite über den
            Formatierer auf.
          </p>
        )}

        {/* Steuerdaten */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 12,
            marginBottom: 24,
            background: "#020617",
            padding: 16,
            borderRadius: 10,
            border: "1px solid #1f2937",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>Anrede</label>
            <select
              value={salutation}
              onChange={(e) => setSalutation(e.target.value)}
              style={{
                padding: 8,
                borderRadius: 6,
                border: "1px solid #334155",
                background: "#020617",
                color: "white",
              }}
            >
              <option value="Herr">Herr</option>
              <option value="Frau">Frau</option>
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>Nachname</label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Nachname"
              style={{
                padding: 8,
                borderRadius: 6,
                border: "1px solid #334155",
                background: "#020617",
                color: "white",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Altersgruppe
            </label>
            <select
              value={ageBand}
              onChange={(e) => setAgeBand(e.target.value)}
              style={{
                padding: 8,
                borderRadius: 6,
                border: "1px solid #334155",
                background: "#020617",
                color: "white",
              }}
            >
              {AGE_BANDS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div
            style={{
              marginBottom: 16,
              padding: 10,
              borderRadius: 8,
              background: "rgba(248, 113, 113, 0.12)",
              color: "#fecaca",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {loadingReasons && (
          <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 16 }}>
            Lade Begründungen…
          </p>
        )}

        {/* Ergebnis-Liste pro Modul */}
        {summary && resolvedReasons.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {resolvedReasons.map((item) => (
              <div
                key={item.subject}
                style={{
                  background: "#020617",
                  borderRadius: 10,
                  padding: 14,
                  border: "1px solid #1f2937",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: 6,
                  }}
                >
                  <div>
                    <div
                      style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}
                    >
                      {item.subject}
                    </div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>
                      Besuche: {item.count}{" "}
                      {item.count === 1 ? "(Einzelbuchung)" : "(Mehrfachbuchung)"}
                    </div>
                  </div>
                </div>

                {item.rawTemplate ? (
                  <p
                    style={{
                      marginTop: 8,
                      fontSize: 14,
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {item.text ||
                      "Bitte Nachname eingeben, um den Text vollständig zu sehen."}
                  </p>
                ) : (
                  <p
                    style={{
                      marginTop: 8,
                      fontSize: 13,
                      color: "#fbbf24",
                    }}
                  >
                    Für dieses Modul ist noch keine Begründung in der Datenbank
                    hinterlegt.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}

export default function ReasonsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 24, color: "white" }}>
          Lade Begründungen…
        </div>
      }
    >
      <ReasonsPageInner />
    </Suspense>
  );
}
