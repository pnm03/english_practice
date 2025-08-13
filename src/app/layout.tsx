import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider } from "@/components/LanguageProvider";
import Header from "@/components/Header";
import AppShell from "@/components/AppShell";
import { ToastProvider } from "@/components/ToastProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CSLD English",
  description: "Vocabulary learning app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
        {/* @ts-expect-error Async Server Component */}
        <Header />
        <LanguageProvider>
          <ThemeProvider>
            <ToastProvider>
              {/* @ts-expect-error Server Component */}
              <AppShell>
                <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
              </AppShell>
            </ToastProvider>
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
