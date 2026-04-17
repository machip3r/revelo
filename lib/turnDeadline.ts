import { TURN_TIME_LIMIT_MS } from "./constants";

export function nextTurnDeadlineIso(
  nextTurnPlayerId: string | null,
  players: { id: string; is_bot: boolean }[],
): string | null {
  if (!nextTurnPlayerId) return null;
  const p = players.find((x) => x.id === nextTurnPlayerId);
  if (!p || p.is_bot) return null;
  return new Date(Date.now() + TURN_TIME_LIMIT_MS).toISOString();
}
