"use client";

import { createContext, useMemo } from "react";
import { createBrowserClient } from "@supabase/ssr";

export const SupabaseContext = createContext(null);

export default function SupabaseProvider({ children }) {
  const supabase = useMemo(() => {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY // WICHTIG!
    );
  }, []);

  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  );
}