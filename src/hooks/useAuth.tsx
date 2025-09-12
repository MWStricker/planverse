import React, { useState, useEffect, createContext, useContext } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      
      console.log('Initial session check:', session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // Remove loading dependency to prevent infinite re-renders

  const signOut = async () => {
    console.log('useAuth signOut called');
    console.log('Current session before signout:', session);
    console.log('Current user before signout:', user);
    
    try {
      console.log('Calling supabase.auth.signOut()...');
      const { error } = await supabase.auth.signOut();
      console.log('Supabase signOut response:', { error });
      
      if (error) {
        console.error('Sign out error:', error);
        // Clear local state even if signOut fails
        setSession(null);
        setUser(null);
        // Force redirect to auth page
        console.log('Redirecting to /auth due to error...');
        window.location.href = '/auth';
        return;
      }
      
      // Clear local state on successful signout
      console.log('Sign out successful, clearing state...');
      setSession(null);
      setUser(null);
      
      // Navigate to auth page
      console.log('Redirecting to /auth...');
      window.location.href = '/auth';
    } catch (error) {
      console.error('Unexpected sign out error:', error);
      // Force clear session and redirect
      setSession(null);
      setUser(null);
      console.log('Redirecting to /auth due to unexpected error...');
      window.location.href = '/auth';
    }
  };

  const value = {
    user,
    session,
    loading,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};