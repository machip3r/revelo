import { GameClient } from "./GameClient";

export const dynamic = "force-dynamic";

export default async function GamePage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return <GameClient roomId={roomId} />;
}
