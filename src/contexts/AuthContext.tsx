import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

type UserProfile = {
  id: string;
  role?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  [key: string]: unknown;
} | null;

type AuthContextValue = {
  user: User | null;
  initializing: boolean;
  profile: UserProfile;
  profileLoading: boolean;
  profileError: string | null;
  login: (params: { email: string; password: string; rememberMe?: boolean }) => Promise<any>;
  signup: (params: { email: string; password: string }) => Promise<any>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [profile, setProfile] = useState<UserProfile>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setInitializing(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setInitializing(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      setProfileError(null);
      return;
    }

    const fetchProfile = async () => {
        setProfileLoading(true);
        setProfileError(null);

        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

        if (error) {
            console.error('Failed to fetch user profile', error);
            setProfile(null);
            setProfileError(error.message);
        } else {
            setProfile({
                id: data.id,
                role: data.role,
                email: data.email,
                firstName: data.full_name?.split(' ')[0] || '',
                lastName: data.full_name?.split(' ').slice(1).join(' ') || '',
                ...data
            });
        }
        setProfileLoading(false);
    };

    fetchProfile();
  }, [user]);

  const login = async ({ email, password }: { email: string; password: string; rememberMe?: boolean }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    if (error) throw error;
    return data;
  };

  const signup = async ({ email, password }: { email: string; password: string }) => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const value = useMemo(
    () => ({
      user,
      initializing,
      profile,
      profileLoading,
      profileError,
      login,
      signup,
      logout
    }),
    [user, initializing, profile, profileLoading, profileError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

