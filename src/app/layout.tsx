import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/frontend/hooks/useAuth";
import SiteChrome from "@/frontend/components/SiteChrome";

export const metadata: Metadata = {
  title: "RaktJaal — 30-second donor matches",
  description: "From social media chaos to 30-second blood donor matches.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 font-sans antialiased">
        <AuthProvider>
          <SiteChrome>{children}</SiteChrome>
        </AuthProvider>
      </body>
    </html>
  );
}
