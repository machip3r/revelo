import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { MAX_PLAYERS, MIN_PLAYERS } from "@/lib/constants";
import { pickRandomCombinations } from "@/lib/combinationAssign";
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
    .select("id, status, host_user_id")
    .eq("id", roomId)
    .single();

  if (roomErr || !room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  if (room.host_user_id !== user.id) {
    return NextResponse.json({ error: "Only the host can start" }, { status: 403 });
  }
  if (room.status !== "waiting") {
    return NextResponse.json({ error: "Game already started" }, { status: 400 });
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
      {
        error: `Need between ${MIN_PLAYERS} and ${MAX_PLAYERS} players to start`,
      },
      { status: 400 },
    );
  }

  const combos = pickRandomCombinations(players.length);

  for (let i = 0; i < players.length; i++) {
    const pl = players[i]!;
    const c = combos[i]!;
    const { error: cErr } = await admin.from("combinations").insert({
      player_id: pl.id,
      shape: c.shape,
      color: c.color,
    });
    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 500 });
    }

    const { error: rErr } = await admin.from("revelations").insert({
      room_id: roomId,
      player_id: pl.id,
      shape_known: false,
      color_known: false,
    });
    if (rErr) {
      return NextResponse.json({ error: rErr.message }, { status: 500 });
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

  const { error: upErr } = await admin
    .from("rooms")
    .update({
      status: "playing",
      current_turn_player_id: starter.id,
      turn_deadline_at: deadline,
    })
    .eq("id", roomId);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, firstTurnPlayerId: starter.id });
}
