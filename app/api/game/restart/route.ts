import { NextResponse } from "next/server";
import { pickRandomCombinations } from "@/lib/combinationAssign";
import { MAX_PLAYERS, MIN_PLAYERS } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { nextTurnDeadlineIso } from "@/lib/turnDeadline";

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

  const { data: room, error: roomErr } = await admin
    .from("rooms")
    .select("id, host_user_id")
    .eq("id", roomId)
    .maybeSingle();

  if (roomErr || !room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  if (room.host_user_id !== user.id) {
    return NextResponse.json({ error: "Only host can restart" }, { status: 403 });
  }

  const { data: players, error: pErr } = await admin
    .from("players")
    .select("id, turn_order")
    .eq("room_id", roomId)
    .order("turn_order", { ascending: true });
  if (pErr || !players?.length) {
    return NextResponse.json({ error: "No players in room" }, { status: 400 });
  }
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    return NextResponse.json(
      { error: `Need between ${MIN_PLAYERS} and ${MAX_PLAYERS} players.` },
      { status: 400 },
    );
  }

  const playerIds = players.map((p) => p.id);

  const { error: gDelErr } = await admin.from("guesses").delete().eq("room_id", roomId);
  if (gDelErr) {
    return NextResponse.json({ error: gDelErr.message }, { status: 500 });
  }

  const { error: rDelErr } = await admin.from("revelations").delete().eq("room_id", roomId);
  if (rDelErr) {
    return NextResponse.json({ error: rDelErr.message }, { status: 500 });
  }

  const { error: cDelErr } = await admin
    .from("combinations")
    .delete()
    .in("player_id", playerIds);
  if (cDelErr) {
    return NextResponse.json({ error: cDelErr.message }, { status: 500 });
  }

  const { error: pResetErr } = await admin
    .from("players")
    .update({ errors: 0, is_alive: true })
    .eq("room_id", roomId);
  if (pResetErr) {
    return NextResponse.json({ error: pResetErr.message }, { status: 500 });
  }

  const combos = pickRandomCombinations(players.length);
  for (let i = 0; i < players.length; i++) {
    const pl = players[i]!;
    const combo = combos[i]!;

    const { error: comboErr } = await admin.from("combinations").insert({
      player_id: pl.id,
      shape: combo.shape,
      color: combo.color,
    });
    if (comboErr) {
      return NextResponse.json({ error: comboErr.message }, { status: 500 });
    }

    const { error: revErr } = await admin.from("revelations").insert({
      room_id: roomId,
      player_id: pl.id,
      shape_known: false,
      color_known: false,
    });
    if (revErr) {
      return NextResponse.json({ error: revErr.message }, { status: 500 });
    }
  }

  const starter = players[Math.floor(Math.random() * players.length)]!;

  const { data: turnMeta } = await admin
    .from("players")
    .select("id, is_bot")
    .eq("room_id", roomId);

  const deadline = nextTurnDeadlineIso(
    starter.id,
    turnMeta ?? [],
  );

  const { error: roomUpErr } = await admin
    .from("rooms")
    .update({
      status: "playing",
      current_turn_player_id: starter.id,
      turn_deadline_at: deadline,
    })
    .eq("id", roomId);
  if (roomUpErr) {
    return NextResponse.json({ error: roomUpErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, firstTurnPlayerId: starter.id });
}
