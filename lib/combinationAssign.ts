import { ALL_COMBINATIONS } from "./constants";
import type { Color, Shape } from "./types";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Pick `count` distinct random combinations from the 9 possible */
export function pickRandomCombinations(
  count: number,
): { shape: Shape; color: Color }[] {
  if (count > ALL_COMBINATIONS.length) {
    throw new Error("Not enough unique combinations");
  }
  return shuffle(ALL_COMBINATIONS).slice(0, count);
}
