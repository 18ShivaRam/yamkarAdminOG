"use client";

import { useState, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function NavigationLoader() {
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Store the previous path to detect navigation
  const [prevPathname, setPrevPathname] = useState(pathname);
  
  useEffect(() => {
    // If the path changed, show loading
    if (prevPathname !== pathname) {
      setLoading(true);
      
      // Hide loading after a short delay to simulate loading completion
      const timer = setTimeout(() => {
        setLoading(false);
      }, 800);
      
      // Update the previous path
      setPrevPathname(pathname);
      
      return () => clearTimeout(timer);
    }
  }, [pathname, prevPathname]);
  
  // Also detect navigation via link clicks
  useEffect(() => {
    const handleClick = (e) => {
      const link = e.target.closest('a');
      if (link && 
          link.href && 
          link.href.startsWith(window.location.origin) && 
          !link.target && 
          !e.ctrlKey && 
          !e.metaKey) {
        setLoading(true);
      }
    };
    
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);
  
  // Auto-hide after 3 seconds to prevent stuck loader
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        setLoading(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [loading]);

  if (!loading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center">
      <div className="bg-white shadow-md rounded-b-lg px-4 py-2 flex items-center space-x-2">
        <Loader2 className="h-5 w-5 text-[#228B22] animate-spin" />
        <span className="text-sm font-medium">Loading...</span>
      </div>
    </div>
  );
}