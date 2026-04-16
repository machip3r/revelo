"use client";

import { createClient } from "@/lib/supabase/client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type SessionCtx = {
  ready: boolean;
  userId: string | null;
};

const Ctx = createContext<SessionCtx>({ ready: false, userId: null });

export function useSession() {
  return useContext(Ctx);
}

const NAME_KEY = "revelo_display_name";

export function SessionRoot({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const syncProfileName = useCallback(async () => {
    const name = typeof window !== "undefined" ? localStorage.getItem(NAME_KEY) : null;
    if (!name || name.trim().length < 1) return;
    await fetch("/api/user/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!session) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error || !data.user) {
          console.error(error);
          setReady(true);
          return;
        }
        setUserId(data.user.id);
        await syncProfileName();
      } else {
        setUserId(session.user.id);
        await syncProfileName();
      }

      const {
        data: { session: after },
      } = await supabase.auth.getSession();
      if (after?.access_token) {
        await supabase.realtime.setAuth(after.access_token);
      }

      if (!cancelled) setReady(true);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUserId(session?.user?.id ?? null);
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      } else {
        await supabase.realtime.setAuth();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [syncProfileName]);

  const value = useMemo(() => ({ ready, userId }), [ready, userId]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function getStoredDisplayName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(NAME_KEY)?.trim() ?? "";
}

export function setStoredDisplayName(name: string) {
  localStorage.setItem(NAME_KEY, name.trim());
}
