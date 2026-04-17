"use client";

import { GameBoard } from "@/components/game/GameBoard";
import { GuessModal } from "@/components/game/GuessModal";
import { HistoryLog } from "@/components/game/HistoryLog";
import { useSession } from "@/components/SessionRoot";
import { Spinner } from "@/components/Spinner";
import { randomBotActionDelayMs } from "@/lib/botGuess";
import { TURN_TIME_LIMIT_SECONDS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { Color, GuessRow, PlayerRow, RevelationRow, RoomRow, Shape } from "@/lib/types";
import { useToast } from "@/components/Toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type Snapshot = {
  room: RoomRow;
  players: PlayerRow[];
  revelations: RevelationRow[];
  guesses: GuessRow[];
  myPlayerId: string;
  myCombination: { shape: Shape; color: Color } | null;
  isHost: boolean;
};

export function GameClient({ roomId }: { roomId: string }) {
  const { ready: sessionReady } = useSession();
  const toast = useToast();
  const router = useRouter();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [guessOpen, setGuessOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resultBusy, setResultBusy] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/game/snapshot?roomId=${encodeURIComponent(roomId)}`,
    );
    if (res.status === 403 || res.status === 404) {
      router.push("/");
      return;
    }
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast(j.error ?? "Could not load game", "err");
      return;
    }
    setSnap((await res.json()) as Snapshot);
  }, [roomId, toast, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!sessionReady) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`game:${roomId}`)
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
          event: "*",
          schema: "public",
          table: "revelations",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          void load();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "guesses",
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
          console.warn("Game realtime:", status, err);
        }
      });

    const interval = window.setInterval(() => {
      void load();
    }, 2000);

    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [sessionReady, roomId, load]);

  const myTurn = useMemo(() => {
    if (!snap) return false;
    return snap.room.current_turn_player_id === snap.myPlayerId;
  }, [snap]);

  const currentTurnPlayer = useMemo(() => {
    if (!snap?.room.current_turn_player_id) return null;
    return (
      snap.players.find((p) => p.id === snap.room.current_turn_player_id) ??
      null
    );
  }, [snap]);

  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    if (!snap || snap.room.status !== "playing") return;
    if (!myTurn || !snap.room.turn_deadline_at) return;
    const t = window.setInterval(() => setNowTick(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [snap, myTurn]);

  const secondsLeft =
    myTurn && snap?.room.turn_deadline_at
      ? Math.max(
          0,
          Math.ceil(
            (new Date(snap.room.turn_deadline_at).getTime() - nowTick) / 1000,
          ),
        )
      : null;

  useEffect(() => {
    if (!sessionReady || snap?.room.status !== "playing") return;
    const cur = currentTurnPlayer;
    if (!cur?.is_bot || !cur.is_alive) return;

    const t = window.setTimeout(() => {
      void fetch("/api/game/bot-turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      }).then((res) => {
        if (res.ok) void load();
      });
    }, randomBotActionDelayMs());

    return () => window.clearTimeout(t);
  }, [
    sessionReady,
    roomId,
    load,
    currentTurnPlayer?.id,
    currentTurnPlayer?.is_bot,
    currentTurnPlayer?.is_alive,
    snap?.room.status,
  ]);

  useEffect(() => {
    if (!sessionReady || snap?.room.status !== "playing") return;
    const deadline = snap?.room.turn_deadline_at;
    if (!deadline) return;

    const interval = window.setInterval(() => {
      if (Date.now() <= new Date(deadline).getTime()) return;
      void fetch("/api/game/turn-timeout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      }).then((res) => {
        if (res.ok) void load();
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [sessionReady, snap?.room.turn_deadline_at, snap?.room.status, roomId, load]);

  async function submitGuess(targetId: string, shape: Shape, color: Color) {
    setBusy(true);
    try {
      const res = await fetch("/api/game/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, targetId, shape, color }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Guess failed", "err");
        setFlash("bad");
        return;
      }
      if (data.evaluation?.correct) {
        toast("Exact match — target eliminated.", "ok");
        setFlash("ok");
      } else if (
        data.evaluation?.shapeMatch ||
        data.evaluation?.colorMatch
      ) {
        toast("Partial reveal — info updated, error applied.", "info");
        setFlash("ok");
      } else {
        toast("Wrong guess — error applied and turn passed.", "info");
        setFlash("bad");
      }
      if (data.gameFinished) {
        toast("Game over.", "ok");
      }
      setGuessOpen(false);
      await load();
    } finally {
      setBusy(false);
      window.setTimeout(() => setFlash(null), 600);
    }
  }

  async function restartGame() {
    if (!snap) return;
    setResultBusy(true);
    try {
      const res = await fetch("/api/game/restart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: snap.room.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Could not restart game", "err");
        return;
      }
      toast("New round started.", "ok");
      await load();
    } finally {
      setResultBusy(false);
    }
  }

  async function closeRoom() {
    if (!snap) return;
    setResultBusy(true);
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
      setShowCloseDialog(false);
      router.push("/");
    } finally {
      setResultBusy(false);
    }
  }

  async function leaveGame() {
    if (!snap) return;
    setResultBusy(true);
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
      setResultBusy(false);
    }
  }

  if (!snap) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const winner = snap.players.find(
    (p) => p.id === snap.room.current_turn_player_id,
  );
  const finished = snap.room.status === "finished";

  if (finished) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-2xl items-center justify-center px-4 py-10">
        <div className="w-full rounded-2xl border border-border bg-surface/90 p-8 text-center shadow-2xl shadow-black/20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-warning">
            Game Finished
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-foreground">
            {winner ? `${winner.name} wins` : "Match completed"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {snap.isHost
              ? "Start another round with the same players, or close this room."
              : "Only the host can restart or close this room."}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {snap.isHost ? (
              <>
                <button
                  type="button"
                  disabled={resultBusy}
                  onClick={() => void restartGame()}
                  className="rounded-xl bg-gradient-to-r from-accent to-accent-hover px-5 py-3 text-sm font-semibold text-white shadow-[0_6px_24px_var(--accent-glow)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Play again
                </button>
                <button
                  type="button"
                  disabled={resultBusy}
                  onClick={() => setShowCloseDialog(true)}
                  className="rounded-xl border border-border px-5 py-3 text-sm font-semibold text-foreground hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Close room
                </button>
              </>
            ) : (
              <Link
                href="/"
                className="rounded-xl border border-border px-5 py-3 text-sm font-semibold text-foreground hover:bg-surface-elevated"
              >
                Leave
              </Link>
            )}
          </div>
        </div>
        {showCloseDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-left shadow-2xl">
              <h2 className="text-lg font-semibold text-foreground">Close room?</h2>
              <p className="mt-2 text-sm text-muted">
                This will remove this room and all match data for everyone.
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={resultBusy}
                  onClick={() => setShowCloseDialog(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={resultBusy}
                  onClick={() => void closeRoom()}
                  className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Confirm close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={[
        "relative mx-auto w-full max-w-5xl flex-1 px-4 py-8 transition duration-200",
        flash === "ok" && "bg-success/5",
        flash === "bad" && "bg-danger/5",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">In session</h1>
          <p className="text-sm text-muted">
            Room code{" "}
            <span className="font-mono text-accent-hover">{snap.room.code}</span>
          </p>
        </div>
        {snap.myCombination && (
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-accent/35 bg-[var(--secret-tint)] px-4 py-2 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-accent-hover">
                Your secret
              </div>
              <div className="mt-1 font-medium text-foreground">
                {snap.myCombination.color} {snap.myCombination.shape}
              </div>
            </div>
            {snap.isHost ? (
              <button
                type="button"
                disabled={resultBusy}
                onClick={() => setShowCloseDialog(true)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-40"
              >
                Close room
              </button>
            ) : (
              <button
                type="button"
                disabled={resultBusy}
                onClick={() => void leaveGame()}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-40"
              >
                Leave
              </button>
            )}
          </div>
        )}
      </div>

      {finished && (
        <div className="mb-6 rounded-xl border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-foreground">
          Game finished
          {winner && (
            <>
              : <span className="font-semibold">{winner.name}</span> wins.
            </>
          )}
        </div>
      )}

      {!finished && (
        <div className="mb-6 rounded-xl border border-border bg-surface/70 px-4 py-3 text-sm text-muted">
          {myTurn ? (
            <span className="text-success">
              Your turn — make a guess.
              {secondsLeft !== null && (
                <span className="ml-2 text-faint">
                  ({secondsLeft}s / {TURN_TIME_LIMIT_SECONDS}s)
                </span>
              )}
            </span>
          ) : (
            <span>
              Waiting for{" "}
              <span className="font-medium text-foreground">
                {snap.players.find(
                  (p) => p.id === snap.room.current_turn_player_id,
                )?.name ?? "…"}
              </span>
              {currentTurnPlayer?.is_bot ? " (bot)" : ""}.
            </span>
          )}
        </div>
      )}

      <GameBoard
        players={snap.players}
        revelations={snap.revelations}
        myPlayerId={snap.myPlayerId}
        currentTurnPlayerId={snap.room.current_turn_player_id}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <HistoryLog guesses={snap.guesses} players={snap.players} />

        {!finished && myTurn && (
          <div className="flex flex-col justify-end">
            <button
              type="button"
              onClick={() => setGuessOpen(true)}
              className="rounded-xl bg-gradient-to-r from-accent to-accent-hover py-3 text-sm font-semibold text-white shadow-[0_8px_32px_var(--accent-glow)] hover:brightness-110"
            >
              Guess a player
            </button>
          </div>
        )}
      </div>

      <GuessModal
        open={guessOpen}
        onClose={() => setGuessOpen(false)}
        players={snap.players}
        myPlayerId={snap.myPlayerId}
        revelations={snap.revelations}
        busy={busy}
        onSubmit={(tid, s, c) => void submitGuess(tid, s, c)}
      />
      {showCloseDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-left shadow-2xl">
            <h2 className="text-lg font-semibold text-foreground">Close room?</h2>
            <p className="mt-2 text-sm text-muted">
              This will remove this room and all match data for everyone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={resultBusy}
                onClick={() => setShowCloseDialog(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resultBusy}
                onClick={() => void closeRoom()}
                className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Confirm close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
