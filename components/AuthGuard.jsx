"use client";

import { useContext, useEffect, useState } from "react";
import { SupabaseContext } from "./SupabaseProvider";
import { useRouter } from "next/navigation";

export default function AuthGuard({ children }) {
  const supabase = useContext(SupabaseContext);
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function check() {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();

      if (!mounted) return;

      if (!data?.session) {
        router.replace("/auth/login");
      } else {
        setChecked(true);
      }
    }

    check();

    if (!supabase) return () => {};

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!mounted) return;
      if (!session) router.replace("/auth/login");
      else setChecked(true);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [supabase, router]);

  if (!checked) return null; // Optional: "Lade…" anzeigen
  return children;
}