"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { AppNotification } from "@/types";

/** Enough for a dropdown; the inbox is not an archive. */
const PAGE_SIZE = 50;

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      query(
        collection(db, "users", user.uid, "notifications"),
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE)
      ),
      (snapshot) => {
        setNotifications(
          snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as AppNotification)
        );
        setLoading(false);
      },
      () => setLoading(false)
    );

    return unsubscribe;
  }, [user?.uid]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const markRead = useCallback(
    async (notificationId: string) => {
      if (!user?.uid) return;
      await updateDoc(
        doc(db, "users", user.uid, "notifications", notificationId),
        { read: true }
      );
    },
    [user?.uid]
  );

  const markAllRead = useCallback(async () => {
    if (!user?.uid) return;
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    const batch = writeBatch(db);
    unread.forEach((n) =>
      batch.update(doc(db, "users", user.uid, "notifications", n.id), { read: true })
    );
    await batch.commit();
  }, [notifications, user?.uid]);

  const dismiss = useCallback(
    async (notificationId: string) => {
      if (!user?.uid) return;
      await deleteDoc(doc(db, "users", user.uid, "notifications", notificationId));
    },
    [user?.uid]
  );

  return { notifications, unreadCount, loading, markRead, markAllRead, dismiss };
}
