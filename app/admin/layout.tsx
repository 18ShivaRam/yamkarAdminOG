"use client";

import type React from "react";
import SidebarComponent from "@/components/layout/sidebar";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { User } from "@/types";
import { useAuth } from "@/contexts/auth-context";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({
  children,
}: AdminLayoutProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    // Don't do anything while still loading
    if (isLoading) {
      return;
    }

    // Block if not admin or if user is marked as deleted/disabled
    if (!user || user.role !== "admin" || (user as any).is_deleted !== false) {
      router.replace("/");
    }
  }, [router, user, isLoading]);

  // Show loading state while authentication is being checked
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <svg className="animate-spin h-8 w-8 text-[#228B22]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
        </svg>
        <span className="ml-2 text-lg">Loading...</span>
      </div>
    );
  }

  // Don't render access denied immediately - let the redirect happen
  if (!user || user.role !== "admin" || (user as any).is_deleted !== false) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F8F8FF]">
      <SidebarComponent userRole="admin" userName={user?.name || "Admin User"} />
      <div className="md:pl-64 flex flex-col min-h-screen">
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
