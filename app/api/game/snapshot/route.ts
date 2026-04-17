import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("roomId") ?? "";
  if (!roomId) {
    return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: player, error: pErr } = await admin
    .from("players")
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (pErr || !player) {
    return NextResponse.json({ error: "Not in this room" }, { status: 403 });
  }

  const { data: room, error: rErr } = await admin
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  if (rErr || !room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const { data: players } = await admin
    .from("players")
    .select("id, name, errors, is_alive, turn_order, user_id, is_bot")
    .eq("room_id", roomId)
    .order("turn_order", { ascending: true });

  const { data: revelations } = await admin
    .from("revelations")
    .select("*")
    .eq("room_id", roomId);

  const { data: guesses } = await admin
    .from("guesses")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(80);

  const { data: myCombo } = await admin
    .from("combinations")
    .select("shape, color")
    .eq("player_id", player.id)
    .maybeSingle();

  return NextResponse.json({
    room,
    players: players ?? [],
    revelations: revelations ?? [],
    guesses: guesses ?? [],
    myPlayerId: player.id,
    myCombination: myCombo,
    isHost: room.host_user_id === user.id,
  });
}
