import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { MAX_PLAYERS } from "@/lib/constants";

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
  const code =
    typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (code.length < 4 || name.length < 1 || name.length > 40) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error: userErr } = await admin.from("users").upsert(
    { id: user.id, name },
    { onConflict: "id" },
  );
  if (userErr) {
    return NextResponse.json({ error: userErr.message }, { status: 500 });
  }

  const { data: room, error: roomErr } = await admin
    .from("rooms")
    .select("id, status")
    .eq("code", code)
    .maybeSingle();

  if (roomErr || !room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  if (room.status !== "waiting") {
    return NextResponse.json({ error: "Game already started" }, { status: 400 });
  }

  const { data: existing } = await admin
    .from("players")
    .select("id")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      roomId: room.id,
      playerId: existing.id,
    });
  }

  const { count, error: countErr } = await admin
    .from("players")
    .select("*", { count: "exact", head: true })
    .eq("room_id", room.id);

  if (countErr) {
    return NextResponse.json({ error: countErr.message }, { status: 500 });
  }
  if ((count ?? 0) >= MAX_PLAYERS) {
    return NextResponse.json({ error: "Room is full" }, { status: 400 });
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

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  return NextResponse.json({
    roomId: room.id,
    playerId: player.id,
  });
}
