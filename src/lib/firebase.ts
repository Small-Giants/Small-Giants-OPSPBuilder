import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyA0sg2GK_kKEmUkjd26EKRc1foejYkPR1Y",
  authDomain: "small-giants-opsp-2025.firebaseapp.com",
  projectId: "small-giants-opsp-2025",
  storageBucket: "small-giants-opsp-2025.firebasestorage.app",
  messagingSenderId: "10058852488",
  appId: "1:10058852488:web:437904efdfb4ee01ab973d"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
// const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

export { app, auth, db };

