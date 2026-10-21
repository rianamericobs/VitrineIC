import { useState } from "react";
import { Step1 } from "./Step1";
import { Step2 } from "./Step2";
import { Step3 } from "./Step3";
import { Step4 } from "./Step4";
import { StepIndicator } from "./StepIndicator";
import { ArrowIcon } from "@/components/app/Icons";
import { Eyebrow } from "@/components/public/Eyebrow";
import { Logo } from "@/components/public/Logo";
import { PAGE } from "@/components/public/layout";
import { BIO_MAX, fromDraft, toDraft, type ProfileDraft } from "@/lib/profile";
import { updateStudent } from "@/lib/store";
import { digits, maxLength, required, useValidation } from "@/lib/validate";
import type { Student } from "@/types";

const TITLES = ["Conte quem você é.", "Suas competências técnicas.", "Idiomas.", "Seu portfólio."];

export type OnboardingField = "name" | "unit" | "course" | "matricula" | "bio";

/**
 * Onboarding do estudante, depois do cadastro. Cada "Continuar" grava o que o
 * passo mudou, para que sair no meio não perca nada. "Pular por agora" leva ao
 * painel; o perfil só aparece na vitrine com ao menos uma competência.
 */
export function Onboarding({
  student,
  onDone,
}: {
  student: Student;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<ProfileDraft>(() => toDraft(student));

  // Só o passo 1 tem campos com regra; os outros são livres.
  const { validate, field } = useValidation<OnboardingField>(() =>
    step === 0
      ? {
          name: required(formData.name, "Informe seu nome."),
          unit: required(formData.unit, "Escolha o instituto."),
          course: required(formData.course, "Escolha o curso."),
          matricula: digits(formData.matricula),
          bio: maxLength(formData.bio, BIO_MAX),
        }
      : {},
  );

  const persist = (extra: Partial<Student> = {}) => {
    return updateStudent(student.id, { ...fromDraft(formData), ...extra });
  };

  const goTo = (target: number) => {
    setStep(target);
    window.scrollTo(0, 0);
  };

  const next = async () => {
    if (!validate()) return;
    if (step < 3) {
      if (!await persist()) return;
      goTo(step + 1);
    } else {
      if (!await persist({ onboardedAt: new Date().toISOString().slice(0, 10), onboardingSkipped: false })) return;
      onDone();
    }
  };

  const skip = async () => {
    if (!await persist({ onboardingSkipped: true })) return;
    onDone();
  };

  const update = (partial: Partial<ProfileDraft>) => setFormData({ ...formData, ...partial });

  return (
    <div className="min-h-screen bg-offwhite">
      <header className="sticky top-0 z-30 border-b border-navy/8 bg-offwhite/85 backdrop-blur-[8px]">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-5 md:px-10">
          <Logo />
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-navy/65">Onboarding</span>
        </div>
      </header>

      <main className={`${PAGE} flex flex-col gap-8 py-10 md:gap-10 md:py-14`}>
        <StepIndicator current={step} />

        <section className="vt-card p-6 md:p-10">
          <Eyebrow>Passo {String(step + 1).padStart(2, "0")}</Eyebrow>
          <h1 className="mt-4 mb-8 font-display text-[28px] font-medium leading-[1.1] tracking-[-0.025em] text-navy md:text-[36px]">
            {TITLES[step]}
          </h1>

          {step === 0 && <Step1 data={formData} setData={update} field={field} email={student.email} />}
          {step === 1 && <Step2 data={formData} setData={update} />}
          {step === 2 && <Step3 data={formData} setData={update} />}
          {step === 3 && <Step4 data={formData} setData={update} onGoToSkills={() => goTo(1)} />}

          <div className="mt-10 flex items-center justify-between gap-3 border-t border-navy/8 pt-6">
            <button
              onClick={() => goTo(Math.max(0, step - 1))}
              disabled={step === 0}
              className="rounded-[10px] px-3 py-2 font-sans text-sm text-navy/65 transition-colors hover:text-navy disabled:text-navy/30"
            >
              Voltar
            </button>
            <div className="flex items-center gap-2">
              <button onClick={skip} className="vt-btn vt-btn-ghost">
                Pular por agora
              </button>
              <button onClick={next} className="vt-btn vt-btn-primary">
                {step === 3 ? "Concluir" : "Continuar"} <ArrowIcon />
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
