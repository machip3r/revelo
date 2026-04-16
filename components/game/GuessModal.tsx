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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-zinc-100">Make a guess</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Any wrong guess costs an error and passes turn. Partial matches still reveal info.
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
            Target
            <select
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
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
            <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Shape
              <select
                className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
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
            <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Color
              <select
                className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
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
            <p className="text-sm text-rose-400">
              This combination contradicts known information about this player.
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={
              busy || !targetId || comboInvalid
            }
            onClick={() => onSubmit(targetId, shape, color)}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
