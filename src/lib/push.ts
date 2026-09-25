import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { app, db } from "@/lib/firebase";

/**
 * Public VAPID key from Firebase Console, Cloud Messaging, Web configuration.
 * Without it the browser cannot mint a token, so push registration is simply
 * unavailable rather than broken.
 */
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "";

export type PushSupport =
  | { supported: true }
  | { supported: false; reason: string };

export function checkPushSupport(): PushSupport {
  if (typeof window === "undefined") {
    return { supported: false, reason: "Push is only available in the browser." };
  }
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return { supported: false, reason: "This browser does not support web push." };
  }
  if (!VAPID_KEY) {
    return {
      supported: false,
      reason: "Push is not configured yet. An admin needs to set NEXT_PUBLIC_FIREBASE_VAPID_KEY.",
    };
  }
  return { supported: true };
}

/**
 * Asks for permission, registers the service worker, and stores the resulting
 * token keyed by its own value so re-registering the same browser is a no-op.
 */
export async function enablePush(userId: string): Promise<string> {
  const support = checkPushSupport();
  if (!support.supported) throw new Error(support.reason);

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked for this site. Re-enable them in your browser settings."
        : "Notification permission was dismissed."
    );
  }

  // Imported lazily: the messaging bundle is dead weight for anyone who never
  // turns push on.
  const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) {
    throw new Error("This browser does not support Firebase Cloud Messaging.");
  }

  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const token = await getToken(getMessaging(app), {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });

  if (!token) throw new Error("The browser did not return a push token.");

  await setDoc(doc(db, "users", userId, "pushTokens", token), {
    createdAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
  });

  return token;
}

export async function disablePush(userId: string, token: string): Promise<void> {
  await deleteDoc(doc(db, "users", userId, "pushTokens", token));
}

/** Foreground messages do not fire the service worker, so surface them in-app. */
export async function listenForForegroundPush(
  handler: (payload: { title: string; body: string; url?: string }) => void
): Promise<() => void> {
  const { getMessaging, onMessage, isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) return () => undefined;

  return onMessage(getMessaging(app), (payload) => {
    handler({
      title: payload.notification?.title ?? "Small Giants OPSP",
      body: payload.notification?.body ?? "",
      url: payload.data?.url,
    });
  });
}
