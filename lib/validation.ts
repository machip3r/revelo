import type { Color, GuessInput, PlayerRow, RevelationRow, Shape } from "./types";
import { isCompleteMiss } from "./types";
import type { Evaluation } from "./types";
import { ALL_COMBINATIONS } from "./constants";

export interface ValidateGuessParams {
  attacker: Pick<PlayerRow, "id" | "is_alive">;
  target: Pick<PlayerRow, "id" | "is_alive">;
  guess: GuessInput;
  revelationForTarget: Pick<
    RevelationRow,
    "shape_known" | "color_known" | "shape" | "color"
  > | null;
  /** Combos already taken by eliminated players (optional extra constraint) */
  eliminatedCombos?: { shape: Shape; color: Color }[];
}

/**
 * Client/server validation before submitting a guess.
 */
export function validateGuessRequest(p: ValidateGuessParams): string | null {
  if (!p.attacker.is_alive) return "You are eliminated.";
  if (!p.target.is_alive) return "Target is eliminated.";
  if (p.attacker.id === p.target.id) return "You cannot guess yourself.";

  const rev = p.revelationForTarget;
  if (rev?.shape_known && rev.shape && rev.shape !== p.guess.shape) {
    return "That shape contradicts what is already revealed for this player.";
  }
  if (rev?.color_known && rev.color && rev.color !== p.guess.color) {
    return "That color contradicts what is already revealed for this player.";
  }

  return null;
}

/**
 * Prevent guessing a (shape, color) pair that cannot match any remaining live opponent
 * combination — here we only block pairs that contradict revelations for that target.
 * Optionally block pairs identical to a fully revealed eliminated player's combo is not required by spec.
 */
export function isGuessImpossibleForTarget(
  guess: GuessInput,
  revelation: Pick<
    RevelationRow,
    "shape_known" | "color_known" | "shape" | "color"
  > | null,
): boolean {
  if (revelation?.shape_known && revelation.shape && revelation.shape !== guess.shape)
    return true;
  if (revelation?.color_known && revelation.color && revelation.color !== guess.color)
    return true;
  return false;
}

/**
 * After evaluation, if complete miss, ensure we don't somehow double-count — used only for tests / clarity.
 */
export function shouldIncrementErrors(evaluation: Evaluation): boolean {
  return isCompleteMiss(evaluation);
}

/** All 9 combos as tuples for UI filtering */
export function allCombinationKeys(): string[] {
  return ALL_COMBINATIONS.map((c) => `${c.shape}:${c.color}`);
}
