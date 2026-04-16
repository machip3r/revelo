import type {
  Color,
  Evaluation,
  GuessInput,
  PlayerRow,
  RevelationRow,
  Shape,
} from "./types";

export interface TargetCombination {
  shape: Shape;
  color: Color;
}

/**
 * Compare a guess against the target's secret combination.
 */
export function evaluateGuess(
  guess: GuessInput,
  target: TargetCombination,
): Evaluation {
  const shapeMatch = guess.shape === target.shape;
  const colorMatch = guess.color === target.color;
  return {
    correct: shapeMatch && colorMatch,
    shapeMatch,
    colorMatch,
  };
}

export interface ProcessTurnInput {
  attacker: Pick<PlayerRow, "id" | "errors" | "is_alive">;
  target: Pick<PlayerRow, "id" | "is_alive">;
  targetCombination: TargetCombination;
  revelationForTarget: Pick<
    RevelationRow,
    "shape_known" | "color_known" | "shape" | "color"
  > | null;
  guess: GuessInput;
}

export interface RevelationPatch {
  shape_known: boolean;
  color_known: boolean;
  shape: Shape | null;
  color: Color | null;
}

export interface ProcessTurnOutcome {
  evaluation: Evaluation;
  /** Increment attacker errors (any non-exact guess) */
  incrementAttackerErrors: boolean;
  /** Eliminate target (exact match) */
  eliminateTarget: boolean;
  /** Eliminate attacker (errors reached max after an incorrect guess) */
  eliminateAttacker: boolean;
  /** Merge into revelations row for target */
  revelationPatch: RevelationPatch | null;
  /**
   * Who acts next as attacker.
   * - Exact match: attacker keeps turn (choose another target in UI).
   * - Any incorrect guess, attacker survives: target becomes attacker.
   * - Any incorrect guess, attacker eliminated: next alive in turn order after attacker.
   */
  nextAttackerId: string;
}

function mergeRevelation(
  current: ProcessTurnInput["revelationForTarget"],
  evaluation: Evaluation,
  actual: TargetCombination,
): RevelationPatch {
  const base = current ?? {
    shape_known: false,
    color_known: false,
    shape: null as Shape | null,
    color: null as Color | null,
  };
  let shape_known = base.shape_known;
  let color_known = base.color_known;
  let shape: Shape | null = base.shape;
  let color: Color | null = base.color;

  if (evaluation.shapeMatch) {
    shape_known = true;
    shape = actual.shape;
  }
  if (evaluation.colorMatch) {
    color_known = true;
    color = actual.color;
  }

  return { shape_known, color_known, shape, color };
}

function nextAliveAfter(
  players: Pick<PlayerRow, "id" | "is_alive" | "turn_order">[],
  afterPlayerId: string,
): string | null {
  const alive = players.filter((p) => p.is_alive).sort((a, b) => a.turn_order - b.turn_order);
  if (alive.length === 0) return null;
  const idx = alive.findIndex((p) => p.id === afterPlayerId);
  if (idx === -1) return alive[0]?.id ?? null;
  return alive[(idx + 1) % alive.length]?.id ?? null;
}

/**
 * Pure turn processor: computes outcome from current snapshot.
 * `allPlayers` must include all room players (for turn rotation when attacker is eliminated).
 */
export function processTurn(
  input: ProcessTurnInput,
  allPlayers: Pick<PlayerRow, "id" | "is_alive" | "turn_order">[],
): ProcessTurnOutcome {
  const evaluation = evaluateGuess(input.guess, input.targetCombination);

  if (evaluation.correct) {
    return {
      evaluation,
      incrementAttackerErrors: false,
      eliminateTarget: true,
      eliminateAttacker: false,
      revelationPatch: mergeRevelation(
        input.revelationForTarget,
        evaluation,
        input.targetCombination,
      ),
      nextAttackerId: input.attacker.id,
    };
  }

  // Any non-exact guess is incorrect: reveal partial info, consume an error,
  // and pass turn unless attacker is eliminated.
  const newErrors = input.attacker.errors + 1;
  const eliminateAttacker = newErrors >= 2;
  const revelationPatch =
    evaluation.shapeMatch || evaluation.colorMatch
      ? mergeRevelation(input.revelationForTarget, evaluation, input.targetCombination)
      : null;

  if (!eliminateAttacker) {
    return {
      evaluation,
      incrementAttackerErrors: true,
      eliminateTarget: false,
      eliminateAttacker: false,
      revelationPatch,
      nextAttackerId: input.target.id,
    };
  }

  const next = nextAliveAfter(allPlayers, input.attacker.id);
  return {
    evaluation,
    incrementAttackerErrors: true,
    eliminateTarget: false,
    eliminateAttacker: true,
    revelationPatch,
    nextAttackerId: next ?? input.target.id,
  };
}

export function countLiving(
  players: Pick<PlayerRow, "is_alive">[],
): number {
  return players.filter((p) => p.is_alive).length;
}
