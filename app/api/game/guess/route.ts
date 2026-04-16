import { NextResponse } from "next/server";
import { COLORS, SHAPES } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { processTurn } from "@/lib/gameLogic";
import type { Color, GuessInput, Shape } from "@/lib/types";
import { validateGuessRequest } from "@/lib/validation";

function isShape(x: string): x is Shape {
  return (SHAPES as readonly string[]).includes(x);
}

function isColor(x: string): x is Color {
  return (COLORS as readonly string[]).includes(x);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const roomId = typeof body?.roomId === "string" ? body.roomId : "";
  const targetId = typeof body?.targetId === "string" ? body.targetId : "";
  const shapeRaw = typeof body?.shape === "string" ? body.shape : "";
  const colorRaw = typeof body?.color === "string" ? body.color : "";

  if (!roomId || !targetId || !isShape(shapeRaw) || !isColor(colorRaw)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const guess: GuessInput = { shape: shapeRaw, color: colorRaw };
  const admin = createAdminClient();

  const { data: room, error: roomErr } = await admin
    .from("rooms")
    .select("id, status, current_turn_player_id")
    .eq("id", roomId)
    .single();

  if (roomErr || !room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  if (room.status !== "playing") {
    return NextResponse.json({ error: "Game is not in progress" }, { status: 400 });
  }

  const { data: attacker, error: aErr } = await admin
    .from("players")
    .select("id, room_id, user_id, name, errors, is_alive, turn_order")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .single();

  if (aErr || !attacker) {
    return NextResponse.json({ error: "You are not in this room" }, { status: 403 });
  }

  if (room.current_turn_player_id !== attacker.id) {
    return NextResponse.json({ error: "Not your turn" }, { status: 400 });
  }

  const { data: target, error: tErr } = await admin
    .from("players")
    .select("id, room_id, errors, is_alive, turn_order")
    .eq("id", targetId)
    .eq("room_id", roomId)
    .single();

  if (tErr || !target) {
    return NextResponse.json({ error: "Target not found" }, { status: 404 });
  }

  const { data: combo, error: cErr } = await admin
    .from("combinations")
    .select("shape, color")
    .eq("player_id", targetId)
    .single();

  if (cErr || !combo) {
    return NextResponse.json({ error: "Combination not found" }, { status: 500 });
  }

  const { data: revelation } = await admin
    .from("revelations")
    .select("shape_known, color_known, shape, color")
    .eq("room_id", roomId)
    .eq("player_id", targetId)
    .maybeSingle();

  const validationError = validateGuessRequest({
    attacker,
    target,
    guess,
    revelationForTarget: revelation,
  });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { data: allPlayers, error: allErr } = await admin
    .from("players")
    .select("id, is_alive, turn_order")
    .eq("room_id", roomId);

  if (allErr || !allPlayers?.length) {
    return NextResponse.json({ error: "Players not loaded" }, { status: 500 });
  }

  const outcome = processTurn(
    {
      attacker,
      target,
      targetCombination: { shape: combo.shape, color: combo.color },
      revelationForTarget: revelation,
      guess,
    },
    allPlayers,
  );

  let attackerErrors = attacker.errors;
  if (outcome.incrementAttackerErrors) {
    attackerErrors += 1;
  }

  const attackerAlive = outcome.eliminateAttacker ? false : attacker.is_alive;
  const targetAlive = outcome.eliminateTarget ? false : target.is_alive;

  const simPlayers = allPlayers.map((p) => {
    if (p.id === attacker.id) return { ...p, is_alive: attackerAlive };
    if (p.id === target.id) return { ...p, is_alive: targetAlive };
    return p;
  });

  const living = simPlayers.filter((p) => p.is_alive);
  const gameFinished = living.length <= 1;
  const winnerId = gameFinished && living.length === 1 ? living[0]!.id : null;

  let nextTurn = outcome.nextAttackerId;
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
      .eq("room_id", roomId)
      .eq("player_id", targetId);

    if (revErr) {
      return NextResponse.json({ error: revErr.message }, { status: 500 });
    }
  }

  if (outcome.incrementAttackerErrors || outcome.eliminateAttacker) {
    const { error: ae } = await admin
      .from("players")
      .update({
        errors: attackerErrors,
        is_alive: attackerAlive,
      })
      .eq("id", attacker.id);
    if (ae) {
      return NextResponse.json({ error: ae.message }, { status: 500 });
    }
  }

  if (outcome.eliminateTarget) {
    const { error: te } = await admin
      .from("players")
      .update({ is_alive: false })
      .eq("id", targetId);
    if (te) {
      return NextResponse.json({ error: te.message }, { status: 500 });
    }
  }

  if (gameFinished) {
    const { error: fe } = await admin
      .from("rooms")
      .update({
        status: "finished",
        current_turn_player_id: winnerId,
      })
      .eq("id", roomId);
    if (fe) {
      return NextResponse.json({ error: fe.message }, { status: 500 });
    }
  } else {
    const { error: re } = await admin
      .from("rooms")
      .update({ current_turn_player_id: nextTurn })
      .eq("id", roomId);
    if (re) {
      return NextResponse.json({ error: re.message }, { status: 500 });
    }
  }

  const { error: gErr } = await admin.from("guesses").insert({
    room_id: roomId,
    attacker_id: attacker.id,
    target_id: targetId,
    shape: guess.shape,
    color: guess.color,
    correct: outcome.evaluation.correct,
    shape_match: outcome.evaluation.shapeMatch,
    color_match: outcome.evaluation.colorMatch,
  });

  if (gErr) {
    return NextResponse.json({ error: gErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    evaluation: outcome.evaluation,
    gameFinished,
    winnerPlayerId: winnerId,
    nextTurnPlayerId: nextTurn,
  });
}
