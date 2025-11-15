import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
  type UserCredential
} from 'firebase/auth';
import { doc, onSnapshot, type DocumentData } from 'firebase/firestore';

import { auth, db } from '../lib/firebase';

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
  login: (params: { email: string; password: string; rememberMe?: boolean }) => Promise<UserCredential>;
  signup: (params: { email: string; password: string }) => Promise<UserCredential>;
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
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      setProfileError(null);
      return;
    }

    setProfileLoading(true);
    setProfileError(null);

    const profileRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(
      profileRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as DocumentData;
          setProfile({ id: snapshot.id, ...(data as Record<string, unknown>) });
        } else {
          setProfile(null);
        }
        setProfileLoading(false);
      },
      (error) => {
        console.error('Failed to subscribe to user profile', error);
        setProfile(null);
        setProfileError(error.message);
        setProfileLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const login = async ({ email, password, rememberMe = true }: { email: string; password: string; rememberMe?: boolean }) => {
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);

    return signInWithEmailAndPassword(auth, email, password);
  };

  const signup = async ({ email, password }: { email: string; password: string }) => {
    await setPersistence(auth, browserLocalPersistence);

    return createUserWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
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

