import { NextResponse } from "next/server";
import { COLORS, SHAPES } from "@/lib/constants";
import { executeGuessTurn } from "@/lib/executeGuessTurn";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Color, GuessInput, Shape } from "@/lib/types";

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
    .select("id, room_id, user_id, name, errors, is_alive, turn_order, is_bot")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .single();

  if (aErr || !attacker) {
    return NextResponse.json({ error: "You are not in this room" }, { status: 403 });
  }

  if (attacker.is_bot) {
    return NextResponse.json({ error: "Bots cannot use this endpoint" }, { status: 400 });
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

  const { data: allPlayers, error: allErr } = await admin
    .from("players")
    .select("id, is_alive, turn_order, is_bot")
    .eq("room_id", roomId);

  if (allErr || !allPlayers?.length) {
    return NextResponse.json({ error: "Players not loaded" }, { status: 500 });
  }

  try {
    const result = await executeGuessTurn(admin, {
      roomId,
      attacker,
      targetId,
      guess,
      targetCombination: { shape: combo.shape, color: combo.color },
      revelationForTarget: revelation,
      target,
      allPlayers,
    });

    return NextResponse.json({
      ok: true,
      evaluation: result.evaluation,
      gameFinished: result.gameFinished,
      winnerPlayerId: result.winnerPlayerId,
      nextTurnPlayerId: result.nextTurnPlayerId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Guess failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
