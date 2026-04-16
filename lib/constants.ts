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
