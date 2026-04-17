"use client";

import { COLORS, SHAPES } from "@/lib/constants";
import type { Color, PlayerRow, RevelationRow, Shape } from "@/lib/types";
import { isGuessImpossibleForTarget } from "@/lib/validation";
import { useMemo, useState } from "react";

export function GuessModal({
  open,
  onClose,
  players,
  myPlayerId,
  revelations,
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  players: Pick<PlayerRow, "id" | "name" | "is_alive">[];
  myPlayerId: string;
  revelations: RevelationRow[];
  busy: boolean;
  onSubmit: (targetId: string, shape: Shape, color: Color) => void;
}) {
  const [targetId, setTargetId] = useState<string>("");
  const [shape, setShape] = useState<Shape>("circle");
  const [color, setColor] = useState<Color>("red");

  const revMap = useMemo(
    () => new Map(revelations.map((r) => [r.player_id, r])),
    [revelations],
  );

  const selectable = players.filter(
    (p) => p.is_alive && p.id !== myPlayerId,
  );

  const revelation = targetId ? revMap.get(targetId) ?? null : null;

  const comboInvalid = Boolean(
    revelation && isGuessImpossibleForTarget({ shape, color }, revelation),
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl shadow-black/20">
        <h2 className="text-lg font-semibold text-foreground">Make a guess</h2>
        <p className="mt-1 text-sm text-muted">
          Any wrong guess costs an error and passes turn. Partial matches still reveal info.
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-xs font-medium uppercase tracking-wide text-muted">
            Target
            <select
              className="mt-1 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              <option value="">Select player</option>
              {selectable.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium uppercase tracking-wide text-muted">
              Shape
              <select
                className="mt-1 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground"
                value={shape}
                onChange={(e) => setShape(e.target.value as Shape)}
              >
                {SHAPES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium uppercase tracking-wide text-muted">
              Color
              <select
                className="mt-1 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground"
                value={color}
                onChange={(e) => setColor(e.target.value as Color)}
              >
                {COLORS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {comboInvalid && (
            <p className="text-sm text-danger">
              This combination contradicts known information about this player.
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:bg-surface-elevated"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={
              busy || !targetId || comboInvalid
            }
            onClick={() => onSubmit(targetId, shape, color)}
            className="rounded-lg bg-gradient-to-r from-accent to-accent-hover px-4 py-2 text-sm font-medium text-white shadow-[0_4px_20px_var(--accent-glow)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
