"use client";

import {
  getStoredDisplayName,
  setStoredDisplayName,
  useSession,
} from "@/components/SessionRoot";
import { Spinner } from "@/components/Spinner";
import { MAX_PLAYERS, MIN_PLAYERS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Snapshot = {
  room: {
    id: string;
    code: string;
    status: string;
    host_user_id: string;
    current_turn_player_id: string | null;
    is_public: boolean;
    lobby_autofill_next_at: string | null;
    created_at: string;
  };
  players: {
    id: string;
    name: string;
    errors: number;
    is_alive: boolean;
    turn_order: number;
    user_id: string | null;
    is_bot: boolean;
  }[];
  myPlayerId: string | null;
  isHost: boolean;
};

export function RoomClient({ code }: { code: string }) {
  const { ready: sessionReady } = useSession();
  const toast = useToast();
  const router = useRouter();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [joinName, setJoinName] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/room/snapshot?code=${encodeURIComponent(code)}`,
    );
    if (res.status === 404 || res.status === 403) {
      router.push("/");
      return;
    }
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast(j.error ?? "Room not found", "err");
      setSnap(null);
      return;
    }
    const data = (await res.json()) as Snapshot;
    setSnap(data);
  }, [code, toast, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (sessionReady) void load();
  }, [sessionReady, load]);

  useEffect(() => {
    if (snap?.room.status === "playing") {
      router.push(`/game/${snap.room.id}`);
    }
  }, [snap?.room.status, snap?.room.id, router]);

  useEffect(() => {
    setJoinName(getStoredDisplayName());
  }, []);

  // Realtime only receives RLS-scoped events after the anon session JWT exists.
  // Poll as a fallback when the lobby is open (covers missed events / race with auth).
  useEffect(() => {
    if (!sessionReady || !snap?.room.id) return;
    if (snap.room.status !== "waiting") return;

    const supabase = createClient();
    const roomId = snap.room.id;

    const channel = supabase
      .channel(`lobby:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          void load();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        () => {
          void load();
        },
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("Lobby realtime:", status, err);
        }
      });

    const interval = window.setInterval(() => {
      void load();
    }, 3000);

    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [sessionReady, snap?.room.id, snap?.room.status, load]);

  useEffect(() => {
    if (!sessionReady || !snap?.room.id) return;
    if (snap.room.status !== "waiting") return;
    if (!snap.room.is_public) return;

    const tick = () => {
      void fetch("/api/room/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: snap.room.id }),
      }).then(() => {
        void load();
      });
    };

    const id = window.setInterval(tick, 4000);
    return () => window.clearInterval(id);
  }, [sessionReady, snap?.room.id, snap?.room.status, snap?.room.is_public, load]);

  async function joinFromLink() {
    const n = joinName.trim();
    if (n.length < 1) {
      toast("Enter a display name.", "err");
      return;
    }
    setBusy(true);
    try {
      setStoredDisplayName(n);
      const res = await fetch("/api/room/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Could not join", "err");
        return;
      }
      await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
      });
      toast("Joined room", "ok");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function startGame() {
    if (!snap) return;
    setBusy(true);
    try {
      const res = await fetch("/api/game/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: snap.room.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Could not start", "err");
        return;
      }
      toast("Game on!", "ok");
      router.push(`/game/${snap.room.id}`);
    } finally {
      setBusy(false);
    }
  }

  async function closeLobby() {
    if (!snap) return;
    setBusy(true);
    try {
      const res = await fetch("/api/room/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: snap.room.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error ?? "Could not close room", "err");
        return;
      }
      toast("Room closed.", "ok");
      router.push("/");
    } finally {
      setBusy(false);
    }
  }

  async function leaveLobby() {
    if (!snap) return;
    setBusy(true);
    try {
      const res = await fetch("/api/room/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: snap.room.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error ?? "Could not leave room", "err");
        return;
      }
      toast("Left room.", "ok");
      router.push("/");
    } finally {
      setBusy(false);
    }
  }

  if (!snap) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!snap.myPlayerId && snap.room.status === "waiting") {
    return (
      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-12">
        <h1 className="text-2xl font-semibold text-foreground">Join room</h1>
        <p className="mt-2 text-sm text-muted">
          Code{" "}
          <span className="font-mono tracking-widest text-accent-hover">{code}</span>
        </p>
        <label className="mt-6 block text-xs font-medium uppercase tracking-wide text-muted">
          Display name
          <input
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent/40"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            maxLength={40}
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void joinFromLink()}
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-accent to-accent-hover py-3 text-sm font-semibold text-white shadow-[0_6px_24px_var(--accent-glow)] hover:brightness-110 disabled:opacity-40"
        >
          Join
        </button>
        <Link href="/" className="mt-4 block text-center text-sm text-muted hover:text-foreground">
          Back home
        </Link>
      </div>
    );
  }

  const count = snap.players.length;
  const humanCount = snap.players.filter((p) => !p.is_bot).length;
  const canStart =
    snap.isHost &&
    snap.room.status === "waiting" &&
    count >= MIN_PLAYERS &&
    count <= MAX_PLAYERS;

  return (
    <div className="mx-auto w-full max-w-lg flex-1 px-4 py-12">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Lobby</h1>
          <p className="text-sm text-muted">
            Code{" "}
            <span className="font-mono text-lg tracking-widest text-accent-hover">
              {snap.room.code}
            </span>
          </p>
        </div>
        {snap.room.status === "waiting" &&
          (snap.isHost ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void closeLobby()}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-40"
            >
              Close lobby
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void leaveLobby()}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-40"
            >
              Leave lobby
            </button>
          ))}
      </div>

      <div className="rounded-2xl border border-border bg-surface/80 p-6">
        <div className="mb-4 flex items-center justify-between text-sm text-muted">
          <span>
            Players ({count}/{MAX_PLAYERS})
          </span>
          <span className="uppercase">
            {snap.room.status === "waiting" ? "Waiting" : snap.room.status}
          </span>
        </div>
        <ul className="space-y-2">
          {snap.players.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-border/80 bg-surface-elevated/50 px-3 py-2 text-sm"
            >
              <span className="text-foreground">
                {p.name}
                {p.is_bot && (
                  <span className="ml-2 text-xs text-game-blue">(bot)</span>
                )}
                {p.id === snap.myPlayerId && (
                  <span className="ml-2 text-xs text-accent-hover">(you)</span>
                )}
              </span>
              {p.user_id && snap.room.host_user_id === p.user_id && (
                <span className="text-[10px] font-semibold uppercase text-warning">
                  Host
                </span>
              )}
            </li>
          ))}
        </ul>

        {snap.room.status === "waiting" && (
          <p className="mt-4 text-xs text-muted">
            Need {MIN_PLAYERS}–{MAX_PLAYERS} players. Host starts when everyone
            is ready.
            {snap.room.is_public && humanCount < MIN_PLAYERS && (
              <>
                {" "}
                In public matchmaking, bots join over time (up to {MAX_PLAYERS}{" "}
                total) when fewer than {MIN_PLAYERS} humans are waiting.
              </>
            )}
          </p>
        )}

        {snap.isHost && snap.room.status === "waiting" && (
          <div className="mt-6 grid gap-3">
            <button
              type="button"
              disabled={!canStart || busy}
              onClick={startGame}
              className="w-full rounded-xl bg-success py-3 text-sm font-semibold text-white shadow-[0_6px_24px_rgba(34,197,94,0.25)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {!canStart
                ? count < MIN_PLAYERS
                  ? `Need at least ${MIN_PLAYERS} players`
                  : count > MAX_PLAYERS
                    ? `Max ${MAX_PLAYERS} players`
                    : "Cannot start"
                : "Start game"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
