"use client";

import type { Color, PlayerRow, RevelationRow, Shape } from "@/lib/types";
import { MAX_ERRORS } from "@/lib/constants";

function ShapeIcon({ shape, muted }: { shape: Shape | null; muted?: boolean }) {
  const cls = muted ? "text-zinc-600" : "text-zinc-200";
  if (!shape) {
    return <span className="text-xs text-zinc-500">?</span>;
  }
  if (shape === "circle") {
    return (
      <span className={`inline-flex h-6 w-6 items-center justify-center ${cls}`}>
        <span className="h-4 w-4 rounded-full border-2 border-current" />
      </span>
    );
  }
  if (shape === "square") {
    return (
      <span className={`inline-flex h-6 w-6 items-center justify-center ${cls}`}>
        <span className="h-4 w-4 border-2 border-current" />
      </span>
    );
  }
  return (
    <span className={`inline-flex h-6 w-6 items-center justify-center ${cls}`}>
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
        <path d="M12 3 L21 20 H3 Z" />
      </svg>
    </span>
  );
}

function ColorDot({ color, muted }: { color: Color | null; muted?: boolean }) {
  if (!color) {
    return <span className="text-xs text-zinc-500">?</span>;
  }
  const map: Record<Color, string> = {
    red: "bg-red-500",
    blue: "bg-blue-500",
    green: "bg-emerald-500",
  };
  return (
    <span
      className={`inline-block h-4 w-4 rounded-full ring-2 ring-zinc-700 ${map[color]} ${muted ? "opacity-40" : ""}`}
      title={color}
    />
  );
}

export function PlayerCard({
  player,
  revelation,
  isYou,
  isCurrentTurn,
}: {
  player: Pick<PlayerRow, "id" | "name" | "errors" | "is_alive">;
  revelation: Pick<
    RevelationRow,
    "shape_known" | "color_known" | "shape" | "color"
  > | null;
  isYou: boolean;
  isCurrentTurn: boolean;
}) {
  const dead = !player.is_alive;
  return (
    <div
      className={[
        "relative flex flex-col gap-2 rounded-xl border p-4 transition",
        dead && "opacity-50 grayscale",
        isCurrentTurn && "border-amber-400/80 ring-2 ring-amber-400/30",
        !isCurrentTurn && "border-zinc-800 bg-zinc-950/60",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {isCurrentTurn && (
        <span className="absolute -right-1 -top-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
          Turn
        </span>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium text-zinc-100">
            {player.name}
            {isYou && (
              <span className="ml-2 text-xs font-normal text-violet-300">(you)</span>
            )}
          </div>
          <div className="text-xs text-zinc-500">
            Errors {player.errors}/{MAX_ERRORS}
          </div>
        </div>
        <div className="text-xs font-medium uppercase text-zinc-400">
          {dead ? "Out" : "Alive"}
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-zinc-800/80 pt-2 text-xs text-zinc-400">
        <span className="flex items-center gap-2">
          Shape:{" "}
          <ShapeIcon
            shape={revelation?.shape_known ? revelation.shape : null}
            muted={!revelation?.shape_known}
          />
        </span>
        <span className="flex items-center gap-2">
          Color:{" "}
          <ColorDot
            color={revelation?.color_known ? revelation.color : null}
            muted={!revelation?.color_known}
          />
        </span>
      </div>
    </div>
  );
}
