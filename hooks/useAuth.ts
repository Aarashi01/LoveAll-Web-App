import { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  type AuthError,
  type User,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { auth, db } from '@/lib/firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const getErrorMessage = (value: unknown) => {
    const authError = value as AuthError;
    return authError?.message ?? 'Authentication error';
  };

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(getErrorMessage(err));
      throw err;
    }
  };

  const register = async (email: string, password: string, displayName?: string) => {
    setError(null);
    try {
      const credentials = await createUserWithEmailAndPassword(auth, email, password);

      if (displayName?.trim()) {
        await updateProfile(credentials.user, { displayName: displayName.trim() });
      }

      await setDoc(doc(db, 'users', credentials.user.uid), {
        id: credentials.user.uid,
        email,
        displayName: displayName?.trim() || credentials.user.email || 'Organizer',
        role: 'organizer',
        createdAt: serverTimestamp(),
        tournamentIds: [],
      });
    } catch (err) {
      setError(getErrorMessage(err));
      throw err;
    }
  };

  const loginAnonymously = async () => {
    setError(null);
    try {
      await signInAnonymously(auth);
    } catch (err) {
      setError(getErrorMessage(err));
      throw err;
    }
  };

  const logout = async () => {
    setError(null);
    try {
      await signOut(auth);
    } catch (err) {
      setError(getErrorMessage(err));
      throw err;
    }
  };

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    register,
    loginAnonymously,
    logout,
  };
}
