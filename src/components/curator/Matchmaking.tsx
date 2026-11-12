import { useState } from "react";
import { Label, SkillTag } from "./ui";
import { LANGUAGE_LEVELS } from "@/data/languages";
import { ORIGIN_LABEL } from "@/lib/interest";
import { scoreStudent } from "@/lib/match";
import { findActiveInterest, useVitrine } from "@/lib/store";
import { isProfileVisible } from "@/lib/profile";
import { Avatar } from "@/components/app/Avatar";
import { ArrowIcon, CheckIcon } from "@/components/app/Icons";
import { InProjectBadge } from "@/components/app/InProjectBadge";
import { InterestStatusPill } from "@/components/app/InterestStatusPill";
import { BackButton } from "@/components/public/BackButton";
import { Eyebrow } from "@/components/public/Eyebrow";
import { PAGE } from "@/components/public/layout";
import type { Demand, Interest, Student } from "@/types";
import { paraExibicao } from "@/lib/datas";


/** Caixinhas de critério do Figma, com o que o algoritmo de fato considera. */
function Criteria({ student, demand }: { student: Student; demand: Demand }) {
  const matched = student.skills.filter((s) => demand.skills.some((ds) => ds.toLowerCase() === s.toLowerCase()));
  const lang = student.languages[0];
  const items = [
    { label: "Skills em comum", value: `${matched.length}/${demand.skills.length}` },
    { label: "Disponibilidade", value: student.availability },
    { label: "Idioma", value: lang ? `${lang.name} ${LANGUAGE_LEVELS[lang.level - 1].toLowerCase()}` : "—" },
    { label: "Projetos", value: String(student.projects.length) },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {items.map((c) => (
        <div key={c.label} className="rounded-[10px] bg-navy/[0.035] px-3 py-2.5">
          <p className="font-sans text-[12px] text-navy/60">{c.label}</p>
          <p className="mt-1 truncate font-mono text-[11px] text-moss">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

export function StudentMatchCard({
  student,
  demand,
  rank,
  selected,
  onSelect,
  existing,
  inProject,
}: {
  student: Student;
  demand: Demand;
  rank: number;
  selected: boolean;
  onSelect: () => void;
  /** Interesse vivo com esta demanda: o estudante não pode ser sugerido de novo. */
  existing?: Interest;
  inProject: boolean;
}) {
  const score = scoreStudent(student, demand);
  const matchedSkills = student.skills.filter((s) =>
    demand.skills.some((ds) => ds.toLowerCase() === s.toLowerCase())
  );

  return (
    <div
      role="radio"
      aria-checked={selected}
      aria-disabled={!!existing}
      tabIndex={existing ? -1 : 0}
      onClick={existing ? undefined : onSelect}
      onKeyDown={(e) => {
        if (existing) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`vt-card p-5 transition-[border-color,box-shadow] md:p-6 ${
        existing
          ? "opacity-70"
          : selected
            ? "cursor-pointer border-navy! shadow-[0_0_0_1px_#0b2545]!"
            : "cursor-pointer hover:border-navy/25!"
      }`}
    >
      <div className="flex items-start gap-4">
        <span className="hidden w-6 pt-2.5 font-display text-[15px] font-medium text-red sm:block">
          {String(rank).padStart(2, "0")}
        </span>
        <Avatar name={student.name} size="md" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-medium tracking-[-0.01em] text-navy">{student.name}</p>
          <p className="font-sans text-[13px] text-navy/55">
            {student.course} · {student.semester}
          </p>
          {(inProject || existing) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {inProject && <InProjectBadge />}
              {existing && (
                <>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-navy/50">
                    {ORIGIN_LABEL[existing.origin]}
                  </span>
                  <InterestStatusPill status={existing.status} viewer="curadoria" />
                </>
              )}
            </div>
          )}
        </div>
        <div className="text-right">
          <p className="font-display text-[28px] leading-none font-medium tracking-[-0.02em] text-navy">{score}</p>
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.08em] text-navy/50">pontos</p>
        </div>
        <span
          className={`mt-1.5 grid size-5 shrink-0 place-items-center rounded-full border ${
            selected ? "border-navy bg-navy text-offwhite" : "border-navy/25"
          }`}
        >
          {selected && <CheckIcon />}
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-4 sm:pl-10">
        <Criteria student={student} demand={demand} />
        <div className="flex flex-wrap items-center gap-1.5">
          {student.skills.map((s) => (
            <SkillTag key={s} highlight={matchedSkills.includes(s)}>
              {s}
            </SkillTag>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Matchmaking({
  demand,
  onConfirm,
  onBack,
}: {
  demand: Demand;
  onConfirm: (student: Student) => void;
  onBack: () => void;
}) {
  const { interests, inProject, students } = useVitrine();
  const [filter, setFilter] = useState("");
  const sorted = students
    .filter(isProfileVisible)
    .map((s) => ({ ...s, score: scoreStudent(s, demand) }))
    .filter((s) => {
      if (!filter) return true;
      return s.skills.some((sk) => sk.toLowerCase().includes(filter.toLowerCase())) ||
        s.name.toLowerCase().includes(filter.toLowerCase());
    })
    .sort((a, b) => b.score - a.score);

  const [chosenId, setChosenId] = useState<string | null>(null);
  const existingFor = (studentId: string) => findActiveInterest(interests, demand.id, studentId);
  const available = sorted.filter((s) => !existingFor(s.id));
  const chosen = available.find((s) => s.id === chosenId) ?? available[0];
  const demandInterests = interests.filter((i) => i.demandId === demand.id);

  return (
    <main className={`${PAGE} pt-8 pb-20`}>
      <BackButton label="Análise de matches" onClick={onBack} />

      <header className="flex flex-col gap-5 pt-10 pb-10 md:pb-12">
        <Eyebrow>Matchmaking · {demand.id}</Eyebrow>
        <h1 className="font-display text-[36px] font-medium leading-[1.02] tracking-[-0.035em] text-navy md:text-page">
          {demand.title}.
        </h1>
        <p className="max-w-[620px] font-sans text-lead font-light text-navy/65">
          {demand.company} · {demand.skills.slice(0, 3).join(", ")} · {demand.scope}. Sugira um estudante com
          justificativa: ele responde primeiro, e o solicitante só o vê se ele aceitar.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_300px]">
        <section className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-navy/55">
              {sorted.length} candidatos · <span className="text-red">vermelho</span> = skill da demanda
            </p>
            <input
              placeholder="Filtrar por nome ou skill..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="vt-input max-w-[240px] py-2! text-[13px]!"
            />
          </div>

          <div role="radiogroup" aria-label="Candidatos" className="flex flex-col gap-4">
            {sorted.map((s, i) => (
              <StudentMatchCard
                key={s.id}
                student={s}
                demand={demand}
                rank={i + 1}
                selected={chosen?.id === s.id}
                onSelect={() => setChosenId(s.id)}
                existing={existingFor(s.id)}
                inProject={!!inProject[s.id]}
              />
            ))}
            {sorted.length === 0 && (
              <p className="rounded-2xl border border-dashed border-navy/20 p-10 text-center font-sans text-sm text-navy/55">
                Nenhum estudante encontrado com esse filtro.
              </p>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-24">
          {chosen && (
            <div className="vt-stone flex flex-col gap-5 rounded-3xl p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-sky">Seleção</p>
              <div className="flex items-center gap-3">
                <Avatar name={chosen.name} light />
                <div className="min-w-0">
                  <p className="truncate font-sans text-[15px] text-offwhite">{chosen.name}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-sky">{chosen.score} pontos</p>
                </div>
              </div>
              <p className="font-sans text-[13px] text-offwhite/60">
                A sugestão vai para o estudante com a sua justificativa. Os demais não são notificados.
              </p>
              <button onClick={() => onConfirm(chosen)} className="vt-btn vt-btn-cream w-full">
                Sugerir estudante <ArrowIcon />
              </button>
            </div>
          )}

          <div className="vt-card flex flex-col gap-4 p-6">
            <Eyebrow>Demanda</Eyebrow>
            <dl className="divide-y divide-navy/8">
              {[
                { label: "Área", val: demand.area },
                { label: "Escopo", val: demand.scope },
                { label: "Prazo", val: paraExibicao(demand.deadline) },
                { label: "Enviado em", val: paraExibicao(demand.submitted) },
              ].map((r) => (
                <div key={r.label} className="flex items-baseline justify-between gap-3 py-2.5">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-navy/55">{r.label}</dt>
                  <dd className="text-right font-sans text-[13px] text-navy">{r.val}</dd>
                </div>
              ))}
            </dl>
            <div>
              <Label>Requisitos técnicos</Label>
              <div className="flex flex-wrap gap-1.5">
                {demand.skills.map((s) => (
                  <SkillTag key={s}>{s}</SkillTag>
                ))}
              </div>
            </div>
            <p className="font-sans text-[13px] leading-[1.55] text-navy/65">{demand.description}</p>
          </div>

          <div className="vt-card flex flex-col gap-4 p-6">
            <Eyebrow>Interesses nesta demanda</Eyebrow>
            {demandInterests.length === 0 ? (
              <p className="font-sans text-[13px] text-navy/55">Nenhum ainda.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-navy/8">
                {demandInterests.map((i) => (
                  <li key={i.id} className="flex flex-col gap-1.5 py-3">
                    <p className="font-sans text-[13px] text-navy">
                      {students.find((s) => s.id === i.studentId)?.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-navy/50">
                        {ORIGIN_LABEL[i.origin]}
                      </span>
                      <InterestStatusPill status={i.status} viewer="curadoria" />
                    </div>
                    {i.refusalReason && <p className="font-sans text-[12px] text-navy/55">Motivo: {i.refusalReason}</p>}
                  </li>
                ))}
              </ul>
            )}
            <p className="font-sans text-[12px] text-navy/50">Só leitura: candidaturas e convites são entre estudante e solicitante.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
