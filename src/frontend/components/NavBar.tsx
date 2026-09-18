"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/frontend/hooks/useAuth";
import { signOutUser } from "@/backend/lib/auth";

export default function NavBar() {
  const { user, loading } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOutUser();
    router.push("/");
  }

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold text-blood-600">
          RaktJaal
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/request" className="text-gray-600 hover:text-blood-600">
            Need blood
          </Link>
          <Link href="/donor/signup" className="text-gray-600 hover:text-blood-600">
            Become a donor
          </Link>
          {loading ? null : user ? (
            <>
              <span className="hidden text-gray-500 sm:inline">
                {user.displayName ?? user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-blood-600 px-3 py-1.5 text-white hover:bg-blood-700"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
