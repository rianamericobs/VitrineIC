import { useState } from "react";
import { Input, Label, SelectField } from "./ui";
import { ArrowIcon } from "@/components/app/Icons";
import { StepIndicator } from "@/components/app/StepIndicator";
import { BackButton } from "@/components/public/BackButton";
import { Eyebrow } from "@/components/public/Eyebrow";
import { PAGE } from "@/components/public/layout";
import { addDemand } from "@/lib/store";
import { required, useValidation } from "@/lib/validate";

export const WIZARD_STEPS = ["Contexto", "Escopo técnico", "Prazo e formato", "Revisão"];

const TITLES = ["Qual problema resolver?", "O que precisa ser feito?", "Quando e como?", "Revise a demanda."];

export const AREA_OPTIONS = [
  "Inteligência Artificial / ML",
  "Engenharia de Software",
  "Sistemas Web / Mobile",
  "Redes & Segurança",
  "Banco de Dados / Dados",
  "Computação em Nuvem",
  "Robótica / Embarcados",
  "Bioinformática",
  "Outra área",
];

export const SCOPE_OPTIONS = ["Pequeno (< 3 meses)", "Médio (3–6 meses)", "Grande (6–12 meses)"];

export function NewDemandWizard({
  onSuccess,
  onCancel,
}: {
  onSuccess: (protocol: string) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    title: "",
    problem: "",
    audience: "",
    academicLevel: "",
    area: "",
    scope: "",
    deadline: "",
    budget: "",
    skills: "",
    teamSize: "",
    notes: "",
  });

  const update = (k: string, v: string) => setForm({ ...form, [k]: v });
  const skillList = form.skills.split(",").map((t) => t.trim()).filter(Boolean);

  // Cada passo valida só os próprios campos; a revisão já chega com tudo certo.
  const { validate, field, reset } = useValidation<"title" | "problem" | "skills" | "deadline">(() => {
    if (step === 0)
      return {
        title: required(form.title, "Dê um título à demanda."),
        problem: required(form.problem, "Explique o contexto da demanda."),
      };
    if (step === 1) return { skills: skillList.length ? null : "Informe ao menos uma tecnologia." };
    if (step === 2) return { deadline: required(form.deadline, "Informe o prazo final.") };
    return {};
  });

  const goTo = (target: number) => {
    reset();
    setStep(target);
  };

  const next = async () => {
    if (!validate()) return;
    if (step < 3) goTo(step + 1);
    else {
      const demand = await addDemand({
        title: form.title.trim(),
        area: form.area || "Outra área",
        scope: form.scope || "A definir",
        deadline: form.deadline,
        skills: skillList,
        description: form.problem.trim(),
        audience: form.audience,
        academicLevel: form.academicLevel,
        notes: form.notes,
        teamSize: form.teamSize,
        budget: form.budget,
      });
      if (demand) onSuccess(demand.id);
    }
  };

  const fieldsBystep = [
    /* 01 · Contexto */
    <div key="s0" className="flex flex-col gap-5">
      <Input
        label="Título da demanda"
        placeholder="Ex: Sistema de monitoramento em tempo real para sensores IoT"
        value={form.title}
        onChange={(v) => update("title", v)}
        {...field("title")}
      />
      <Input
        label="Contexto"
        placeholder="Explique o contexto, o problema atual e por que ele precisa ser resolvido..."
        textarea
        rows={4}
        value={form.problem}
        onChange={(v) => update("problem", v)}
        {...field("problem")}
      />
      <div className="grid gap-5 md:grid-cols-2">
        <Input
          label="Público-alvo / beneficiários"
          placeholder="Ex: Operadores de fábrica, equipe de TI..."
          value={form.audience}
          onChange={(v) => update("audience", v)}
        />
        <SelectField
          label="Área tecnológica"
          options={AREA_OPTIONS}
          value={form.area}
          onChange={(v) => update("area", v)}
        />
      </div>
    </div>,

    /* 02 · Escopo técnico */
    <div key="s1" className="flex flex-col gap-5">
      <Input
        label="Entregáveis e requisitos adicionais"
        placeholder="Liste o que espera receber: código-fonte, relatório, protótipo, deploy... e restrições como NDA ou presencial."
        textarea
        rows={4}
        value={form.notes}
        onChange={(v) => update("notes", v)}
      />
      <Input
        label="Tecnologias desejadas"
        placeholder="Ex: Python, React, Docker, PostgreSQL..."
        mono
        value={form.skills}
        onChange={(v) => update("skills", v)}
        hint="Separe por vírgula."
        {...field("skills")}
      />
      {form.skills.trim() && (
        <div className="-mt-2 flex flex-wrap gap-1.5">
          {form.skills
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .map((t) => (
              <span key={t} className="vt-pill vt-pill-selected">
                {t}
              </span>
            ))}
        </div>
      )}
      <Input
        label="Nível acadêmico mínimo"
        placeholder="Ex: 3º semestre em diante, qualquer semestre..."
        value={form.academicLevel}
        onChange={(v) => update("academicLevel", v)}
      />
    </div>,

    /* 03 · Prazo e formato */
    <div key="s2" className="flex flex-col gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        <SelectField
          label="Duração"
          options={SCOPE_OPTIONS}
          value={form.scope}
          onChange={(v) => update("scope", v)}
        />
        <Input
          label="Prazo final"
          type="date"
          value={form.deadline}
          onChange={(v) => update("deadline", v)}
          mono
          {...field("deadline")}
        />
        <Input
          label="Equipe desejada"
          placeholder="Ex: 1 estudante, dupla, grupo de 3..."
          value={form.teamSize}
          onChange={(v) => update("teamSize", v)}
        />
        <Input
          label="Bolsa / orçamento (R$)"
          placeholder="Ex: 1.800 ou a combinar"
          mono
          value={form.budget}
          onChange={(v) => update("budget", v)}
        />
      </div>
      <p className="rounded-xl bg-navy/[0.03] px-4 py-3 font-sans text-[13px] leading-[1.6] text-navy/60">
        Após o envio, a curadoria revisa a demanda em até 5 dias úteis. Depois de aprovada, ela aparece para os
        estudantes e você recebe candidaturas e sugestões da curadoria.
      </p>
    </div>,

    /* 04 · Revisão */
    <div key="s3">
      <dl className="divide-y divide-navy/8 border-y border-navy/8">
        {[
          { label: "Título", value: form.title },
          { label: "Área", value: form.area },
          { label: "Tecnologias", value: form.skills },
          { label: "Prazo", value: [form.scope, form.deadline].filter(Boolean).join(" · ") },
          { label: "Formato", value: [form.teamSize, form.budget && `R$ ${form.budget}`].filter(Boolean).join(" · ") },
        ].map((r) => (
          <div key={r.label} className="flex flex-col gap-1 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
            <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-navy/55">{r.label}</dt>
            <dd className="font-sans text-sm text-navy sm:text-right">{r.value || "—"}</dd>
          </div>
        ))}
      </dl>
      {form.problem && (
        <div className="mt-6">
          <Label>Contexto</Label>
          <p className="font-sans text-sm leading-[1.6] text-navy/65">{form.problem}</p>
        </div>
      )}
    </div>,
  ];

  return (
    <main className={`${PAGE} flex flex-col gap-8 pt-8 pb-10 md:gap-10 md:pb-14`}>
      <BackButton label="Voltar para minhas demandas" onClick={onCancel} />
      <StepIndicator steps={WIZARD_STEPS} current={step} />

      <section className="vt-card p-6 md:p-10">
        <Eyebrow>Passo {String(step + 1).padStart(2, "0")}</Eyebrow>
        <h1 className="mt-4 mb-8 font-display text-[28px] font-medium leading-[1.1] tracking-[-0.025em] text-navy md:text-[36px]">
          {TITLES[step]}
        </h1>

        {fieldsBystep[step]}

        <div className="mt-10 flex items-center justify-between border-t border-navy/8 pt-6">
          <button
            onClick={() => goTo(Math.max(0, step - 1))}
            disabled={step === 0}
            className="rounded-[10px] px-3 py-2 font-sans text-sm text-navy/65 transition-colors hover:text-navy disabled:text-navy/30"
          >
            Voltar
          </button>
          <button onClick={next} className="vt-btn vt-btn-primary">
            {step === 3 ? "Enviar demanda" : "Continuar"} <ArrowIcon />
          </button>
        </div>
      </section>
    </main>
  );
}
