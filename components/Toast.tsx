"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type ToastMessage = { id: number; text: string; tone: "ok" | "err" | "info" };

const ToastCtx = createContext<(text: string, tone?: ToastMessage["tone"]) => void>(
  () => {},
);

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastMessage[]>([]);

  const push = useCallback((text: string, tone: ToastMessage["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, text, tone }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id));
    }, 3200);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={[
              "pointer-events-auto rounded-lg border px-4 py-2 text-sm shadow-lg backdrop-blur",
              t.tone === "ok" && "border-emerald-500/40 bg-emerald-950/90 text-emerald-50",
              t.tone === "err" && "border-rose-500/40 bg-rose-950/90 text-rose-50",
              t.tone === "info" && "border-zinc-600 bg-zinc-900/95 text-zinc-100",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
