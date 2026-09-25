import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
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
const functions = getFunctions(app, "us-central1");
// const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

// Opt-in so a normal `next dev` still talks to the deployed backend.
if (
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_USE_EMULATORS === "true"
) {
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

export { app, auth, db, functions };

