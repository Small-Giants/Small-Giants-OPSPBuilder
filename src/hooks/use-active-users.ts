"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";

export interface ActiveUser {
  id: string;
  name?: string;
  email?: string;
}

export function useActiveUsers() {
  const [users, setUsers] = useState<ActiveUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const active: ActiveUser[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (!data.deletedAt) {
            active.push({
              id: docSnap.id,
              name: data.name,
              email: data.email,
            });
          }
        });
        active.sort((a, b) =>
          (a.name || a.email || "").localeCompare(b.name || b.email || "")
        );
        setUsers(active);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  return { users, loading };
}
