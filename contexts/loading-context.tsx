"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type LoadingContextType = {
  isLoading: boolean;
  isPageTransition: boolean; // Add flag for page transitions
  startLoading: () => void;
  stopLoading: () => void;
};

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPageTransition, setIsPageTransition] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track previous path to detect navigation
  const [prevPathname, setPrevPathname] = useState(pathname);

  const startLoading = () => setIsLoading(true);
  const stopLoading = () => setIsLoading(false);

  // Handle route changes
  useEffect(() => {
    if (prevPathname !== pathname) {
      startLoading();
      setIsPageTransition(true);
      setPrevPathname(pathname);
      
      // Shorter timeout for better responsiveness (800ms)
      const normalTimer = setTimeout(() => {
        stopLoading();
        setIsPageTransition(false);
      }, 800);
      
      // Safety timeout to prevent stuck loading state
      const safetyTimer = setTimeout(() => {
        stopLoading();
        setIsPageTransition(false);
      }, 1500);
      
      return () => {
        clearTimeout(normalTimer);
        clearTimeout(safetyTimer);
      };
    }
  }, [pathname, prevPathname]);

  // Handle link clicks for navigation
  useEffect(() => {
    const handleLinkClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      if (
        link &&
        link.href &&
        link.href.startsWith(window.location.origin) &&
        !link.target &&
        !(e as MouseEvent).ctrlKey &&
        !(e as MouseEvent).metaKey
      ) {
        startLoading();
      }
    };

    document.addEventListener('click', handleLinkClick);
    return () => document.removeEventListener('click', handleLinkClick);
  }, []);

  // Handle API calls with fetch - improved for faster response
  useEffect(() => {
    const originalFetch = window.fetch;
    let activeRequests = 0;

    window.fetch = async (...args) => {
      startLoading();
      activeRequests++;
      
      try {
        const response = await originalFetch(...args);
        
        // Force stop loading immediately when response is received
        activeRequests--;
        stopLoading();
        setIsPageTransition(false);
        
        return response;
      } catch (error) {
        activeRequests--;
        stopLoading();
        setIsPageTransition(false);
        throw error;
      }
    };

    // Save original XMLHttpRequest open and send methods
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    const originalXhrSend = XMLHttpRequest.prototype.send;

    // Override XMLHttpRequest to track loading state
    XMLHttpRequest.prototype.open = function(...args) {
      this._url = args[1];
      return originalXhrOpen.apply(this, args);
    };

    XMLHttpRequest.prototype.send = function(...args) {
      if (this._url && typeof this._url === 'string') {
        startLoading();
        
        // Add event listeners to track when request completes
        this.addEventListener('loadend', () => {
          stopLoading();
        });
      }
      return originalXhrSend.apply(this, args);
    };

    // Safety timeout to prevent stuck loading state
    let safetyTimer: NodeJS.Timeout | null = null;
    
    if (isLoading) {
      safetyTimer = setTimeout(() => {
        stopLoading();
      }, 8000); // 8 second maximum loading time
    }

    return () => {
      // Restore original fetch and XMLHttpRequest methods
      window.fetch = originalFetch;
      XMLHttpRequest.prototype.open = originalXhrOpen;
      XMLHttpRequest.prototype.send = originalXhrSend;
      
      // Clear safety timer
      if (safetyTimer) clearTimeout(safetyTimer);
    };
  }, [isLoading]);

  return (
    <LoadingContext.Provider value={{ isLoading, isPageTransition, startLoading, stopLoading }}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error("useLoading must be used within a LoadingProvider");
  }
  return context;
}