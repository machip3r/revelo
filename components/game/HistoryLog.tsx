"use client";

import type { GuessRow, PlayerRow } from "@/lib/types";

function labelShape(shape: string) {
  return shape;
}

export function HistoryLog({
  guesses,
  players,
}: {
  guesses: GuessRow[];
  players: Pick<PlayerRow, "id" | "name">[];
}) {
  const names = new Map(players.map((p) => [p.id, p.name]));

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      <h3 className="text-sm font-semibold text-zinc-300">Guess history</h3>
      <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm text-zinc-400">
        {guesses.length === 0 && (
          <li className="text-zinc-600">No guesses yet.</li>
        )}
        {guesses.map((g) => {
          const a = names.get(g.attacker_id) ?? "?";
          const b = names.get(g.target_id) ?? "?";
          const shapeOk = g.shape_match ? "shape ✔︎" : "";
          const colorOk = g.color_match ? "color ✔︎" : "";
          const partial =
            !g.correct && (g.shape_match || g.color_match)
              ? ` (${[shapeOk, colorOk].filter(Boolean).join(", ")})`
              : "";
          const mark = g.correct ? "✅" : "❌";
          return (
            <li key={g.id} className="border-b border-zinc-800/60 pb-2 last:border-0">
              <span className="text-zinc-200">
                {a} → {b}
              </span>
              : {g.color} {labelShape(g.shape)} {mark}
              {partial}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
