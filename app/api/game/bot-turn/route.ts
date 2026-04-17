import { NextResponse } from "next/server";
import { pickBotGuess } from "@/lib/botGuess";
import { executeGuessTurn } from "@/lib/executeGuessTurn";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Color, Shape } from "@/lib/types";

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
  if (!roomId) {
    return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: human } = await admin
    .from("players")
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!human) {
    return NextResponse.json({ error: "Not in this room" }, { status: 403 });
  }

  const { data: room, error: roomErr } = await admin
    .from("rooms")
    .select("id, status, current_turn_player_id")
    .eq("id", roomId)
    .single();

  if (roomErr || !room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  if (room.status !== "playing" || !room.current_turn_player_id) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { data: attacker, error: aErr } = await admin
    .from("players")
    .select("id, room_id, user_id, name, errors, is_alive, turn_order, is_bot")
    .eq("id", room.current_turn_player_id)
    .eq("room_id", roomId)
    .single();

  if (aErr || !attacker) {
    return NextResponse.json({ error: "Turn player not found" }, { status: 404 });
  }

  if (!attacker.is_bot) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { data: allPlayers, error: allErr } = await admin
    .from("players")
    .select("id, is_alive, turn_order, is_bot")
    .eq("room_id", roomId);

  if (allErr || !allPlayers?.length) {
    return NextResponse.json({ error: "Players not loaded" }, { status: 500 });
  }

  const alive = allPlayers.filter((p) => p.is_alive).map((p) => p.id);

  const { data: revelations } = await admin
    .from("revelations")
    .select("player_id, shape_known, color_known, shape, color")
    .eq("room_id", roomId);

  const { data: guesses } = await admin
    .from("guesses")
    .select("attacker_id, target_id, shape, color")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(200);

  const { data: combos } = await admin
    .from("combinations")
    .select("player_id, shape, color")
    .in(
      "player_id",
      allPlayers.map((p) => p.id),
    );

  const revMap = new Map(
    (revelations ?? []).map((r) => [
      r.player_id,
      {
        shape_known: r.shape_known,
        color_known: r.color_known,
        shape: r.shape as Shape | null,
        color: r.color as Color | null,
      },
    ]),
  );

  const comboMap = new Map(
    (combos ?? []).map((c) => [
      c.player_id,
      { shape: c.shape as Shape, color: c.color as Color },
    ]),
  );

  const { targetId, guess } = pickBotGuess({
    attackerId: attacker.id,
    alivePlayerIds: alive,
    revelationsByPlayer: revMap,
    combosByTarget: comboMap,
    guesses: guesses ?? [],
  });

  const { data: target } = await admin
    .from("players")
    .select("id, room_id, errors, is_alive, turn_order")
    .eq("id", targetId)
    .eq("room_id", roomId)
    .single();

  if (!target) {
    return NextResponse.json({ error: "Target not found" }, { status: 500 });
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
    const msg = e instanceof Error ? e.message : "Bot turn failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
