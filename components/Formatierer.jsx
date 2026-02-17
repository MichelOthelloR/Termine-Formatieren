"use client";

import { useState, useContext, useEffect, useMemo } from "react";
import { SupabaseContext } from "../components/SupabaseProvider";
import Fuse from "fuse.js";
import { useRouter } from "next/navigation";

export default function Formatierer() {
  const supabase = useContext(SupabaseContext);
  const router = useRouter();

  const [db, setDb] = useState({});
  const [missingValues, setMissingValues] = useState({});
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [missing, setMissing] = useState([]);

  // Feedback für Ausgabe
  const [outputFlash, setOutputFlash] = useState(false);
  const [outputInfo, setOutputInfo] = useState("");

  // Inline-Bearbeitung eines bestehenden Moduls (ähnlicher Betreff)
  const [editingModule, setEditingModule] = useState(null);
  const [editingError, setEditingError] = useState("");

  // bekannte Subjects für Vorschläge (ähnliche Betreffe)
  const subjects = useMemo(() => Object.keys(db), [db]);

  const fuse = useMemo(() => {
    if (!subjects.length) return null;
    return new Fuse(subjects, {
      includeScore: true,
      threshold: 0.3,
    });
  }, [subjects]);

  //
  // 1) MODULE AUS SUPABASE LADEN
  //
  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Wenn Supabase noch nicht initialisiert ist, nichts tun
      if (!supabase) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Wenn kein User vorhanden ist (z.B. noch nicht eingeloggt),
      // abbrechen, damit kein Zugriff auf user.id erfolgt.
      if (!user || cancelled) return;

      const { data, error } = await supabase
        .from("modules")
        .select("*")
        .eq("user_id", user.id);

      if (error || cancelled) return;

      const map = {};
      for (const row of data || []) map[row.subject] = row.description;
      setDb(map);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  //
  // 2) HILFSFUNKTIONEN
  //
  const parseGermanDate = (txt) => {
    const m = txt.match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
    if (!m) return null;
    const [d, mo, y] = m[1].split(".");
    const dt = new Date(Number(y), Number(mo) - 1, Number(d));
    return isNaN(dt.getTime()) ? null : dt;
  };

  const getISOWeekData = (date) => {
    const tmp = new Date(date.valueOf());
    tmp.setHours(0, 0, 0, 0);
    tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7));
    const year = tmp.getFullYear();
    const week = Math.ceil(
      (((tmp - new Date(year, 0, 1)) / 86400000) + 1) / 7
    );
    return { year, week };
  };

  const parseRow = (row) => {
    const cols = row
      .trim()
      .split(/\t|;| {2,}/)
      .map((x) => x.trim())
      .filter(Boolean);

    if (cols.length < 5) return null;

    const date = parseGermanDate(cols[0]);
    if (!date) return null;

    const rawSubject = cols[4].replace(/\bBearbeiten\b/, "").trim();

    // Führende Nummer/Code (z.B. "5.08 ") entfernen, aber nur,
    // wenn das erste Token überhaupt eine Ziffer enthält
    let subject = rawSubject;
    const m2 = rawSubject.match(/^(\S+)\s+(.*)$/);
    if (m2 && /\d/.test(m2[1])) {
      subject = m2[2].trim();
    }

    return { date, subject };
  };

  //
  // 3) FORMATIERUNG
  //
  const formatWithDb = (text, dbOverride) => {
    const currentDb = dbOverride || db;

    if (!text.trim()) {
      setOutput("");
      setMissing([]);
      return;
    }

    const rows = text.split(/\r?\n/).filter((r) => r.trim());
    const groups = {};
    const missingSet = new Set();
    const describedSubjects = new Set();

    rows.forEach((r) => {
      const parsed = parseRow(r);
      if (!parsed) return;

      const { date, subject } = parsed;
      const { year, week } = getISOWeekData(date);

      const key = `${year}-KW${week}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(subject);
    });

    let out = "";
    Object.keys(groups)
      .sort()
      .forEach((key) => {
        const kw = key.split("-")[1];
        out += kw + "\n";

        const unique = [...new Set(groups[key])];
        unique.forEach((sub) => {
          out += "• " + sub + "\n";

          if (currentDb[sub]) {
            if (!describedSubjects.has(sub)) {
              out += "  " + currentDb[sub] + "\n";
              describedSubjects.add(sub);
            }
          } else {
            missingSet.add(sub);
          }
        });

        out += "\n";
      });

    out = out.trim();
    setOutput(out);
    setMissing([...missingSet]);

    try {
      navigator.clipboard.writeText(out);
    } catch (err) {
      console.warn("Clipboard nicht verfügbar");
    }
  };

  const format = (text) => formatWithDb(text);

  //
  // 4) NEUES MODULE SPEICHERN
  //
  async function saveModuleWithDescription(subject, description) {
    if (!description) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Sicherstellen, dass ein eingeloggter User vorhanden ist
    if (!user) return;

    const { error: insertError } = await supabase.from("modules").insert({
      user_id: user.id,
      subject,
      description,
    });

    if (insertError) {
      console.error("Fehler beim Speichern des Moduls:", insertError);
      return;
    }

    // DB neu laden (nur eigene Module)
    const { data, error: reloadError } = await supabase
      .from("modules")
      .select("*")
      .eq("user_id", user.id);

    if (reloadError) {
      console.error("Fehler beim Neuladen der Module:", reloadError);
      return;
    }

    const map = {};
    for (const row of data || []) {
      map[row.subject] = row.description;
    }
    setDb(map);

    // Missing entfernen
    setMissing((prev) => prev.filter((s) => s !== subject));

    // Neu formatieren mit frischer DB
    formatWithDb(input, map);

    // Visuelles Feedback für den Nutzer
    setOutputInfo("Beschreibung wurde übernommen");
    setOutputFlash(true);
    setTimeout(() => setOutputFlash(false), 350);
  }

  async function saveNewModule(subject) {
    const description = missingValues[subject];
    await saveModuleWithDescription(subject, description);
  }

  async function saveNewModuleFromExisting(subject, existingSubject) {
    const description = db[existingSubject];
    await saveModuleWithDescription(subject, description);
  }

  //
  // 5) EXISTIERENDES MODUL (ähnlicher Betreff) BEARBEITEN
  //
  async function openEditExisting(existingSubject, missingKey) {
    setEditingError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setEditingError("Du bist nicht eingeloggt.");
      return;
    }

    const { data, error } = await supabase
      .from("modules")
      .select("*")
      .eq("user_id", user.id)
      .eq("subject", existingSubject)
      .single();

    if (error || !data) {
      console.error("Fehler beim Laden des Moduls:", error);
      setEditingError("Modul konnte nicht geladen werden.");
      return;
    }

    setEditingModule({
      id: data.id,
      subject: data.subject || existingSubject,
      description: data.description || "",
      originalSubject: data.subject || existingSubject,
      forMissing: missingKey,
    });
  }

  async function saveEditedExistingModule() {
    if (!editingModule) return;

    const subject = editingModule.subject.trim();
    const description = editingModule.description.trim();

    if (!subject || !description) {
      setEditingError("Betreff und Beschreibung dürfen nicht leer sein.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setEditingError("Du bist nicht eingeloggt.");
      return;
    }

    const { error } = await supabase
      .from("modules")
      .update({
        subject,
        description,
      })
      .eq("id", editingModule.id)
      // Defense-in-Depth: zusätzlich nach Owner filtern (RLS bleibt trotzdem Pflicht!)
      .eq("user_id", user.id);

    if (error) {
      console.error("Fehler beim Speichern des Moduls:", error);
      setEditingError("Modul konnte nicht gespeichert werden.");
      return;
    }

    // DB neu laden (nur eigene Module)
    const { data, error: reloadError } = await supabase
      .from("modules")
      .select("*")
      .eq("user_id", user.id);

    if (reloadError) {
      console.error("Fehler beim Neuladen der Module:", reloadError);
      return;
    }

    const map = {};
    for (const row of data || []) {
      map[row.subject] = row.description;
    }
    setDb(map);

    // Neu formatieren mit aktualisierter DB
    formatWithDb(input, map);

    setEditingModule(null);
    setEditingError("");

    // Visuelles Feedback
    setOutputInfo("Modul wurde bearbeitet");
    setOutputFlash(true);
    setTimeout(() => setOutputFlash(false), 350);
  }

  function cancelEditExisting() {
    setEditingModule(null);
    setEditingError("");
  }

  //
  // 5) RENDERING
  //
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          flex: 1,
        }}
      >
        {/* Eingabe */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label style={{ marginBottom: 10, fontWeight: 600 }}>
            Terminübersicht
          </label>

          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              format(e.target.value);
            }}
            placeholder="Daten hier einfügen…"
            style={{
              minHeight: "38vh",
              background: "#020617",
              border: "1px solid #1f2933",
              color: "white",
              borderRadius: 10,
              padding: 14,
              fontSize: 14,
            }}
          />
        </div>

        {/* Ausgabe */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label
            style={{
              marginBottom: 10,
              fontWeight: 600,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            Ergebnis
            <span
              style={{
                fontSize: 12,
                background: "#22c55e",
                color: "white",
                padding: "3px 8px",
                borderRadius: 6,
                marginLeft: 10,
                opacity: output ? 1 : 0.4,
              }}
            >
              ✔ automatisch kopiert
            </span>
          </label>

          <textarea
            value={output}
            readOnly
            style={{
              minHeight: "38vh",
              background: outputFlash ? "#064e3b" : "#111827",
              border: outputFlash ? "1px solid #22c55e" : "1px solid #1f2933",
              color: "white",
              borderRadius: 10,
              padding: 14,
              fontSize: 14,
              transition:
                "background-color 150ms ease, border-color 150ms ease",
            }}
          />

          {outputInfo && (
            <div
              style={{
                marginTop: 6,
                color: "#4ade80",
                fontSize: 13,
              }}
            >
              {outputInfo}
            </div>
          )}
        </div>
      </div>

      {/* Unbekannte Module */}
      {missing.length > 0 && (
        <div
          style={{
            marginTop: 20,
            background: "rgba(245, 158, 11, 0.15)",
            padding: 10,
            borderRadius: 8,
            color: "#fbbf24",
          }}
        >
          <strong>Unbekannte Module:</strong>

          <ul style={{ marginTop: 8 }}>
            {missing.map((m) => {
              let similarSubject = null;

              if (fuse) {
                const results = fuse.search(m);
                if (results.length && results[0].score <= 0.3) {
                  similarSubject = results[0].item;
                }
              }

              return (
                <li key={m} style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 500 }}>{m}</div>

                  {similarSubject && (
                    <div
                      style={{
                        marginTop: 4,
                        padding: 6,
                        borderRadius: 6,
                        background: "rgba(59,130,246,0.1)",
                        color: "#e5e7eb",
                        fontSize: 12,
                      }}
                    >
                      <div>
                        Ähnlicher Betreff vorhanden:&nbsp;
                        <span style={{ fontWeight: 600 }}>
                          {similarSubject}
                        </span>
                      </div>
                      <div
                        style={{
                          marginTop: 6,
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                        }}
                      >
                        <button
                          style={{
                            background: "#3b82f6",
                            border: "none",
                            padding: "3px 10px",
                            borderRadius: 4,
                            color: "white",
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                          onClick={() => openEditExisting(similarSubject, m)}
                        >
                          Diesen Eintrag bearbeiten
                        </button>

                        <button
                          style={{
                            background: "#22c55e",
                            border: "none",
                            padding: "3px 10px",
                            borderRadius: 4,
                            color: "white",
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                          onClick={() =>
                            saveNewModuleFromExisting(m, similarSubject)
                          }
                        >
                          Beschreibung übernehmen
                        </button>
                      </div>
                    </div>
                  )}

                  {editingModule && editingModule.forMissing === m && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: 8,
                        borderRadius: 6,
                        background: "#020617",
                        border: "1px solid #374151",
                        maxWidth: 600,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          marginBottom: 6,
                          color: "#e5e7eb",
                        }}
                      >
                        Bestehenden Eintrag bearbeiten
                      </div>

                      <input
                        value={editingModule.subject}
                        onChange={(e) =>
                          setEditingModule((prev) =>
                            prev
                              ? { ...prev, subject: e.target.value }
                              : prev
                          )
                        }
                        style={{
                          width: "100%",
                          padding: 6,
                          borderRadius: 4,
                          border: "1px solid #4b5563",
                          background: "#020617",
                          color: "white",
                          fontSize: 13,
                          marginBottom: 6,
                        }}
                      />

                      <textarea
                        value={editingModule.description}
                        onChange={(e) =>
                          setEditingModule((prev) =>
                            prev
                              ? { ...prev, description: e.target.value }
                              : prev
                          )
                        }
                        style={{
                          width: "100%",
                          minHeight: 60,
                          padding: 6,
                          borderRadius: 4,
                          border: "1px solid #4b5563",
                          background: "#020617",
                          color: "white",
                          fontSize: 13,
                          resize: "vertical",
                        }}
                      />

                      {editingError && (
                        <div
                          style={{
                            marginTop: 4,
                            color: "#f97316",
                            fontSize: 12,
                          }}
                        >
                          {editingError}
                        </div>
                      )}

                      <div
                        style={{
                          marginTop: 6,
                          display: "flex",
                          gap: 8,
                        }}
                      >
                        <button
                          style={{
                            background: "#22c55e",
                            border: "none",
                            padding: "4px 12px",
                            borderRadius: 4,
                            color: "white",
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                          onClick={saveEditedExistingModule}
                        >
                          Änderungen speichern
                        </button>

                        <button
                          style={{
                            background: "transparent",
                            border: "1px solid #4b5563",
                            padding: "4px 12px",
                            borderRadius: 4,
                            color: "#e5e7eb",
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                          onClick={cancelEditExisting}
                        >
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  )}

                  <input
                    placeholder="Beschreibung eingeben…"
                    style={{
                      marginTop: 6,
                      padding: 4,
                      borderRadius: 4,
                      border: "1px solid #555",
                      background: "#0b1220",
                      color: "white",
                      width: "100%",
                      maxWidth: 500,
                    }}
                    onChange={(e) =>
                      setMissingValues((prev) => ({
                        ...prev,
                        [m]: e.target.value,
                      }))
                    }
                  />

                  <button
                    style={{
                      marginTop: 6,
                      background: "#22c55e",
                      border: "none",
                      padding: "4px 12px",
                      borderRadius: 4,
                      color: "white",
                      cursor: "pointer",
                    }}
                    onClick={() => saveNewModule(m)}
                  >
                    Speichern
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}