"use client";

import type { PlayerRow, RevelationRow } from "@/lib/types";
import { PlayerCard } from "./PlayerCard";

export function GameBoard({
  players,
  revelations,
  myPlayerId,
  currentTurnPlayerId,
}: {
  players: Pick<PlayerRow, "id" | "name" | "errors" | "is_alive" | "is_bot">[];
  revelations: RevelationRow[];
  myPlayerId: string;
  currentTurnPlayerId: string | null;
}) {
  const revMap = new Map(revelations.map((r) => [r.player_id, r]));

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {players.map((p) => (
        <PlayerCard
          key={p.id}
          player={p}
          revelation={revMap.get(p.id) ?? null}
          isYou={p.id === myPlayerId}
          isCurrentTurn={p.id === currentTurnPlayerId && p.is_alive}
        />
      ))}
    </div>
  );
}
