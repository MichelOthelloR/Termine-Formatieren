import "./globals.css";
import Link from "next/link";
import SupabaseProvider from "../components/SupabaseProvider";
import Header from "../components/Header";

export const metadata = {
  title: "Termin‑Formatierer Pro",
  description: "Mini‑SaaS für Formatierung und Datenanreicherung",
};

export default function RootLayout({ children }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body>
        <SupabaseProvider>
          <Header />
          <main>{children}</main>
          <footer
            style={{
              marginTop: 40,
              padding: "16px 24px",
              borderTop: "1px solid #1f2937",
              background: "#020617",
              color: "#9ca3af",
              fontSize: 12,
            }}
          >
            <div
              style={{
                maxWidth: 1200,
                margin: "0 auto",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span>© {new Date().getFullYear()} Termin‑Formatierer Pro</span>
              <Link
                href="/impressum"
                style={{ color: "#e5e7eb", textDecoration: "none" }}
              >
                Impressum
              </Link>
            </div>
          </footer>
        </SupabaseProvider>
      </body>
    </html>
  );
}