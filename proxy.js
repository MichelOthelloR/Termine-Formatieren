// proxy.js (Projekt-Root)
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(req) {
  const res = NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[proxy] Fehlende ENV Variablen");
    return res;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      // Wichtig: getAll/setAll verwenden (nicht get/set/remove),
      // sonst werden bei großen Sessions nicht alle Cookie-Chunks gelesen
      // und der Proxy "sieht" die Session nicht -> Redirect-Loop trotz Login.
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  const { pathname, searchParams } = req.nextUrl;
  const isAuthRoute = pathname.startsWith("/auth");

  // Session prüfen (Cookie-basiert)
  const { data: { session } } = await supabase.auth.getSession();

  // 1) Ungeloggt auf geschützten Seiten -> Login
  if (!session && !isAuthRoute) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirectedFrom", pathname || "/");
    // Optional: Query-Parameter weiterreichen
    for (const [k, v] of searchParams.entries()) {
      url.searchParams.append(`from_${k}`, v);
    }
    return NextResponse.redirect(url);
  }

  // 2) Eingeloggt auf /auth/* -> zurück zur Startseite
  if (session && isAuthRoute) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  // schützen: Startseite (Formatierer) & Module
  matcher: ["/", "/modules/:path*"],
};