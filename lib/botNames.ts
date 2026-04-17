const POOL = [
  "Diebot",
  "Mallocbot",
  "Maxbot",
  "Uvibot",
  "Oskybot",
  "Stackbot",
  "Heapbot",
  "Cachebot",
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function pickBotDisplayName(existing: string[]): string {
  const taken = new Set(existing.map((n) => n.toLowerCase()));
  const free = POOL.filter((n) => !taken.has(n.toLowerCase()));
  if (free.length > 0) return randomFrom(free);
  return `Bot ${100 + Math.floor(Math.random() * 900)}`;
}
