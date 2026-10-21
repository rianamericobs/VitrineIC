import type * as React from "react";
import { useState } from "react";
import { useCurrentRequester } from "@/lib/auth";
import { ORIGIN_LABEL, visibleToRequester } from "@/lib/interest";
import { findStudent, respondInterest, studentEmail, useVitrine } from "@/lib/store";
import { Avatar } from "@/components/app/Avatar";
import { FilterPill } from "@/components/app/FilterPill";
import { ArrowIcon } from "@/components/app/Icons";
import { InProjectBadge } from "@/components/app/InProjectBadge";
import { InterestStatusPill } from "@/components/app/InterestStatusPill";
import { RefuseModal } from "@/components/app/RefuseModal";
import { BackButton } from "@/components/public/BackButton";
import { Eyebrow } from "@/components/public/Eyebrow";
import { PageHead } from "@/components/public/PageHead";
import { PublicProfile } from "@/components/public/PublicProfile";
import { PAGE } from "@/components/public/layout";
import type { Demand, Interest } from "@/types";

/** Card de interessado no formato do Figma: avatar, curso, status, nota e ação embaixo. */
function InterestCard({
  interest,
  demand,
  inProject,
  onOpen,
  children,
}: {
  interest: Interest;
  demand: Demand;
  inProject: boolean;
  onOpen: () => void;
  children?: React.ReactNode;
}) {
  const student = findStudent(interest.studentId);
  if (!student) return null;

  const noteTitle = interest.origin === "sugestao" ? "Justificativa da curadoria" : interest.origin === "convite" ? "Sua mensagem" : "Nota do estudante";

  return (
    <article className="vt-card flex flex-col gap-5 p-6">
      <div className="flex items-start gap-4">
        <Avatar name={student.name} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-medium tracking-[-0.01em] text-navy">{student.name}</p>
          <p className="font-sans text-[13px] text-navy/55">
            {student.course} · {student.semester}
          </p>
        </div>
        <InterestStatusPill status={interest.status} viewer="solicitante" />
      </div>

      <p className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-navy/50">
        {ORIGIN_LABEL[interest.origin]} · {demand.title} · {interest.createdAt}
        {inProject && <InProjectBadge />}
      </p>

      {interest.justification && (
        <div className="flex flex-col gap-1.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-navy/55">{noteTitle}</p>
          <p className="font-sans text-sm leading-[1.6] text-navy/75">"{interest.justification}"</p>
        </div>
      )}

      {interest.status === "contato_liberado" && (
        <p className="rounded-xl bg-moss/[0.07] px-4 py-3 font-sans text-sm text-navy">
          <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.08em] text-moss">Contato</span>
          {studentEmail(student)}
        </p>
      )}

      {interest.refusalReason && (interest.status === "recusado_estudante" || interest.status === "recusado_solicitante") && (
        <p className="font-sans text-[13px] text-navy/60">Motivo: {interest.refusalReason}</p>
      )}

      <div className="flex flex-wrap gap-2 border-t border-navy/8 pt-5">
        <button onClick={onOpen} className="vt-btn vt-btn-secondary flex-1">
          Ver perfil <ArrowIcon />
        </button>
        {children}
      </div>
    </article>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section className="mt-14 first:mt-0">
      <Eyebrow>{title}</Eyebrow>
      {children.length > 0 ? (
        <div className="mt-6 grid gap-5 md:grid-cols-2">{children}</div>
      ) : (
        <p className="mt-6 font-sans text-sm text-navy/55">{empty}</p>
      )}
    </section>
  );
}

/**
 * Interessados nas demandas do solicitante: candidaturas e sugestões que
 * esperam a resposta dele, convites que ele enviou, contatos liberados e
 * recusas. Sugestões só aparecem depois que o estudante aceitou.
 */
export function MatchScreen({ demandId, onBack }: { demandId?: string | null; onBack?: () => void }) {
  const { demands, interests, inProject } = useVitrine();
  const requester = useCurrentRequester();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>(demandId ?? "todas");
  const [refusing, setRefusing] = useState<Interest | null>(null);

  if (selectedStudentId) {
    return <PublicProfile id={selectedStudentId} onBack={() => setSelectedStudentId(null)} onOpenProject={() => {}} />;
  }

  const myDemands = demands.filter(
    (d) => d.company === requester && (d.status === "aprovada" || d.status === "contato_liberado"),
  );
  const byId = new Map(myDemands.map((d) => [d.id, d]));
  const mine = interests.filter(
    (i) => byId.has(i.demandId) && visibleToRequester(i) && (filter === "todas" || i.demandId === filter),
  );

  const card = (i: Interest, actions?: React.ReactNode) => (
    <InterestCard
      key={i.id}
      interest={i}
      demand={byId.get(i.demandId)!}
      inProject={!!inProject[i.studentId]}
      onOpen={() => setSelectedStudentId(i.studentId)}
    >
      {actions}
    </InterestCard>
  );

  const awaiting = mine.filter((i) => i.status === "aguardando_solicitante");
  const invites = mine.filter((i) => i.origin === "convite" && i.status === "aguardando_estudante");
  const released = mine.filter((i) => i.status === "contato_liberado");
  const refused = mine.filter((i) => i.status === "recusado_estudante" || i.status === "recusado_solicitante");

  return (
    <main className={`${PAGE} pb-20 ${onBack ? "pt-8" : ""}`}>
      {onBack && <BackButton label="Voltar para minhas demandas" onClick={onBack} />}
      <PageHead
        eyebrow="Interessados"
        title="Quem quer trabalhar com você."
        lead="Candidaturas dos estudantes, sugestões da curadoria e os convites que você enviou. O contato é liberado quando você e o estudante aceitam."
      />

      <div className="mb-10 flex flex-wrap gap-2">
        <FilterPill active={filter === "todas"} onClick={() => setFilter("todas")}>
          Todas as demandas
        </FilterPill>
        {myDemands.map((d) => (
          <FilterPill key={d.id} active={filter === d.id} onClick={() => setFilter(d.id)}>
            {d.title}
          </FilterPill>
        ))}
      </div>

      <Section title="Aguardando sua resposta" empty="Nenhuma candidatura ou sugestão esperando você.">
        {awaiting.map((i) =>
          card(
            i,
            <>
              <button onClick={() => respondInterest(i.id, "solicitante", true)} className="vt-btn vt-btn-primary">
                Aceitar
              </button>
              <button onClick={() => setRefusing(i)} className="vt-btn vt-btn-danger">
                Recusar
              </button>
            </>,
          ),
        )}
      </Section>

      <Section title="Contato liberado" empty="Nenhum contato liberado ainda.">
        {released.map((i) => card(i))}
      </Section>

      <Section title="Convites enviados" empty="Nenhum convite aguardando resposta. Convide estudantes pela vitrine.">
        {invites.map((i) => card(i))}
      </Section>

      <Section title="Recusas" empty="Nenhuma recusa.">
        {refused.map((i) => card(i))}
      </Section>

      <p className="mt-12 rounded-xl border border-dashed border-navy/15 px-5 py-4 font-sans text-[13px] leading-[1.6] text-navy/55">
        Depois que o contato é liberado, vocês combinam direto. O site não acompanha estágio ou projeto a partir daí; o
        estudante só marca o selo "em projeto" no perfil.
      </p>

      {refusing && (
        <RefuseModal
          title={`Recusar ${findStudent(refusing.studentId)?.name ?? "estudante"}?`}
          onClose={() => setRefusing(null)}
          onConfirm={async (reason) => {
            if (!await respondInterest(refusing.id, "solicitante", false, reason)) return;
            setRefusing(null);
          }}
        />
      )}
    </main>
  );
}
