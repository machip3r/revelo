import type { Color, Shape } from "./types";

export const SHAPES: Shape[] = ["circle", "square", "triangle"];
export const COLORS: Color[] = ["red", "blue", "green"];

/** All 9 unique shape × color pairs */
export const ALL_COMBINATIONS: { shape: Shape; color: Color }[] = SHAPES.flatMap(
  (shape) => COLORS.map((color) => ({ shape, color })),
);

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 6;
export const MAX_ERRORS = 2;

/** Public lobby: wait before the first bot can join (ms). */
export const LOBBY_AUTOFILL_FIRST_DELAY_MS = 25_000;
/** Random gap before each additional bot (ms). */
export const LOBBY_AUTOFILL_BOT_GAP_MIN_MS = 12_000;
export const LOBBY_AUTOFILL_BOT_GAP_MAX_MS = 42_000;
/** Add bots only while there are fewer than this many human players. */
export const LOBBY_AUTOFILL_MAX_HUMANS = 3;

/** Seconds a human has to submit a guess on their turn. */
export const TURN_TIME_LIMIT_SECONDS = 90;
export const TURN_TIME_LIMIT_MS = TURN_TIME_LIMIT_SECONDS * 1000;
