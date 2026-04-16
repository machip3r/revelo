import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get("code") ?? "").trim().toUpperCase();
  if (code.length < 4) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();

  const { data: room, error: rErr } = await admin
    .from("rooms")
    .select("id, code, status, host_user_id, current_turn_player_id, created_at")
    .eq("code", code)
    .maybeSingle();

  if (rErr) {
    return NextResponse.json({ error: rErr.message }, { status: 500 });
  }
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const { data: players } = await admin
    .from("players")
    .select("id, name, errors, is_alive, turn_order, user_id")
    .eq("room_id", room.id)
    .order("turn_order", { ascending: true });

  let myPlayerId: string | null = null;
  if (user) {
    const mine = players?.find((p) => p.user_id === user.id);
    myPlayerId = mine?.id ?? null;
  }

  return NextResponse.json({
    room,
    players: players ?? [],
    myPlayerId,
    isHost: user ? room.host_user_id === user.id : false,
  });
}
