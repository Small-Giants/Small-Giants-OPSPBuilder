"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

// Allowed email domain for Google sign-in
const ALLOWED_DOMAIN = 'smallgiantsonline.com';

// Emails that should automatically be granted superadmin role
const SUPERADMIN_EMAILS = [
  'patrick@smallgiantsonline.com',
  'danielle@smallgiantsonline.com',
  'jenns@smallgiantsonline.com',
];

export interface User {
  // Canonical user id used across the app
  uid: string;
  // Legacy field kept for compatibility with existing Firestore docs/components
  id?: string;
  email: string;
  name?: string;
  role: 'superadmin' | 'admin' | 'user';
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string;
  isAnonymous?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateUserProfile: (updates: Partial<Pick<User, 'name'>>) => void;
  isAuthenticated: boolean;
  hasRole: (requiredRole: 'superadmin' | 'admin' | 'user') => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Check if user is authenticated on mount using Firebase observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Fetch user details from Firestore
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const data = userDoc.data() as Partial<User> & { deletedAt?: string };

            // Check if user has been deleted (soft delete)
            if (data.deletedAt) {
              await signOut(auth);
              setUser(null);
              setLoading(false);
              return;
            }

            const nowIso = new Date().toISOString();
            const userEmail = (data.email ?? firebaseUser.email ?? '').toLowerCase();
            
            // Check if user should be auto-granted superadmin
            const isSuperadminEmail = SUPERADMIN_EMAILS.includes(userEmail);
            const role = isSuperadminEmail ? 'superadmin' : (data.role ?? 'user') as User['role'];
            
            const normalizedUser: User = {
              uid: data.uid ?? data.id ?? firebaseUser.uid,
              id: data.id ?? data.uid ?? firebaseUser.uid,
              email: userEmail,
              role: role,
              name:
                data.name ??
                firebaseUser.displayName ??
                (firebaseUser.isAnonymous ? 'Guest' : undefined),
              createdAt: data.createdAt ?? nowIso,
              updatedAt: nowIso,
              lastLogin: nowIso,
              isAnonymous: data.isAnonymous ?? firebaseUser.isAnonymous,
            };

            // Ensure important fields exist / update lastLogin (and role if superadmin)
            await setDoc(
              userDocRef,
              { ...normalizedUser, updatedAt: nowIso, lastLogin: nowIso },
              { merge: true }
            );

            setUser(normalizedUser);
          } else {
            const nowIso = new Date().toISOString();
            const userEmail = (firebaseUser.email ?? '').toLowerCase();
            
            // Check if new user should be auto-granted superadmin
            const isSuperadminEmail = SUPERADMIN_EMAILS.includes(userEmail);
            
            const newUser: User = {
              uid: firebaseUser.uid,
              id: firebaseUser.uid,
              email: userEmail,
              role: isSuperadminEmail ? 'superadmin' : 'user',
              name: firebaseUser.displayName ?? (firebaseUser.isAnonymous ? 'Guest' : undefined),
              createdAt: nowIso,
              updatedAt: nowIso,
              lastLogin: nowIso,
              isAnonymous: firebaseUser.isAnonymous,
            };
            await setDoc(userDocRef, newUser, { merge: true });
            setUser(newUser);
          }
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const checkAuth = async () => {
    // No-op in Firebase implementation as onAuthStateChanged handles it
  };

  const loginWithGoogle = async () => {
    await setPersistence(auth, browserLocalPersistence);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account',
      hd: ALLOWED_DOMAIN // Hint to show only accounts from this domain
    });
    
    const result = await signInWithPopup(auth, provider);
    
    // Verify the user's email domain
    const email = result.user.email;
    if (!email || !email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      // Sign out the user immediately if not from allowed domain
      await signOut(auth);
      throw new Error(`Access restricted to @${ALLOWED_DOMAIN} accounts only.`);
    }
    
    // Check if user has been deleted
    const userDocRef = doc(db, 'users', result.user.uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      const data = userDoc.data();
      if (data.deletedAt) {
        await signOut(auth);
        throw new Error('Your account has been deactivated. Please contact an administrator.');
      }
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      router.push('/auth');
    } catch {
      // Logout failed silently
    }
  };

  const hasRole = (requiredRole: 'superadmin' | 'admin' | 'user'): boolean => {
    if (!user) return false;
    
    const roleHierarchy = {
      'superadmin': 3,
      'admin': 2,
      'user': 1
    };
    
    const userLevel = roleHierarchy[user.role] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;
    
    return userLevel >= requiredLevel;
  };

  // Update local user state after profile changes (e.g., name update)
  const updateUserProfile = (updates: Partial<Pick<User, 'name'>>) => {
    if (user) {
      setUser({ ...user, ...updates });
    }
  };

  const value = {
    user,
    loading,
    loginWithGoogle,
    logout,
    checkAuth,
    updateUserProfile,
    isAuthenticated: !!user,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
