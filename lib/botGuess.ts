import { ALL_COMBINATIONS } from "./constants";

/** Client/server delay before a bot submits (ms). */
export function randomBotActionDelayMs(): number {
  const min = 1800;
  const max = 4800;
  return min + Math.floor(Math.random() * (max - min + 1));
}
import { evaluateGuess } from "./gameLogic";
import type { Color, GuessInput, GuessRow, RevelationRow, Shape } from "./types";
import { isCompleteMiss } from "./types";

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function guessAllowedForRevelation(
  guess: GuessInput,
  rev: Pick<
    RevelationRow,
    "shape_known" | "color_known" | "shape" | "color"
  > | null,
): boolean {
  if (!rev) return true;
  if (rev.shape_known && rev.shape && guess.shape !== rev.shape) return false;
  if (rev.color_known && rev.color && guess.color !== rev.color) return false;
  return true;
}

export interface BotGuessContext {
  attackerId: string;
  alivePlayerIds: string[];
  revelationsByPlayer: Map<
    string,
    Pick<
      RevelationRow,
      "shape_known" | "color_known" | "shape" | "color"
    >
  >;
  combosByTarget: Map<string, { shape: Shape; color: Color }>;
  guesses: Pick<GuessRow, "attacker_id" | "target_id" | "shape" | "color">[];
}

/**
 * Picks a random live target (not the attacker) and a guess consistent with revelations,
 * preferring combos not yet tried against that target by this attacker.
 */
export function pickBotGuess(ctx: BotGuessContext): {
  targetId: string;
  guess: GuessInput;
} {
  const targets = ctx.alivePlayerIds.filter((id) => id !== ctx.attackerId);
  const targetId = randomFrom(targets);
  const rev = ctx.revelationsByPlayer.get(targetId) ?? null;
  const secret = ctx.combosByTarget.get(targetId);
  if (!secret) {
    const guess = randomFrom(ALL_COMBINATIONS);
    return { targetId, guess };
  }

  const candidates = ALL_COMBINATIONS.filter((c) =>
    guessAllowedForRevelation(c, rev),
  );

  const already = new Set(
    ctx.guesses
      .filter((g) => g.attacker_id === ctx.attackerId && g.target_id === targetId)
      .map((g) => `${g.shape}:${g.color}`),
  );
  const fresh = candidates.filter((c) => !already.has(`${c.shape}:${c.color}`));
  const pool = fresh.length > 0 ? fresh : candidates;

  const ranked = pool.map((guess) => ({
    guess,
    evaluation: evaluateGuess(guess, secret),
  }));

  const nonExact = ranked.filter((r) => !r.evaluation.correct);
  const pickFrom = nonExact.length > 0 ? nonExact : ranked;
  const choice = randomFrom(pickFrom);
  return { targetId, guess: choice.guess };
}

export interface TimeoutPickContext {
  attackerId: string;
  aliveOtherIds: string[];
  revelationsByPlayer: Map<
    string,
    Pick<
      RevelationRow,
      "shape_known" | "color_known" | "shape" | "color"
    >
  >;
  combosByTarget: Map<string, { shape: Shape; color: Color }>;
}

/**
 * Picks a target and a guess that is a complete miss when possible (turn ran out).
 */
export function pickTimeoutGuess(ctx: TimeoutPickContext): {
  targetId: string;
  guess: GuessInput;
} {
  const targetId = randomFrom(ctx.aliveOtherIds);
  const rev = ctx.revelationsByPlayer.get(targetId) ?? null;
  const secret = ctx.combosByTarget.get(targetId);
  if (!secret) {
    return { targetId, guess: randomFrom(ALL_COMBINATIONS) };
  }

  const candidates = ALL_COMBINATIONS.filter((c) =>
    guessAllowedForRevelation(c, rev),
  );
  const completeMisses = candidates.filter((c) =>
    isCompleteMiss(evaluateGuess(c, secret)),
  );
  const pool = completeMisses.length > 0 ? completeMisses : candidates;
  return { targetId, guess: randomFrom(pool) };
}
