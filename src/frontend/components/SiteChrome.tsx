"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import NavBar from "@/frontend/components/NavBar";

/**
 * Routes whose page component already renders its own full-screen header/nav
 * (RaktJaal home, AuthPage, ProfilePage, ActionPage). Wrapping these in the
 * generic site NavBar + max-w-3xl/padded <main> would double up navigation
 * and squash their intentionally full-bleed designs, so they render as-is.
 * /request and /donor/signup are now thin redirects into /action (see those
 * files) and are included here too, so the redirect itself never flashes
 * the old NavBar before bouncing.
 */
const FULL_BLEED_ROUTES = new Set([
  "/", "/login", "/register", "/profile", "/action", "/request", "/donor/signup",
]);

export default function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (FULL_BLEED_ROUTES.has(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </>
  );
}
