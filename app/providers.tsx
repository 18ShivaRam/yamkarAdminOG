"use client";

import React from "react";
import { AuthProvider } from "@/contexts/auth-context";
import { Toaster } from "@/components/ui/toaster";
import dynamic from "next/dynamic";
import { LoadingProvider } from "@/contexts/loading-context";

// Import LoadingIndicator with no SSR to avoid hydration issues
const LoadingIndicator = dynamic(() => import("@/components/LoadingIndicator"), {
  ssr: false,
});

export default function Providers({ children, session }: { children: React.ReactNode, session: any }) {
  return (
    <AuthProvider session={session}>
      <LoadingProvider>
        <LoadingIndicator />
        {children}
        <Toaster />
      </LoadingProvider>
    </AuthProvider>
  );
}
