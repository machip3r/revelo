"use client";

import type { Color, PlayerRow, RevelationRow, Shape } from "@/lib/types";
import { MAX_ERRORS } from "@/lib/constants";

function ShapeIcon({ shape, muted }: { shape: Shape | null; muted?: boolean }) {
  const cls = muted ? "text-faint" : "text-foreground";
  if (!shape) {
    return <span className="text-xs text-muted">?</span>;
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
    return <span className="text-xs text-muted">?</span>;
  }
  const map: Record<Color, string> = {
    red: "bg-game-red",
    blue: "bg-game-blue",
    green: "bg-game-green",
  };
  return (
    <span
      className={`inline-block h-4 w-4 rounded-full ring-2 ring-border ${map[color]} ${muted ? "opacity-40" : ""}`}
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
  player: Pick<PlayerRow, "id" | "name" | "errors" | "is_alive" | "is_bot">;
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
        "relative flex flex-col gap-2 rounded-xl border p-4 transition-shadow duration-200",
        dead && "opacity-50 grayscale",
        isCurrentTurn &&
          "border-turn bg-surface shadow-[0_0_24px_var(--turn-ring)] ring-2 ring-turn/35",
        !isCurrentTurn && "border-border bg-surface/80",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {isCurrentTurn && (
        <span className="absolute -right-1 -top-2 rounded-full bg-turn/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-turn">
          Turn
        </span>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">
            {player.name}
            {player.is_bot && (
              <span className="ml-2 text-xs font-normal text-game-blue">(bot)</span>
            )}
            {isYou && (
              <span className="ml-2 text-xs font-normal text-accent-hover">(you)</span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            <span>Errors</span>
            <span className="flex gap-0.5" aria-hidden>
              {Array.from({ length: MAX_ERRORS }).map((_, i) => (
                <span
                  key={i}
                  className={[
                    "h-2 w-2 rounded-full",
                    i < player.errors ? "bg-danger" : "bg-border",
                  ].join(" ")}
                />
              ))}
            </span>
            <span className="tabular-nums">
              {player.errors}/{MAX_ERRORS}
            </span>
          </div>
        </div>
        <div className="text-xs font-medium uppercase text-muted">
          {dead ? "Out" : "Alive"}
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border/80 pt-2 text-xs text-muted">
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
