"use client";

import React from "react";
import { useLoading } from "@/contexts/loading-context";
import { Loader2 } from "lucide-react";

export default function LoadingIndicator() {
  const { isLoading, isPageTransition } = useLoading();

  if (!isLoading) return null;

  // Content-only loading for page transitions (preserves sidebar)
  if (isPageTransition) {
    return (
      <div className="fixed top-0 left-[240px] right-0 bottom-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 text-[#228B22] animate-spin mx-auto" />
          <p className="mt-2 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // Simple top bar loading for API calls
  return (
    <div className="fixed top-0 right-0 z-50 mr-4 mt-4">
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg px-3 py-1 flex items-center space-x-2">
        <Loader2 className="h-4 w-4 text-[#228B22] animate-spin" />
        <span className="text-sm font-medium">Loading...</span>
      </div>
    </div>
  );
}