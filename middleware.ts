import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  // Next empfiehlt in Middleware ein "response" Objekt zu verwenden,
  // damit Supabase Cookie-Updates korrekt zurückgeschrieben werden können.
  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    // Serverseitig lieber ohne NEXT_PUBLIC, aber anon key ist per Design nicht geheim.
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          res.cookies.set(name, value, options);
        }
      },
    },
  });

  const { pathname, searchParams } = req.nextUrl;
  const isAuthRoute = pathname.startsWith("/auth");

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // 1) Ungeloggt auf geschützten Seiten -> Login
  if (!session && !isAuthRoute) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirectedFrom", pathname || "/");
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
  matcher: ["/", "/modules/:path*"],
};

