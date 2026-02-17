"use client";

import { createContext, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export const SupabaseContext = createContext(null);

export default function SupabaseProvider({ children }) {
  // Wichtig: Den Client erst im Browser initialisieren.
  // Sonst wird beim Prerender/Build versucht, Supabase ohne ENV zu initialisieren.
  const [supabase, setSupabase] = useState(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Supabase spricht i.d.R. vom "anon key". Manche Setups nennen ihn "publishable".
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      console.error(
        "[SupabaseProvider] Fehlende NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY"
      );
      return;
    }

    setSupabase(createBrowserClient(url, key));
  }, []);

  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  );
}