import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionRoot } from "@/components/SessionRoot";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Revelo — Multiplayer deduction",
  description: "Real-time shape & color deduction for 4–6 players.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-full flex flex-col bg-zinc-950 text-zinc-100 antialiased`}
        suppressHydrationWarning
      >
        <SessionRoot>
          <ToastProvider>{children}</ToastProvider>
        </SessionRoot>
      </body>
    </html>
  );
}
