"use client";

import { useContext, useEffect, useState, useRef, useMemo, Suspense } from "react";

import { SupabaseContext } from "../../components/SupabaseProvider";
import AuthGuard from "../../components/AuthGuard";
import Fuse from "fuse.js";
import { useSearchParams } from "next/navigation";

function ModulesPageInner() {
  const supabase = useContext(SupabaseContext);
  const searchParams = useSearchParams();

  // State
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newSubject, setNewSubject] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const [undoData, setUndoData] = useState(null);
  const [showUndo, setShowUndo] = useState(false);

  const [search, setSearch] = useState("");
  const [saveStatus, setSaveStatus] = useState({});

  // Duplicate-Fehler (für neues Modul oder beim Bearbeiten)
  // z.B. { mode: "new" } oder { mode: "edit", moduleId: 123 }
  const [duplicateError, setDuplicateError] = useState(null);

  const scrollRef = useRef(0);

  // -----------------------------------------
  // MODULES LADEN
  // -----------------------------------------
  async function loadModules({ silent = false } = {}) {
    if (!silent) setLoading(true);

    // Wenn Supabase noch nicht bereit ist, abbrechen
    if (!supabase) {
      if (!silent) setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Falls kein User vorhanden ist (z.B. noch nicht eingeloggt),
    // keine Query gegen "modules" ausführen.
    if (!user) {
      if (!silent) setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("modules")
      .select("*")
      .eq("user_id", user.id)
      .order("subject");

    if (!error) {
      setModules(data || []);
    }

    if (!silent) setLoading(false);
  }

  useEffect(() => {
    loadModules();
  }, []);

  // Initial-Suche aus URL übernehmen (z.B. /modules?subject=...)
  useEffect(() => {
    const initialSubject = searchParams.get("subject");
    if (initialSubject) {
      setSearch(initialSubject);
    }
  }, [searchParams]);

  // -----------------------------------------
  // Hilfsfunktion: Scroll beibehalten
  // -----------------------------------------
  async function withPreservedScroll(action) {
    scrollRef.current = window.scrollY;

    await action();

    requestAnimationFrame(() => {
      window.scrollTo({
        top: scrollRef.current,
        left: 0,
        behavior: "instant",
      });
    });
  }

  // -----------------------------------------
  // SAVE MODULE (mit Duplicate-Check + scroll-stabil)
  // -----------------------------------------
  async function saveModule(mod) {
    const subject = mod.subject.trim();
    const description = mod.description.trim();

    if (!subject || !description) return;

    // Prüfen, ob ein anderes Modul mit gleichem Subject existiert (case-insensitive)
    const exists = modules.some(
      (m) =>
        m.id !== mod.id &&
        m.subject?.trim().toLowerCase() === subject.toLowerCase()
    );

    if (exists) {
      setDuplicateError({ mode: "edit", moduleId: mod.id });
      setSearch(subject); // Ansicht filtern, damit der vorhandene Eintrag sichtbar ist
      return;
    }

    setDuplicateError(null);

    await withPreservedScroll(async () => {
      const { error } = await supabase
        .from("modules")
        .update({
          subject,
          description,
        })
        .eq("id", mod.id);

      if (!error) {
        setSaveStatus({ [mod.id]: "success" });
      }

      // Hintergrund-Reload (ohne DOM neu zu bauen)
      loadModules({ silent: true });
    });
  }

  // -----------------------------------------
  // UNDO-LÖSCHEN
  // -----------------------------------------
  async function handleDelete(mod) {
    await withPreservedScroll(async () => {
      setUndoData(mod);

      // lokal entfernen (optimistisch)
      setModules((prev) => prev.filter((x) => x.id !== mod.id));
      setSaveStatus({});
      setShowUndo(true);

      // wirklich löschen
      await supabase.from("modules").delete().eq("id", mod.id);

      // Undo nach 5s automatisch weg
      setTimeout(() => {
        setShowUndo(false);
        setUndoData(null);
      }, 5000);
    });
  }

  async function undoDelete() {
    if (!undoData) return;

    await withPreservedScroll(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.error("Undo nicht möglich: kein Benutzer eingeloggt.");
        return;
      }

      const { error } = await supabase.from("modules").insert({
        // id NICHT setzen, damit Supabase/DB sie selbst generiert
        user_id: user.id,
        subject: undoData.subject,
        description: undoData.description,
      });

      if (error) {
        console.error("Undo fehlgeschlagen:", error);
        return;
      }

      setShowUndo(false);
      setUndoData(null);

      // neu laden
      loadModules({ silent: false });
    });
  }

  // -----------------------------------------
  // NEUES MODUL HINZUFÜGEN (mit Duplicate-Check)
  // -----------------------------------------
  async function addModule() {
    const subject = newSubject.trim();
    const description = newDescription.trim();

    if (!subject || !description) return;

    // Prüfen, ob Subject bereits existiert (case-insensitive)
    const exists = modules.some(
      (m) => m.subject?.trim().toLowerCase() === subject.toLowerCase()
    );

    if (exists) {
      setDuplicateError({ mode: "new" });
      setSearch(subject); // Ansicht wie Suche filtern
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error("Neues Modul kann nicht angelegt werden: kein Benutzer eingeloggt.");
      return;
    }

    await supabase.from("modules").insert({
      user_id: user.id,
      subject,
      description,
    });

    setNewSubject("");
    setNewDescription("");
    setDuplicateError(null);

    loadModules({ silent: false });
  }

  // -----------------------------------------
  // Fuzzy-Suche
  // -----------------------------------------
  const fuse = useMemo(() => {
    return new Fuse(modules, {
      keys: ["subject", "description"],
      threshold: 0.3,
    });
  }, [modules]);

  const filtered = useMemo(() => {
    if (!search.trim()) return modules;
    return fuse.search(search).map((x) => x.item);
  }, [search, fuse]);

  // -----------------------------------------
  // UI
  // -----------------------------------------

  return (
    <AuthGuard>
      <div style={{ padding: 40, color: "white" }}>
        <h1>Modul‑Verwaltung</h1>

        {/* Suchfeld */}
        <div style={{ marginTop: 20, marginBottom: 20 }}>
          <input
            placeholder="Modul suchen… (fuzzy)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 6,
              border: "1px solid #475569",
              background: "#0f172a",
              color: "white",
            }}
          />
        </div>

        {/* Neues Modul */}
        <div
          style={{
            marginTop: 20,
            background: "#1e293b",
            padding: 20,
            borderRadius: 8,
          }}
        >
          <h3>Neues Modul hinzufügen</h3>

          <input
            placeholder="Subject"
            value={newSubject}
            onChange={(e) => {
              setNewSubject(e.target.value);
              if (duplicateError?.mode === "new") setDuplicateError(null);
            }}
            style={{
              width: "100%",
              marginTop: 10,
              padding: 10,
              background: "#0f172a",
              borderRadius: 6,
              border:
                duplicateError?.mode === "new"
                  ? "1px solid #ef4444"
                  : "1px solid #475569",
              color: "white",
            }}
          />

          {duplicateError?.mode === "new" && (
            <div
              style={{
                marginTop: 8,
                color: "#ef4444",
                fontSize: 14,
              }}
            >
              ❌ Eintrag bereits vorhanden
            </div>
          )}

          <textarea
            placeholder="Beschreibung"
            value={newDescription}
            onChange={(e) => {
              setNewDescription(e.target.value);
              if (duplicateError?.mode === "new") setDuplicateError(null);
            }}
            style={{
              width: "100%",
              marginTop: 10,
              padding: 10,
              background: "#0f172a",
              borderRadius: 6,
              border: "1px solid #475569",
              color: "white",
              height: 100,
            }}
          />

          <button
            onClick={addModule}
            style={{
              marginTop: 10,
              background: "#22c55e",
              padding: "8px 14px",
              borderRadius: 6,
              color: "white",
              border: "none",
            }}
          >
            Hinzufügen
          </button>
        </div>

        {/* Module Liste */}
        <h2 style={{ marginTop: 40 }}>Meine Module</h2>

        {loading && <p>Lade…</p>}
        {!loading && filtered.length === 0 && <p>Keine Treffer.</p>}

        {!loading &&
          filtered.length > 0 &&
          filtered.map((mod) => {
            const saved = saveStatus[mod.id] === "success";
            const isDupError =
              duplicateError?.mode === "edit" &&
              duplicateError.moduleId === mod.id;

            return (
              <div
                key={mod.id}
                style={{
                  background: "#1e293b",
                  marginBottom: 10,
                  padding: 20,
                  borderRadius: 8,
                }}
              >
                {/* Subject */}
                <input
                  value={mod.subject}
                  onChange={(e) => {
                    setModules((prev) =>
                      prev.map((m) =>
                        m.id === mod.id
                          ? { ...m, subject: e.target.value }
                          : m
                      )
                    );
                    if (isDupError) setDuplicateError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveModule(mod);
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 6,
                    background: "#0f172a",
                    border: isDupError
                      ? "1px solid #ef4444"
                      : "1px solid #475569",
                    color: "white",
                  }}
                />

                {isDupError && (
                  <div
                    style={{
                      marginTop: 6,
                      color: "#ef4444",
                      fontSize: 14,
                    }}
                  >
                    ❌ Eintrag bereits vorhanden
                  </div>
                )}

                {/* Description */}
                <textarea
                  value={mod.description}
                  onChange={(e) => {
                    setModules((prev) =>
                      prev.map((m) =>
                        m.id === mod.id
                          ? { ...m, description: e.target.value }
                          : m
                      )
                    );
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      saveModule(mod);
                    }
                  }}
                  style={{
                    width: "100%",
                    marginTop: 10,
                    padding: 10,
                    borderRadius: 6,
                    background: "#0f172a",
                    border: "1px solid #475569",
                    color: "white",
                    height: 80,
                  }}
                />

                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    gap: 10,
                  }}
                >
                  <button
                    onClick={() => saveModule(mod)}
                    style={{
                      background: "#3b82f6",
                      padding: "6px 14px",
                      borderRadius: 6,
                      color: "white",
                      border: "none",
                    }}
                  >
                    Speichern
                  </button>

                  <button
                    onClick={() => handleDelete(mod)}
                    style={{
                      background: "#ef4444",
                      padding: "6px 14px",
                      borderRadius: 6,
                      color: "white",
                      border: "none",
                    }}
                  >
                    Löschen
                  </button>
                </div>

                {saved && (
                  <div
                    style={{
                      marginTop: 10,
                      color: "#4ade80",
                      background: "rgba(74, 222, 128, 0.1)",
                      padding: "6px 10px",
                      borderRadius: 6,
                    }}
                  >
                    ✔ Erfolgreich gespeichert
                  </div>
                )}
              </div>
            );
          })}

        {/* Undo Banner */}
        {showUndo && undoData && (
          <div
            style={{
              position: "fixed",
              bottom: 20,
              right: 20,
              background: "#1e293b",
              color: "white",
              padding: "14px 18px",
              borderRadius: 8,
              boxShadow: "0 0 12px rgba(0,0,0,0.5)",
              zIndex: 1000,
            }}
          >
            Modul gelöscht
            <button
              onClick={undoDelete}
              style={{
                marginLeft: 12,
                background: "#22c55e",
                padding: "6px 12px",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                color: "white",
              }}
            >
              Rückgängig
            </button>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}

export default function ModulesPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 40, color: "white" }}>Lade Module…</div>
      }
    >
      <ModulesPageInner />
    </Suspense>
  );
}