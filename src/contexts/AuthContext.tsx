import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  setPersistence,
  browserLocalPersistence,
  signInAnonymously
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

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
  loginAnonymously: () => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>; // Kept for compatibility, but largely handled by effect
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
    console.log("AuthContext: Mounting and checking auth state...");
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("AuthContext: Auth state changed. User:", firebaseUser ? firebaseUser.uid : "null");
      
      if (firebaseUser) {
        // Manually set loading true during fetch
        // setLoading(true); // Don't do this, it causes flicker
        
        try {
          // Fetch user details from Firestore
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            console.log("AuthContext: User found in Firestore");
            const data = userDoc.data() as Partial<User>;

            const nowIso = new Date().toISOString();
            const normalizedUser: User = {
              uid: data.uid ?? data.id ?? firebaseUser.uid,
              id: data.id ?? data.uid ?? firebaseUser.uid,
              email: (data.email ?? firebaseUser.email ?? '') || '',
              role: (data.role ?? 'user') as User['role'],
              name:
                data.name ??
                firebaseUser.displayName ??
                (firebaseUser.isAnonymous ? 'Guest' : undefined),
              createdAt: data.createdAt ?? nowIso,
              updatedAt: nowIso,
              lastLogin: nowIso,
              isAnonymous: data.isAnonymous ?? firebaseUser.isAnonymous,
            };

            // Ensure important fields exist / update lastLogin
            await setDoc(
              userDocRef,
              { ...normalizedUser, updatedAt: nowIso, lastLogin: nowIso },
              { merge: true }
            );

            setUser(normalizedUser);
          } else {
            console.log("AuthContext: User not found in Firestore, creating new profile");
            const nowIso = new Date().toISOString();
            const newUser: User = {
              uid: firebaseUser.uid,
              id: firebaseUser.uid,
              email: firebaseUser.email ?? '',
              role: 'user',
              name: firebaseUser.displayName ?? (firebaseUser.isAnonymous ? 'Guest' : undefined),
              createdAt: nowIso,
              updatedAt: nowIso,
              lastLogin: nowIso,
              isAnonymous: firebaseUser.isAnonymous,
            };
            await setDoc(userDocRef, newUser, { merge: true });
            setUser(newUser);
          }
        } catch (error) {
          console.error('AuthContext: Error fetching user details:', error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
        console.log("AuthContext: Unsubscribing from auth listener");
        unsubscribe();
    };
  }, []);

  const checkAuth = async () => {
    // No-op in Firebase implementation as onAuthStateChanged handles it
  };

  const loginWithGoogle = async () => {
    try {
      await setPersistence(auth, browserLocalPersistence);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      // Switch back to popup for better localhost reliability
      const result = await signInWithPopup(auth, provider);
      console.log("AuthContext: Popup login success", result.user.uid);
    } catch (error) {
      console.error("Error initiating google login:", error);
      throw error;
    }
  };

  const loginAnonymously = async () => {
    try {
      await setPersistence(auth, browserLocalPersistence);
      const result = await signInAnonymously(auth);
      console.log("AuthContext: Anonymous login success", result.user.uid);
    } catch (error) {
      console.error("Error initiating anonymous login:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      router.push('/auth');
    } catch (error) {
      console.error('Logout failed:', error);
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

  const value = {
    user,
    loading,
    loginWithGoogle,
    loginAnonymously,
    logout,
    checkAuth,
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
