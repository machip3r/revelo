"use client";

import { GameBoard } from "@/components/game/GameBoard";
import { GuessModal } from "@/components/game/GuessModal";
import { HistoryLog } from "@/components/game/HistoryLog";
import { Spinner } from "@/components/Spinner";
import { useToast } from "@/components/Toast";
import { ALL_COMBINATIONS, MAX_ERRORS } from "@/lib/constants";
import { evaluateGuess } from "@/lib/gameLogic";
import type { Color, GuessRow, RevelationRow, Shape } from "@/lib/types";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SoloPlayer = {
  id: string;
  name: string;
  isBot: boolean;
  errors: number;
  is_alive: boolean;
  turn_order: number;
};

type Combo = { shape: Shape; color: Color };

const MY_ID = "solo-you";
const BOT_NAMES = ["Diebot", "Mallocbot", "Maxbot", "Uvibot", "Oskybot"];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function nextAliveAfter(players: SoloPlayer[], afterId: string): string | null {
  const alive = players.filter((p) => p.is_alive).sort((a, b) => a.turn_order - b.turn_order);
  if (alive.length === 0) return null;
  const idx = alive.findIndex((p) => p.id === afterId);
  if (idx === -1) return alive[0]?.id ?? null;
  return alive[(idx + 1) % alive.length]?.id ?? null;
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** Random delay so bot moves feel less instant (ms). */
function randomBotDelayMs(): number {
  const min = 1800;
  const max = 4800;
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function SoloGameClient() {
  const toast = useToast();
  const [players, setPlayers] = useState<SoloPlayer[]>([]);
  const [revelations, setRevelations] = useState<RevelationRow[]>([]);
  const [combos, setCombos] = useState<Record<string, Combo>>({});
  const [guesses, setGuesses] = useState<GuessRow[]>([]);
  const [currentTurnPlayerId, setCurrentTurnPlayerId] = useState<string | null>(null);
  const [guessOpen, setGuessOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  function startSoloGame() {
    const allPlayers: SoloPlayer[] = [
      { id: MY_ID, name: "You", isBot: false, errors: 0, is_alive: true, turn_order: 0 },
      ...BOT_NAMES.map((name, idx) => ({
        id: `bot-${idx + 1}`,
        name,
        isBot: true,
        errors: 0,
        is_alive: true,
        turn_order: idx + 1,
      })),
    ];

    const selected = shuffle(ALL_COMBINATIONS).slice(0, allPlayers.length);
    const comboMap: Record<string, Combo> = {};
    allPlayers.forEach((p, i) => {
      comboMap[p.id] = selected[i]!;
    });

    const revs: RevelationRow[] = allPlayers.map((p) => ({
      id: `rev-${p.id}`,
      room_id: "solo",
      player_id: p.id,
      shape_known: false,
      color_known: false,
      shape: null,
      color: null,
    }));

    setPlayers(allPlayers);
    setCombos(comboMap);
    setRevelations(revs);
    setGuesses([]);
    setWinnerId(null);
    setCurrentTurnPlayerId(MY_ID);
    setGuessOpen(false);
    setStarting(false);
  }

  useEffect(() => {
    startSoloGame();
  }, []);

  const me = players.find((p) => p.id === MY_ID) ?? null;
  const myTurn = currentTurnPlayerId === MY_ID;
  const finished = Boolean(winnerId);

  function applyGuess(attackerId: string, targetId: string, guess: Combo) {
    const attacker = players.find((p) => p.id === attackerId);
    const target = players.find((p) => p.id === targetId);
    if (!attacker || !target || !attacker.is_alive || !target.is_alive) return;

    const targetCombo = combos[targetId];
    if (!targetCombo) return;

    const evaluation = evaluateGuess(guess, targetCombo);

    const nextPlayers = players.map((p) => ({ ...p }));
    const nextRevelations = revelations.map((r) => ({ ...r }));

    const a = nextPlayers.find((p) => p.id === attackerId)!;
    const t = nextPlayers.find((p) => p.id === targetId)!;
    const targetRev = nextRevelations.find((r) => r.player_id === targetId)!;

    let nextTurn = attackerId;

    if (evaluation.correct) {
      t.is_alive = false;
      targetRev.shape_known = true;
      targetRev.color_known = true;
      targetRev.shape = targetCombo.shape;
      targetRev.color = targetCombo.color;
      nextTurn = attackerId;
    } else {
      a.errors += 1;
      if (evaluation.shapeMatch) {
        targetRev.shape_known = true;
        targetRev.shape = targetCombo.shape;
      }
      if (evaluation.colorMatch) {
        targetRev.color_known = true;
        targetRev.color = targetCombo.color;
      }

      if (a.errors >= MAX_ERRORS) {
        a.is_alive = false;
        nextTurn = nextAliveAfter(nextPlayers, attackerId) ?? targetId;
      } else {
        nextTurn = targetId;
      }
    }

    const nextGuess: GuessRow = {
      id: `${Date.now()}-${Math.random()}`,
      room_id: "solo",
      attacker_id: attackerId,
      target_id: targetId,
      shape: guess.shape,
      color: guess.color,
      correct: evaluation.correct,
      shape_match: evaluation.shapeMatch,
      color_match: evaluation.colorMatch,
      created_at: new Date().toISOString(),
    };

    setPlayers(nextPlayers);
    setRevelations(nextRevelations);
    setGuesses((prev) => [...prev, nextGuess]);

    const alive = nextPlayers.filter((p) => p.is_alive);
    if (alive.length <= 1) {
      setWinnerId(alive[0]?.id ?? null);
      setCurrentTurnPlayerId(alive[0]?.id ?? null);
      return;
    }
    setCurrentTurnPlayerId(nextTurn);
  }

  function botPickGuess(botId: string) {
    const aliveTargets = players.filter((p) => p.is_alive && p.id !== botId);
    const target = randomFrom(aliveTargets);
    const targetRev = revelations.find((r) => r.player_id === target.id) ?? null;

    const candidates = ALL_COMBINATIONS.filter((c) => {
      if (targetRev?.shape_known && targetRev.shape && c.shape !== targetRev.shape) return false;
      if (targetRev?.color_known && targetRev.color && c.color !== targetRev.color) return false;
      return true;
    });

    const already = new Set(
      guesses
        .filter((g) => g.attacker_id === botId && g.target_id === target.id)
        .map((g) => `${g.shape}:${g.color}`),
    );
    const fresh = candidates.filter((c) => !already.has(`${c.shape}:${c.color}`));
    const pickPool = fresh.length > 0 ? fresh : candidates;
    const guess = randomFrom(pickPool);
    return { targetId: target.id, guess };
  }

  useEffect(() => {
    if (starting || finished || !currentTurnPlayerId) return;
    const actor = players.find((p) => p.id === currentTurnPlayerId);
    if (!actor || !actor.isBot || !actor.is_alive) return;

    const t = window.setTimeout(() => {
      const { targetId, guess } = botPickGuess(actor.id);
      applyGuess(actor.id, targetId, guess);
    }, randomBotDelayMs());

    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTurnPlayerId, finished, starting, players, revelations, guesses]);

  const winner = useMemo(
    () => players.find((p) => p.id === winnerId) ?? null,
    [players, winnerId],
  );

  if (starting) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="relative mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Solo vs Bots</h1>
          <p className="text-sm text-muted">Practice mode with AI opponents.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={startSoloGame}
            className="rounded-lg bg-gradient-to-r from-accent to-accent-hover px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_20px_var(--accent-glow)] hover:brightness-110"
          >
            New solo game
          </button>
          <Link
            href="/"
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-elevated"
          >
            Home
          </Link>
        </div>
      </div>

      {finished ? (
        <div className="mb-6 rounded-xl border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-foreground">
          Game finished: <span className="font-semibold">{winner?.name ?? "No winner"}</span>
        </div>
      ) : (
        <div className="mb-6 rounded-xl border border-border bg-surface/70 px-4 py-3 text-sm text-muted">
          {myTurn ? (
            <span className="text-success">Your turn — make a guess.</span>
          ) : (
            <span>
              Waiting for{" "}
              <span className="font-medium text-foreground">
                {players.find((p) => p.id === currentTurnPlayerId)?.name ?? "…"}
              </span>
              .
            </span>
          )}
        </div>
      )}

      {me && (
        <div className="mb-4 inline-flex rounded-xl border border-accent/35 bg-[var(--secret-tint)] px-4 py-2 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <span className="text-muted">
            Your secret:{" "}
            <span className="font-semibold text-foreground">
              {combos[me.id]?.color} {combos[me.id]?.shape}
            </span>
          </span>
        </div>
      )}

      <GameBoard
        players={players.map((p) => ({
          id: p.id,
          name: p.name,
          errors: p.errors,
          is_alive: p.is_alive,
          is_bot: p.isBot,
        }))}
        revelations={revelations}
        myPlayerId={MY_ID}
        currentTurnPlayerId={currentTurnPlayerId}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <HistoryLog guesses={guesses} players={players} />
        {!finished && myTurn && (
          <div className="flex flex-col justify-end">
            <button
              type="button"
              onClick={() => setGuessOpen(true)}
              className="rounded-xl bg-gradient-to-r from-accent to-accent-hover py-3 text-sm font-semibold text-white shadow-[0_8px_32px_var(--accent-glow)] hover:brightness-110"
            >
              Guess a bot
            </button>
          </div>
        )}
      </div>

      <GuessModal
        open={guessOpen}
        onClose={() => setGuessOpen(false)}
        players={players}
        myPlayerId={MY_ID}
        revelations={revelations}
        busy={busy}
        onSubmit={(targetId, shape, color) => {
          setBusy(true);
          try {
            applyGuess(MY_ID, targetId, { shape, color });
            setGuessOpen(false);
            toast("Guess submitted", "info");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
