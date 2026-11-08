"use client";

import { createContext, useContext, useEffect, useState, useTransition, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type Session = {
  month: string;
  requestedMonth: string;
  setRequestedMonth: (month: string) => void;
  blocked: boolean;
  loading: boolean;
  navigate: (href: string) => void;
  drafts: Map<string, unknown>;
  clear: (prefix: string) => void;
  update: (key: string, initial: unknown, change: (previous: unknown) => unknown) => void;
};
const BillSession = createContext<Session | null>(null);

// This store lives only as long as this popup. Nothing is saved to the database
// or browser storage. Amounts/readings belong to their own month; the received
// date and payment method are shared while switching months in this popup.
export function BillFormSession({ month, children }: { month: string; children: ReactNode }) {
  const router = useRouter();
  const [requestedMonth, setRequestedMonth] = useState(month);
  const [loading, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Map<string, unknown>>(() => new Map());
  const blocked = loading || requestedMonth !== month;
  const dirty = drafts.size > 0;
  useEffect(() => {
    const notify = (value: boolean) => {
      if (window.parent !== window) window.parent.postMessage({ type: "rent-bill-dirty", dirty: value }, window.location.origin);
    };
    notify(dirty);
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => { notify(false); window.removeEventListener("beforeunload", warn); };
  }, [dirty]);
  return <BillSession.Provider value={{
    month, requestedMonth, setRequestedMonth, blocked, loading, drafts,
    clear: (prefix) => setDrafts((previous) => new Map([...previous].filter(([key]) => !key.startsWith(prefix)))),
    navigate: (href) => startTransition(() => router.push(href)),
    update: (key, initial, change) => setDrafts((previous) => {
      const next = new Map(previous);
      next.set(key, change(previous.has(key) ? previous.get(key) : initial));
      return next;
    }),
  }}>{children}</BillSession.Provider>;
}

export function useBillSession() { return useContext(BillSession); }

export function useBillDraft<T>(key: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const session = useBillSession();
  const [fallback, setFallback] = useState(initial);
  if (!session) return [fallback, setFallback];
  const value = session.drafts.has(key) ? session.drafts.get(key) as T : fallback;
  return [value, (next) => session.update(key, fallback, (previous) =>
    typeof next === "function" ? (next as (value: T) => T)(previous as T) : next)];
}

export function BillMonthContent({ children }: { children: ReactNode }) {
  const session = useBillSession();
  const t = useTranslations("Properties");
  return <div onSubmitCapture={(event) => {
    if (session?.blocked) { event.preventDefault(); event.stopPropagation(); }
  }}>
    {session?.blocked ? <p role="status" className="mb-3 rounded-md border bg-muted px-3 py-2 text-sm">
      {t(session.loading ? "invoiceMonthLoading" : "invoiceMonthApplyFirst")}
    </p> : null}
    <fieldset disabled={session?.blocked} aria-busy={session?.loading} className="min-w-0 space-y-3 border-0 p-0 disabled:opacity-60">
      {children}
    </fieldset>
  </div>;
}
