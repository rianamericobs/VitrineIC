import { useEffect, useState } from "react";
import { CompanyForm } from "./CompanyForm";
import { RequesterSignUp } from "./RequesterSignUp";
import { StudentForm } from "./StudentForm";
import { StudentSignUp } from "./StudentSignUp";
import { Divider } from "./ui";
import { Eyebrow } from "@/components/public/Eyebrow";
import { signInDemo } from "@/lib/auth";
import { useVitrine } from "@/lib/store";
import type { Role } from "@/types";

type Tab = "student" | "requester";

const ROLES = [
  { id: "student", label: "Sou estudante" },
  { id: "requester", label: "Sou solicitante" },
] as const;

const SIGN_UP_COPY: Record<Tab, { eyebrow: string; title: string; lead: string }> = {
  student: {
    eyebrow: "Criar conta · Estudante",
    title: "Mostre o que você já construiu.",
    lead: "Depois da conta, o onboarding pede suas competências e projetos.",
  },
  requester: {
    eyebrow: "Criar conta · Solicitante",
    title: "Encontre estudantes para sua demanda.",
    lead: "É o perfil que o estudante vê antes de aceitar um contato.",
  },
};

/**
 * Modal de acesso: login nas abas de estudante e solicitante, e o cadastro de
 * cada papel. A curadoria entra por página própria (`CuratorSignIn`).
 */
export function AuthModal({ onClose, onSignedIn }: { onClose: () => void; onSignedIn: (role: Role) => void }) {
  const { demo: demoEnabled } = useVitrine();
  const [demoError, setDemoError] = useState("");
  const [tab, setTab] = useState<Tab>("student");
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    document.body.classList.add("modal-open");
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const demo = async (role: Role) => {
    const result = await signInDemo(role);
    if (result.ok) onSignedIn(role);
    else setDemoError(result.error);
  };

  const copy = SIGN_UP_COPY[tab];

  return (
    <div
      className="fixed inset-0 z-50 flex overflow-y-auto bg-navy/55 p-4 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className={`relative m-auto w-full rounded-3xl bg-white p-6 shadow-[0_40px_80px_-24px_rgba(11,37,69,0.45)] sm:p-8 ${
          mode === "signup" ? "max-w-[560px]" : "max-w-[440px]"
        }`}
      >
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 grid size-8 place-items-center rounded-lg text-navy/55 transition-colors hover:bg-navy/5 hover:text-navy"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>

        {mode === "signup" ? (
          <>
            <button
              onClick={() => setMode("signin")}
              className="mb-5 font-sans text-[13px] text-navy/65 transition-colors hover:text-navy"
            >
              ← Voltar para entrar
            </button>
            <Eyebrow>{copy.eyebrow}</Eyebrow>
            <h2 id="auth-title" className="mt-3 font-display text-2xl font-medium tracking-[-0.02em] text-navy">
              {copy.title}
            </h2>
            <p className="mt-2 mb-6 font-sans text-sm text-navy/65">{copy.lead}</p>
            {tab === "student" ? (
              <StudentSignUp onSignedUp={() => onSignedIn("student")} />
            ) : (
              <RequesterSignUp onSignedUp={() => onSignedIn("requester")} />
            )}
          </>
        ) : (
          <>
            <Eyebrow>Acesso</Eyebrow>
            <h2 id="auth-title" className="mt-3 font-display text-2xl font-medium tracking-[-0.02em] text-navy">
              Entrar na VitrineIC.
            </h2>

            <div className="mt-6 grid grid-cols-2 rounded-xl bg-navy/5 p-1">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setTab(r.id)}
                  aria-pressed={tab === r.id}
                  className={`h-9 rounded-lg px-2 font-sans text-[13px] transition-colors sm:text-sm ${
                    tab === r.id ? "bg-white text-navy shadow-[0_1px_3px_rgba(11,37,69,0.12)]" : "text-navy/55 hover:text-navy"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <div className="mt-6">
              {/* `key` zera o formulário ao trocar de aba. */}
              {tab === "student" ? (
                <StudentForm key="student" onSignedIn={onSignedIn} />
              ) : (
                <CompanyForm key="requester" onSignedIn={onSignedIn} />
              )}
            </div>

            <p className="mt-5 text-center font-sans text-[13px] text-navy/65">
              Ainda não tem conta?{" "}
              <button onClick={() => setMode("signup")} className="text-navy underline underline-offset-4 hover:text-red">
                Criar conta
              </button>
            </p>

            {demoEnabled && <><Divider label="Contas de demonstração" />
            <div className="grid grid-cols-2 gap-2.5">
              <button onClick={() => demo("student")} className="vt-btn vt-btn-secondary justify-center">
                Estudante de exemplo
              </button>
              <button onClick={() => demo("requester")} className="vt-btn vt-btn-secondary justify-center">
                Solicitante de exemplo
              </button>
            </div>
            <p className="mt-4 text-center font-sans text-xs text-navy/55">
              Ambiente com dados fictícios para demonstração.
            </p>
            {demoError && <p role="alert" className="text-sm text-red">{demoError}</p>}</>}
          </>
        )}
      </div>
    </div>
  );
}
