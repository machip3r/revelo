import { NextResponse } from "next/server";
import {
  LOBBY_AUTOFILL_BOT_GAP_MAX_MS,
  LOBBY_AUTOFILL_BOT_GAP_MIN_MS,
  LOBBY_AUTOFILL_FIRST_DELAY_MS,
  LOBBY_AUTOFILL_MAX_HUMANS,
  MAX_PLAYERS,
} from "@/lib/constants";
import { pickBotDisplayName } from "@/lib/botNames";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function randomGapMs(): number {
  return (
    LOBBY_AUTOFILL_BOT_GAP_MIN_MS +
    Math.floor(
      Math.random() *
        (LOBBY_AUTOFILL_BOT_GAP_MAX_MS - LOBBY_AUTOFILL_BOT_GAP_MIN_MS + 1),
    )
  );
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
  if (!roomId) {
    return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: me } = await admin
    .from("players")
    .select("id, is_bot")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!me || me.is_bot) {
    return NextResponse.json({ error: "Not in this room" }, { status: 403 });
  }

  const { data: room, error: rErr } = await admin
    .from("rooms")
    .select(
      "id, status, is_public, created_at, lobby_autofill_next_at",
    )
    .eq("id", roomId)
    .maybeSingle();

  if (rErr || !room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (!room.is_public || room.status !== "waiting") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { data: players, error: pErr } = await admin
    .from("players")
    .select("id, name, is_bot, turn_order")
    .eq("room_id", roomId);

  if (pErr || !players?.length) {
    return NextResponse.json({ error: "Players not loaded" }, { status: 500 });
  }

  const humans = players.filter((p) => !p.is_bot);
  const humanCount = humans.length;

  if (humanCount > LOBBY_AUTOFILL_MAX_HUMANS || humanCount < 1) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (players.length >= MAX_PLAYERS) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const now = Date.now();
  const nextFillAt = room.lobby_autofill_next_at
    ? new Date(room.lobby_autofill_next_at).getTime()
    : new Date(room.created_at).getTime() + LOBBY_AUTOFILL_FIRST_DELAY_MS;

  if (now < nextFillAt) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const maxOrder = Math.max(...players.map((p) => p.turn_order), -1);
  const name = pickBotDisplayName(players.map((p) => p.name));

  const { data: bot, error: insErr } = await admin
    .from("players")
    .insert({
      room_id: roomId,
      user_id: null,
      is_bot: true,
      name,
      turn_order: maxOrder + 1,
      errors: 0,
      is_alive: true,
    })
    .select("id")
    .single();

  if (insErr || !bot) {
    return NextResponse.json({ error: insErr?.message ?? "Insert failed" }, { status: 500 });
  }

  const nextAt = new Date(now + randomGapMs()).toISOString();
  const { error: upErr } = await admin
    .from("rooms")
    .update({ lobby_autofill_next_at: nextAt })
    .eq("id", roomId);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, addedBotId: bot.id });
}
