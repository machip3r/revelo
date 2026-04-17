"use client";

export function Spinner({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-label="Loading"
      className="inline-block animate-spin rounded-full border-2 border-border border-t-accent"
      style={{ width: size, height: size }}
    />
  );
}
