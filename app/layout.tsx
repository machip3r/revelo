import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SessionRoot } from "@/components/SessionRoot";
import { ToastProvider } from "@/components/Toast";
import Script from "next/script";
import "./globals.css";

const THEME_INIT = `!function(){try{var t=localStorage.getItem('revelo-theme');if(t==='light')document.documentElement.classList.remove('dark');else if(t==='dark')document.documentElement.classList.add('dark');else if(window.matchMedia('(prefers-color-scheme: light)').matches)document.documentElement.classList.remove('dark');else document.documentElement.classList.add('dark');}catch(e){document.documentElement.classList.add('dark');}}();`;

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
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-full flex flex-col bg-canvas text-foreground antialiased transition-colors duration-200`}
        suppressHydrationWarning
      >
        <Script id="revelo-theme-init" strategy="beforeInteractive">
          {THEME_INIT}
        </Script>
        <div className="pointer-events-none fixed right-4 top-4 z-[100]">
          <div className="pointer-events-auto">
            <ThemeToggle />
          </div>
        </div>
        <SessionRoot>
          <ToastProvider>{children}</ToastProvider>
        </SessionRoot>
      </body>
    </html>
  );
}
