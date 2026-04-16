"use client";

export function Spinner({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-label="Loading"
      className="inline-block animate-spin rounded-full border-2 border-zinc-700 border-t-violet-400"
      style={{ width: size, height: size }}
    />
  );
}
