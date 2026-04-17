import type { SupabaseClient } from "@supabase/supabase-js";
import { processTurn } from "./gameLogic";
import { nextTurnDeadlineIso } from "./turnDeadline";
import type { Color, GuessInput, PlayerRow, RevelationRow, Shape } from "./types";
import { validateGuessRequest } from "./validation";

type Admin = SupabaseClient;

export interface ExecuteGuessTurnParams {
  roomId: string;
  attacker: Pick<PlayerRow, "id" | "errors" | "is_alive" | "turn_order">;
  targetId: string;
  guess: GuessInput;
  targetCombination: { shape: Shape; color: Color };
  revelationForTarget: Pick<
    RevelationRow,
    "shape_known" | "color_known" | "shape" | "color"
  > | null;
  target: Pick<PlayerRow, "id" | "is_alive" | "turn_order">;
  allPlayers: (Pick<PlayerRow, "id" | "is_alive" | "turn_order"> & {
    is_bot: boolean;
  })[];
}

export async function executeGuessTurn(
  admin: Admin,
  p: ExecuteGuessTurnParams,
): Promise<{
  evaluation: ReturnType<typeof processTurn>["evaluation"];
  gameFinished: boolean;
  winnerPlayerId: string | null;
  nextTurnPlayerId: string | null;
}> {
  const validationError = validateGuessRequest({
    attacker: p.attacker,
    target: p.target,
    guess: p.guess,
    revelationForTarget: p.revelationForTarget,
  });
  if (validationError) {
    throw new Error(validationError);
  }

  const outcome = processTurn(
    {
      attacker: p.attacker,
      target: p.target,
      targetCombination: p.targetCombination,
      revelationForTarget: p.revelationForTarget,
      guess: p.guess,
    },
    p.allPlayers,
  );

  let attackerErrors = p.attacker.errors;
  if (outcome.incrementAttackerErrors) {
    attackerErrors += 1;
  }

  const attackerAlive = outcome.eliminateAttacker ? false : p.attacker.is_alive;
  const targetAlive = outcome.eliminateTarget ? false : p.target.is_alive;

  const simPlayers = p.allPlayers.map((pl) => {
    if (pl.id === p.attacker.id) return { ...pl, is_alive: attackerAlive };
    if (pl.id === p.targetId) return { ...pl, is_alive: targetAlive };
    return pl;
  });

  const living = simPlayers.filter((x) => x.is_alive);
  const gameFinished = living.length <= 1;
  const winnerId = gameFinished && living.length === 1 ? living[0]!.id : null;

  let nextTurn: string | null = outcome.nextAttackerId;
  if (gameFinished) {
    nextTurn = winnerId;
  }

  if (outcome.revelationPatch) {
    const { error: revErr } = await admin
      .from("revelations")
      .update({
        shape_known: outcome.revelationPatch.shape_known,
        color_known: outcome.revelationPatch.color_known,
        shape: outcome.revelationPatch.shape,
        color: outcome.revelationPatch.color,
      })
      .eq("room_id", p.roomId)
      .eq("player_id", p.targetId);

    if (revErr) {
      throw new Error(revErr.message);
    }
  }

  if (outcome.incrementAttackerErrors || outcome.eliminateAttacker) {
    const { error: ae } = await admin
      .from("players")
      .update({
        errors: attackerErrors,
        is_alive: attackerAlive,
      })
      .eq("id", p.attacker.id);
    if (ae) {
      throw new Error(ae.message);
    }
  }

  if (outcome.eliminateTarget) {
    const { error: te } = await admin
      .from("players")
      .update({ is_alive: false })
      .eq("id", p.targetId);
    if (te) {
      throw new Error(te.message);
    }
  }

  const deadline = gameFinished
    ? null
    : nextTurnDeadlineIso(nextTurn, p.allPlayers);

  if (gameFinished) {
    const { error: fe } = await admin
      .from("rooms")
      .update({
        status: "finished",
        current_turn_player_id: winnerId,
        turn_deadline_at: null,
      })
      .eq("id", p.roomId);
    if (fe) {
      throw new Error(fe.message);
    }
  } else {
    const { error: re } = await admin
      .from("rooms")
      .update({
        current_turn_player_id: nextTurn,
        turn_deadline_at: deadline,
      })
      .eq("id", p.roomId);
    if (re) {
      throw new Error(re.message);
    }
  }

  const { error: gErr } = await admin.from("guesses").insert({
    room_id: p.roomId,
    attacker_id: p.attacker.id,
    target_id: p.targetId,
    shape: p.guess.shape,
    color: p.guess.color,
    correct: outcome.evaluation.correct,
    shape_match: outcome.evaluation.shapeMatch,
    color_match: outcome.evaluation.colorMatch,
  });

  if (gErr) {
    throw new Error(gErr.message);
  }

  return {
    evaluation: outcome.evaluation,
    gameFinished,
    winnerPlayerId: winnerId,
    nextTurnPlayerId: nextTurn,
  };
}
