import { NextResponse } from "next/server";
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
  if (room.host_user_id === user.id) {
    return NextResponse.json(
      { error: "Host cannot leave. Close the room instead." },
      { status: 400 },
    );
  }

  const { error: delErr } = await admin
    .from("players")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", user.id);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
