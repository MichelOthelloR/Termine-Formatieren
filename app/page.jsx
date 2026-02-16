"use client";

import AuthGuard from "../components/AuthGuard";
import Formatierer from "../components/Formatierer";

export default function Home() {
  // AuthGuard sorgt dafür, dass anonyme Nutzer nach /auth/login
  // umgeleitet werden, bevor sie überhaupt die Eingabefelder sehen.
  return (
    <AuthGuard>
      <div
        style={{
          minHeight: "calc(100vh - 56px)",
          padding: 20,
          paddingTop: 12,
        }}
      >
        <Formatierer />
      </div>
    </AuthGuard>
  );
}