import { NextResponse } from "next/server";
import { LOBBY_AUTOFILL_FIRST_DELAY_MS, MAX_PLAYERS } from "@/lib/constants";
import { generateRoomCode } from "@/lib/roomCode";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 40) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error: userErr } = await admin
    .from("users")
    .upsert({ id: user.id, name }, { onConflict: "id" });
  if (userErr) {
    return NextResponse.json({ error: userErr.message }, { status: 500 });
  }

  const { data: existingPlayer } = await admin
    .from("players")
    .select("id, room_id")
    .eq("user_id", user.id)
    .order("turn_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingPlayer) {
    const { data: existingRoom } = await admin
      .from("rooms")
      .select("id, code, status")
      .eq("id", existingPlayer.room_id)
      .maybeSingle();
    if (existingRoom?.status === "waiting") {
      return NextResponse.json({
        roomId: existingRoom.id,
        code: existingRoom.code,
        playerId: existingPlayer.id,
      });
    }
  }

  const { data: waitingRooms, error: roomsErr } = await admin
    .from("rooms")
    .select("id, code, created_at")
    .eq("status", "waiting")
    .eq("is_public", true)
    .order("created_at", { ascending: true })
    .limit(30);

  if (roomsErr) {
    return NextResponse.json({ error: roomsErr.message }, { status: 500 });
  }

  for (const room of waitingRooms ?? []) {
    const { data: mine } = await admin
      .from("players")
      .select("id")
      .eq("room_id", room.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (mine) {
      return NextResponse.json({
        roomId: room.id,
        code: room.code,
        playerId: mine.id,
      });
    }

    const { count } = await admin
      .from("players")
      .select("*", { count: "exact", head: true })
      .eq("room_id", room.id);
    if ((count ?? 0) >= MAX_PLAYERS) {
      continue;
    }

    const { data: maxRow } = await admin
      .from("players")
      .select("turn_order")
      .eq("room_id", room.id)
      .order("turn_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (maxRow?.turn_order ?? -1) + 1;
    const { data: player, error: pErr } = await admin
      .from("players")
      .insert({
        room_id: room.id,
        user_id: user.id,
        name,
        turn_order: nextOrder,
        errors: 0,
        is_alive: true,
      })
      .select("id")
      .single();

    if (!pErr && player) {
      return NextResponse.json({
        roomId: room.id,
        code: room.code,
        playerId: player.id,
      });
    }
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateRoomCode();
    const autofillAt = new Date(
      Date.now() + LOBBY_AUTOFILL_FIRST_DELAY_MS,
    ).toISOString();

    const { data: room, error: roomErr } = await admin
      .from("rooms")
      .insert({
        code,
        is_public: true,
        status: "waiting",
        host_user_id: user.id,
        current_turn_player_id: null,
        lobby_autofill_next_at: autofillAt,
      })
      .select("id, code")
      .single();

    if (roomErr) {
      if (roomErr.code === "23505") continue;
      return NextResponse.json({ error: roomErr.message }, { status: 500 });
    }

    const { data: player, error: pErr } = await admin
      .from("players")
      .insert({
        room_id: room.id,
        user_id: user.id,
        name,
        turn_order: 0,
        errors: 0,
        is_alive: true,
      })
      .select("id")
      .single();
    if (pErr || !player) {
      await admin.from("rooms").delete().eq("id", room.id);
      return NextResponse.json({ error: pErr?.message ?? "Could not create player" }, { status: 500 });
    }

    return NextResponse.json({
      roomId: room.id,
      code: room.code,
      playerId: player.id,
    });
  }

  return NextResponse.json(
    { error: "Could not find or create a public room" },
    { status: 500 },
  );
}
