import { useState } from "react";
import { scoreStudent } from "@/lib/match";
import { isProfileVisible } from "@/lib/profile";
import { createInterest, findActiveInterest, useVitrine } from "@/lib/store";
import { ArrowIcon, BuildingIcon, ClockIcon } from "@/components/app/Icons";
import { InterestStatusPill } from "@/components/app/InterestStatusPill";
import { BackButton } from "@/components/public/BackButton";
import { Eyebrow } from "@/components/public/Eyebrow";
import { PageHead } from "@/components/public/PageHead";
import { PAGE } from "@/components/public/layout";
import type { Demand, Student } from "@/types";
import { paraExibicao } from "@/lib/datas";

function Meta({ demand }: { demand: Demand }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-[13px] text-navy/60">
      <span className="flex items-center gap-1.5">
        <BuildingIcon />
        {demand.company}
      </span>
      <span aria-hidden="true">·</span>
      <span className="flex items-center gap-1.5">
        <ClockIcon />
        prazo {paraExibicao(demand.deadline)}
      </span>
    </p>
  );
}

/** Botão de candidatura com a nota opcional; se já houver interesse, mostra o andamento. */
function Apply({ demand, student, onGoToInterests }: { demand: Demand; student: Student; onGoToInterests: () => void }) {
  const { interests } = useVitrine();
  const studentId = student.id;
  const [writing, setWriting] = useState(false);
  const [note, setNote] = useState("");
  const existing = findActiveInterest(interests, demand.id, studentId);

  if (existing) {
    return (
      <div className="mt-6 flex flex-col items-start gap-3">
        <InterestStatusPill status={existing.status} viewer="estudante" />
        <button onClick={onGoToInterests} className="font-sans text-[13px] text-navy/65 underline underline-offset-4 hover:text-navy">
          Ver em Interesses
        </button>
      </div>
    );
  }

  if (!isProfileVisible(student)) {
    return (
      <div className="mt-6 flex flex-col items-start gap-2">
        <button disabled aria-describedby={`apply-hint-${demand.id}`} className="vt-btn vt-btn-primary">
          Candidatar-se <ArrowIcon />
        </button>
        <p id={`apply-hint-${demand.id}`} className="font-sans text-xs text-navy/55">
          Complete seu perfil para se candidatar.
        </p>
      </div>
    );
  }

  if (!writing) {
    return (
      <button onClick={() => setWriting(true)} className="vt-btn vt-btn-primary mt-6 self-start">
        Candidatar-se <ArrowIcon />
      </button>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      <label className="font-mono text-[10px] uppercase tracking-[0.08em] text-navy/65">Por que você? (opcional)</label>
      <textarea
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Um projeto seu que tenha a ver, uma tecnologia que você domina..."
        className="vt-input"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => createInterest(demand.id, studentId, "candidatura", note)} className="vt-btn vt-btn-primary">
          Enviar candidatura <ArrowIcon />
        </button>
        <button onClick={() => setWriting(false)} className="rounded-[10px] px-3 py-2 font-sans text-sm text-navy/65 hover:text-navy">
          Cancelar
        </button>
      </div>
      <p className="font-sans text-xs text-navy/50">A candidatura vai direto ao solicitante. O contato só é liberado se ele aceitar.</p>
    </div>
  );
}

/** Demandas aprovadas pela curadoria, abertas a candidatura. */
export function Opportunities({
  student,
  onGoToInterests,
}: {
  student: Student;
  onGoToInterests: () => void;
}) {
  const { demands } = useVitrine();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const firstName = student.name.trim().split(" ")[0];
  const selected = demands.find((d) => d.id === selectedId);

  if (selected) {
    return (
      <main className={`${PAGE} pt-8 pb-20`}>
        <BackButton label="Voltar para oportunidades" onClick={() => setSelectedId(null)} />

        <section className="vt-card mt-10 overflow-hidden">
          <div className="vt-stone flex flex-col gap-4 px-6 py-8 md:px-10 md:py-10">
            <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.08em] text-sky">
              <span>{selected.id}</span>
              <span>{selected.area}</span>
            </div>
            <h1 className="font-display text-[32px] font-medium leading-[1.1] tracking-[-0.025em] text-offwhite md:text-[40px]">
              {selected.title}
            </h1>
            <p className="max-w-[640px] font-sans text-[15px] leading-[1.6] text-offwhite/75">{selected.description}</p>
          </div>

          <div className="grid gap-10 px-6 py-8 md:grid-cols-2 md:px-10">
            <dl className="flex flex-col gap-5">
              {[
                ["Quem pede", selected.company],
                ["Duração prevista", selected.scope],
                ["Prazo", paraExibicao(selected.deadline)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-navy/55">{label}</dt>
                  <dd className="mt-1 font-sans text-[15px] text-navy">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-col gap-4">
              <Eyebrow>Competências desejadas</Eyebrow>
              <div className="flex flex-wrap gap-1.5">
                {selected.skills.map((s) => (
                  <span key={s} className="vt-pill">
                    {s}
                  </span>
                ))}
              </div>
              <Apply demand={selected} student={student} onGoToInterests={onGoToInterests} />
            </div>
          </div>
        </section>
      </main>
    );
  }

  const open = demands
    .filter((d) => d.status === "aprovada")
    .map((d) => ({ demand: d, score: scoreStudent(student, d) }))
    .sort((a, b) => b.score - a.score);

  return (
    <main className={`${PAGE} pb-20`}>
      <PageHead
        eyebrow={firstName ? `Olá, ${firstName}` : "Oportunidades"}
        title="Oportunidades abertas."
        lead="Demandas aprovadas pela curadoria. Candidate-se às que combinam com você, ou espere um convite do solicitante ou uma sugestão da curadoria."
      />

      <div className="grid gap-5 md:grid-cols-2">
        {open.map(({ demand, score }) => (
          <button
            key={demand.id}
            onClick={() => setSelectedId(demand.id)}
            className="vt-card vt-card-interactive flex flex-col gap-4 p-6 text-left"
          >
            <div className="flex w-full items-center justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-navy/50">{demand.area}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-navy/50">{score}% compatível</span>
            </div>
            <h3 className="font-display text-xl font-medium leading-[1.25] tracking-[-0.015em] text-navy">{demand.title}</h3>
            <Meta demand={demand} />
            <div className="flex flex-wrap gap-1.5">
              {demand.skills.map((s) => (
                <span key={s} className="vt-pill">
                  {s}
                </span>
              ))}
            </div>
          </button>
        ))}
        {open.length === 0 && (
          <p className="col-span-full rounded-2xl border border-dashed border-navy/20 p-12 text-center font-sans text-sm text-navy/55">
            Nenhuma demanda aberta no momento.
          </p>
        )}
      </div>
    </main>
  );
}
