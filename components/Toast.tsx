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
              t.tone === "ok" &&
                "border-success/50 bg-success/15 text-foreground dark:bg-success/20",
              t.tone === "err" &&
                "border-danger/50 bg-danger/15 text-foreground dark:bg-danger/20",
              t.tone === "info" && "border-border bg-surface/95 text-foreground backdrop-blur",
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
