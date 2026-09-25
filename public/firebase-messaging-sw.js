/*
 * Handles web push while the app is closed or in a background tab.
 *
 * Service workers cannot use ES module imports or environment variables, so the
 * Firebase config is inlined here. These values are public by design; they are
 * the same ones shipped in the client bundle.
 */
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyA0sg2GK_kKEmUkjd26EKRc1foejYkPR1Y",
  authDomain: "small-giants-opsp-2025.firebaseapp.com",
  projectId: "small-giants-opsp-2025",
  storageBucket: "small-giants-opsp-2025.firebasestorage.app",
  messagingSenderId: "10058852488",
  appId: "1:10058852488:web:437904efdfb4ee01ab973d",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  const url = (payload.data && payload.data.url) || "/";

  self.registration.showNotification(title || "Small Giants OPSP", {
    body: body || "",
    icon: "/icon-192.png",
    data: { url },
    tag: (payload.data && payload.data.goalId) || undefined,
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  // Reuse an already-open tab rather than stacking up new ones.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
