"use client";

import { createContext, useMemo } from "react";
import { createBrowserClient } from "@supabase/ssr";

export const SupabaseContext = createContext(null);

export default function SupabaseProvider({ children }) {
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Supabase spricht in der Regel vom "anon key". Manche Setups nennen ihn "publishable".
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    return createBrowserClient(
      url,
      key
    );
  }, []);

  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  );
}