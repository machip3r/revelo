"use client";

import { MAX_PLAYERS, MIN_PLAYERS } from "@/lib/constants";
import {
  getStoredDisplayName,
  setStoredDisplayName,
  useSession,
} from "@/components/SessionRoot";
import { useToast } from "@/components/Toast";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function HomePage() {
  const { ready } = useSession();
  const toast = useToast();
  const router = useRouter();
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(getStoredDisplayName());
  }, []);

  async function createRoom() {
    if (!ready) return;
    const n = name.trim();
    if (n.length < 1) {
      toast("Choose a display name first.", "err");
      return;
    }
    setBusy(true);
    try {
      setStoredDisplayName(n);
      const res = await fetch("/api/room/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Could not create room", "err");
        return;
      }
      await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
      });
      toast("Room created", "ok");
      router.push(`/room/${data.code}`);
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom() {
    if (!ready) return;
    const n = name.trim();
    const code = joinCode.trim().toUpperCase();
    if (n.length < 1) {
      toast("Choose a display name first.", "err");
      return;
    }
    if (code.length < 4) {
      toast("Enter a room code.", "err");
      return;
    }
    setBusy(true);
    try {
      setStoredDisplayName(n);
      const res = await fetch("/api/room/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Could not join", "err");
        return;
      }
      await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
      });
      toast("Joined room", "ok");
      router.push(`/room/${code}`);
    } finally {
      setBusy(false);
    }
  }

  async function quickMatch() {
    if (!ready) return;
    const n = name.trim();
    if (n.length < 1) {
      toast("Choose a display name first.", "err");
      return;
    }
    setBusy(true);
    try {
      setStoredDisplayName(n);
      const res = await fetch("/api/room/quick-join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Could not find public match", "err");
        return;
      }
      await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
      });
      toast("Public match found", "ok");
      router.push(`/room/${data.code}`);
    } finally {
      setBusy(false);
    }
  }

  function playSolo() {
    router.push("/solo");
  }

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-4 py-16">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Revelo
        </h1>
        <p className="mt-2 text-sm text-muted">
          Real-time deduction for {MIN_PLAYERS}–{MAX_PLAYERS} players. Guess
          shapes & colors — last one standing wins.
        </p>
      </div>

      <label className="block text-xs font-medium uppercase tracking-wide text-muted">
        Display name
        <input
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-accent/40"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="How others see you"
          maxLength={40}
        />
      </label>

      <div className="mt-8 space-y-3">
        <button
          type="button"
          disabled={busy || !ready}
          onClick={playSolo}
          className="w-full rounded-xl bg-success py-3 text-sm font-semibold text-white shadow-[0_8px_28px_rgba(34,197,94,0.25)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Solo vs bots
        </button>

        <button
          type="button"
          disabled={busy || !ready}
          onClick={quickMatch}
          className="w-full rounded-xl bg-accent/90 py-3 text-sm font-semibold text-white shadow-[0_8px_28px_var(--accent-glow)] hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Public room
        </button>

        <button
          type="button"
          disabled={busy || !ready}
          onClick={createRoom}
          className="w-full rounded-xl bg-gradient-to-r from-accent to-accent-hover py-3 text-sm font-semibold text-white shadow-[0_8px_32px_var(--accent-glow)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Private room
        </button>

        <div className="relative py-2 text-center text-xs uppercase tracking-widest text-faint">
          <span className="relative z-10 bg-canvas px-2">or</span>
          <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
        </div>

        <label className="block text-xs font-medium uppercase tracking-wide text-muted">
          Room Code
          <input
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent/40"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Code to join"
            maxLength={8}
          />
        </label>
        <button
          type="button"
          disabled={busy || !ready}
          onClick={joinRoom}
          className="w-full rounded-xl border border-border py-3 text-sm font-semibold text-foreground hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-40"
        >
          Join room
        </button>
      </div>

      <p className="mt-10 text-center text-xs text-faint">
        Developed with ♥︎ by{" "}
        <code className="rounded bg-surface-elevated px-1 py-0.5 text-muted">
          MacHip3r
        </code>
      </p>
    </div>
  );
}
