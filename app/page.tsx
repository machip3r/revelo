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

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-4 py-16">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
          Revelo
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Real-time deduction for {MIN_PLAYERS}–{MAX_PLAYERS} players. Guess
          shapes & colors — last one standing wins.
        </p>
      </div>

      <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
        Display name
        <input
          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-violet-500/0 transition focus:ring-2 focus:ring-violet-500/40"
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
          onClick={createRoom}
          className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Create room
        </button>

        <div className="relative py-2 text-center text-xs uppercase tracking-widest text-zinc-600">
          <span className="relative z-10 bg-[var(--background)] px-2">or</span>
          <span className="absolute inset-x-0 top-1/2 h-px bg-zinc-800" />
        </div>

        <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
          Room Code
          <input
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-violet-500/40"
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
          className="w-full rounded-xl border border-zinc-700 py-3 text-sm font-semibold text-zinc-100 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Join room
        </button>
      </div>

      <p className="mt-10 text-center text-xs text-zinc-600">
        Developed with ♥︎ by{" "}
        <code className="rounded bg-zinc-900 px-1 py-0.5 text-zinc-400">
          MacHip3r
        </code>
      </p>
    </div>
  );
}
