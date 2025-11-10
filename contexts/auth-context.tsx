"use client";

import type React from "react";
import type { User } from "@/types";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { createContext, useContext, useState, useEffect } from "react";

interface AuthContextType {
  user: User | null;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children, session }: { children: React.ReactNode, session: any }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  
  // Check for existing session on mount and page refresh
  useEffect(() => {
    const checkSession = async () => {
      try {
        setIsLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const { data: userProfile } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
          setUser(userProfile as User | null);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Error checking session:", error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkSession();
  }, []);
  
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const fetchUserProfile = async () => {
          const { data: userProfile } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
          setUser(userProfile as User | null);
        };
        fetchUserProfile();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (phone: string, password: string) => {
    setIsLoading(true);
    try {
      // Create pseudo-email from phone
      const pseudoEmail = `${phone}@pseudo.local`;

      const { data, error } = await supabase.auth.signInWithPassword({
        email: pseudoEmail,
        password: password,
      });

      if (error) {
        console.error("Error signing in:", error);
        throw error;
      }

      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        console.error("Error fetching user profile:", profileError);
        throw profileError;
      }

      // Block deleted users
      if (userProfile.is_deleted !== false) {
        await supabase.auth.signOut();
        throw new Error("Your account has been deleted or disabled. Please contact your administrator.");
      }

      // Check if user is approved
      if (userProfile.status !== 'approved') {
        // Sign out the user if not approved
        await supabase.auth.signOut();
        throw new Error("Your account is pending admin approval. Please wait for approval before logging in.");
      }

      // Check if user role is admin
      if (userProfile.role !== 'admin') {
        console.error("Login attempt by non-admin user:", userProfile.email);
        await supabase.auth.signOut(); // Ensure non-admin users are signed out
        throw new Error("Access denied. Only administrators can log in to the web portal.");
      }

      // Proceed with login for admin users
      setUser(userProfile);
      
      // Use replace instead of push to avoid back navigation issues
      // Add a small delay to ensure state is updated before navigation
      await new Promise(resolve => setTimeout(resolve, 100));
      router.replace(`/${userProfile.role}`); // Should always be '/admin' now
    } catch (error: any) {
      console.error("Error during login process:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.replace('/');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
