import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateRoomCode } from "@/lib/roomCode";

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

  const { error: userErr } = await admin.from("users").upsert(
    { id: user.id, name },
    { onConflict: "id" },
  );
  if (userErr) {
    return NextResponse.json({ error: userErr.message }, { status: 500 });
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateRoomCode();
    const { data: room, error: roomErr } = await admin
      .from("rooms")
      .insert({
        code,
        status: "waiting",
        host_user_id: user.id,
        current_turn_player_id: null,
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

    if (pErr) {
      await admin.from("rooms").delete().eq("id", room.id);
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    return NextResponse.json({
      roomId: room.id,
      code: room.code,
      playerId: player.id,
    });
  }

  return NextResponse.json({ error: "Could not allocate room code" }, { status: 500 });
}
