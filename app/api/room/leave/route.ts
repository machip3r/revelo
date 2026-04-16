import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function nextAliveAfter(
  players: { id: string; is_alive: boolean; turn_order: number }[],
  afterPlayerId: string,
): string | null {
  const alive = players
    .filter((p) => p.is_alive)
    .sort((a, b) => a.turn_order - b.turn_order);
  if (alive.length === 0) return null;
  const idx = alive.findIndex((p) => p.id === afterPlayerId);
  if (idx === -1) return alive[0]?.id ?? null;
  return alive[(idx + 1) % alive.length]?.id ?? null;
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

  const { data: room, error: roomErr } = await admin
    .from("rooms")
    .select("id, host_user_id, status, current_turn_player_id")
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

  const { data: me, error: meErr } = await admin
    .from("players")
    .select("id, is_alive")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (meErr || !me) {
    return NextResponse.json({ ok: true });
  }

  // In lobby: remove player from room.
  if (room.status === "waiting") {
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

  // In active game: reveal this player's secret and mark as out.
  const { data: combo, error: comboErr } = await admin
    .from("combinations")
    .select("shape, color")
    .eq("player_id", me.id)
    .maybeSingle();

  if (comboErr) {
    return NextResponse.json({ error: comboErr.message }, { status: 500 });
  }

  if (combo) {
    const { error: revErr } = await admin
      .from("revelations")
      .update({
        shape_known: true,
        color_known: true,
        shape: combo.shape,
        color: combo.color,
      })
      .eq("room_id", roomId)
      .eq("player_id", me.id);
    if (revErr) {
      return NextResponse.json({ error: revErr.message }, { status: 500 });
    }
  }

  const { error: outErr } = await admin
    .from("players")
    .update({
      is_alive: false,
      errors: 2,
    })
    .eq("id", me.id);
  if (outErr) {
    return NextResponse.json({ error: outErr.message }, { status: 500 });
  }

  const { data: allPlayers, error: allErr } = await admin
    .from("players")
    .select("id, is_alive, turn_order")
    .eq("room_id", roomId);

  if (allErr || !allPlayers) {
    return NextResponse.json({ error: "Could not update turn state" }, { status: 500 });
  }

  const living = allPlayers.filter((p) => p.is_alive);
  if (living.length <= 1) {
    const winnerId = living.length === 1 ? living[0]!.id : null;
    const { error: finishErr } = await admin
      .from("rooms")
      .update({
        status: "finished",
        current_turn_player_id: winnerId,
      })
      .eq("id", roomId);
    if (finishErr) {
      return NextResponse.json({ error: finishErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, gameFinished: true });
  }

  if (room.current_turn_player_id === me.id) {
    const nextTurn = nextAliveAfter(allPlayers, me.id);
    const { error: turnErr } = await admin
      .from("rooms")
      .update({ current_turn_player_id: nextTurn })
      .eq("id", roomId);
    if (turnErr) {
      return NextResponse.json({ error: turnErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
