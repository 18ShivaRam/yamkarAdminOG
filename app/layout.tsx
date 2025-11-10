import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase'
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Providers from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Yamkar - Employee Management System",
    template: "%s | Yamkar",
  },
  description: "A comprehensive employee management system for agricultural businesses",
  keywords: ["employee management", "agriculture", "farmer data", "field operations"],
  authors: [{ name: "Yamkar" }],
  creator: "Yamkar",
  publisher: "Yamkar",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  robots: {
    index: false,
    follow: false,
  },
  generator: 'v0.dev'
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  const cookieStore = cookies()
  const supabase = createClient(cookieStore)
  const { data: { session } } = await supabase.auth.getSession()

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers session={session}>
          {children}
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}