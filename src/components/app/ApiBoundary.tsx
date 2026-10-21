import { useEffect, type ReactNode } from "react";
import { clearError, refreshState, useConnection } from "@/lib/store";
import { AccountSecurity } from "./AccountSecurity";

export function ApiBoundary({ children }: { children: ReactNode }) {
  const { ready, pending, error } = useConnection();
  useEffect(() => {
    try { localStorage.removeItem("vitrineic:v1"); } catch { /* navegador sem storage */ }
    void refreshState();
  }, []);
  useEffect(() => {
    if (!ready || pending) return;
    const refresh = () => { if (document.visibilityState === "visible") void refreshState(); };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [ready, pending]);
  if (!ready) return (
    <main className="grid min-h-screen place-content-center gap-5 bg-offwhite p-8 text-center text-navy" aria-busy={pending > 0}>
      <p role={error ? "alert" : "status"}>{error || "Carregando a VitrineIC…"}</p>
      {error && <button className="vt-btn vt-btn-primary" disabled={pending > 0} onClick={() => void refreshState()}>Tentar novamente</button>}
    </main>
  );
  return <>
    {error && <div role="alert" className="fixed inset-x-4 top-4 z-[100] flex items-center justify-between gap-4 rounded-xl bg-red p-4 text-white shadow-lg">
      <span>{error}</span><button onClick={clearError} className="underline">Fechar</button>
    </div>}
    {pending > 0 && <div role="status" className="fixed right-4 bottom-4 z-[100] rounded-xl bg-navy px-4 py-2 text-sm text-white">Sincronizando…</div>}
    <fieldset disabled={pending > 0} className="m-0 min-w-0 border-0 p-0" aria-busy={pending > 0}><AccountSecurity />{children}</fieldset>
  </>;
}
