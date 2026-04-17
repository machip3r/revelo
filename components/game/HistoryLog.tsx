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
    <div className="rounded-xl border border-border bg-surface/60 p-4 backdrop-blur-sm">
      <h3 className="text-sm font-semibold text-foreground">Guess history</h3>
      <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm text-muted">
        {guesses.length === 0 && (
          <li className="text-faint">No guesses yet.</li>
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
          const outcomeClass = g.correct
            ? "text-success"
            : !g.shape_match && !g.color_match
              ? "text-danger"
              : "text-warning";
          return (
            <li
              key={g.id}
              className="border-b border-border/60 pb-2 last:border-0"
            >
              <span className="text-foreground">
                {a} → {b}
              </span>
              : {g.color} {labelShape(g.shape)}{" "}
              <span className={`font-medium ${outcomeClass}`}>
                {g.correct ? "Correct" : g.shape_match || g.color_match ? "Partial" : "Miss"}
              </span>
              {partial && (
                <span className="text-warning/90">{partial}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
