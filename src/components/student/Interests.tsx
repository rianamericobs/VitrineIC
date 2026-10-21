import { useState } from "react";
import { ORIGIN_LABEL } from "@/lib/interest";
import { companyEmail, findCompany, findStudent, respondInterest, useVitrine } from "@/lib/store";
import { FilterPill } from "@/components/app/FilterPill";
import { ArrowIcon, BuildingIcon } from "@/components/app/Icons";
import { Avatar } from "@/components/app/Avatar";
import { InterestStatusPill } from "@/components/app/InterestStatusPill";
import { Modal } from "@/components/app/Modal";
import { RefuseModal } from "@/components/app/RefuseModal";
import { Eyebrow } from "@/components/public/Eyebrow";
import { PageHead } from "@/components/public/PageHead";
import { PAGE } from "@/components/public/layout";
import type { Demand, Interest, InterestStatus } from "@/types";

/** Perfil do solicitante: dados da empresa e as demandas aprovadas que ela publicou. */
function CompanyModal({ name, demands, onClose }: { name: string; demands: Demand[]; onClose: () => void }) {
  const company = findCompany(name);
  const published = demands.filter((d) => d.company === name && d.status !== "nova" && d.status !== "em_analise" && d.status !== "rejeitada");

  return (
    <Modal eyebrow="Solicitante" title={name} onClose={onClose} width="max-w-[560px]">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Avatar name={name} size="lg" />
          <div className="min-w-0">
            <p className="font-sans text-[15px] text-navy">{company?.type ?? "Solicitante"}</p>
            {company && (
              <p className="font-sans text-[13px] text-navy/55">
                {company.city} · na vitrine desde {company.since}
              </p>
            )}
          </div>
        </div>

        {company && <p className="font-sans text-[15px] leading-[1.6] text-navy/75">{company.description}</p>}

        {company && (
          <dl className="grid grid-cols-2 gap-4 border-y border-navy/8 py-5">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-navy/50">Site</dt>
              <dd className="mt-1 font-sans text-sm text-navy">{company.site}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-navy/50">Demandas publicadas</dt>
              <dd className="mt-1 font-sans text-sm text-navy">{published.length}</dd>
            </div>
          </dl>
        )}

        <div className="flex flex-col gap-3">
          <Eyebrow>Demandas</Eyebrow>
          <ul className="flex flex-col gap-2">
            {published.map((d) => (
              <li key={d.id} className="rounded-xl bg-navy/[0.04] px-4 py-3">
                <p className="font-sans text-sm text-navy">{d.title}</p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-navy/50">
                  {d.id} · {d.area}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}

/** Texto que acompanha o interesse, conforme a porta por onde ele nasceu. */
function Note({ interest }: { interest: Interest }) {
  if (!interest.justification) return null;
  const by = {
    sugestao: { title: "Por que você", signature: "— Curadoria VitrineIC" },
    convite: { title: "Mensagem do solicitante", signature: "— Solicitante" },
    candidatura: { title: "Sua candidatura", signature: "— Você" },
  }[interest.origin];

  return (
    <>
      <Eyebrow>{by.title}</Eyebrow>
      <p className="font-sans text-[15px] leading-[1.6] text-navy/75">"{interest.justification}"</p>
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-navy/50">{by.signature}</p>
    </>
  );
}

const ACCEPT_HINT: Record<string, string> = {
  convite: "Ao aceitar, o contato é liberado para você e para o solicitante.",
  sugestao: "Ao aceitar, o solicitante vê seu perfil e decide. O contato só é liberado se ele também aceitar.",
};

/** Interesse no formato do Figma: cabeçalho em pedra azul, a nota e a ação embaixo. */
function InterestCard({ interest, demand, demands }: { interest: Interest; demand: Demand; demands: Demand[] }) {
  const [showCompany, setShowCompany] = useState(false);
  const [refusing, setRefusing] = useState(false);
  const myTurn = interest.status === "aguardando_estudante";

  return (
    <article className="vt-card overflow-hidden">
      <header className="vt-stone flex flex-col gap-3 px-6 py-7 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.08em] text-sky">
          <span>
            {ORIGIN_LABEL[interest.origin]} · {demand.id}
          </span>
          <span>{interest.createdAt}</span>
        </div>
        <h2 className="font-display text-2xl font-medium leading-[1.2] tracking-[-0.02em] text-offwhite md:text-[28px]">
          {demand.title}
        </h2>
        <p className="font-sans text-sm text-offwhite/70">
          {demand.company} · {demand.area} · prazo {demand.deadline}
        </p>
        <button
          onClick={() => setShowCompany(true)}
          className="mt-1 inline-flex items-center gap-2 self-start rounded-full! border border-offwhite/25 px-3.5 py-1.5 font-sans text-[13px] text-offwhite transition-colors hover:bg-offwhite/10"
        >
          <BuildingIcon /> Ver perfil do solicitante
        </button>
      </header>

      <div className="flex flex-col gap-4 px-6 py-7 md:px-8">
        <Note interest={interest} />

        <div className="flex flex-wrap gap-1.5">
          {demand.skills.map((s) => (
            <span key={s} className="vt-pill">
              {s}
            </span>
          ))}
        </div>

        {interest.status === "contato_liberado" && (
          <dl className="grid gap-4 rounded-xl bg-moss/[0.07] px-5 py-4 sm:grid-cols-2">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-moss">Contato do solicitante</dt>
              <dd className="mt-1 font-sans text-sm text-navy">{companyEmail(demand.company)}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-moss">Próximo passo</dt>
              <dd className="mt-1 font-sans text-sm text-navy/75">Combinem direto entre vocês. O site não acompanha a partir daqui.</dd>
            </div>
          </dl>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-3">
          {myTurn ? (
            <>
              <button onClick={() => respondInterest(interest.id, "estudante", true)} className="vt-btn vt-btn-primary">
                Aceitar <ArrowIcon />
              </button>
              <button onClick={() => setRefusing(true)} className="vt-btn vt-btn-danger">
                Recusar
              </button>
              <span className="font-sans text-xs text-navy/50">{ACCEPT_HINT[interest.origin]}</span>
            </>
          ) : (
            <InterestStatusPill status={interest.status} viewer="estudante" />
          )}
        </div>
      </div>

      {showCompany && <CompanyModal name={demand.company} demands={demands} onClose={() => setShowCompany(false)} />}
      {refusing && (
        <RefuseModal
          title={`Recusar ${interest.origin === "convite" ? "o convite" : "a sugestão"}?`}
          onClose={() => setRefusing(false)}
          onConfirm={async (reason) => {
            if (!await respondInterest(interest.id, "estudante", false, reason)) return;
            setRefusing(false);
          }}
        />
      )}
    </article>
  );
}

type Filter = "todos" | "voce" | "andamento" | "liberado" | "recusado";

const FILTERS: { id: Filter; label: string; match: (s: InterestStatus) => boolean }[] = [
  { id: "todos", label: "Todos", match: () => true },
  { id: "voce", label: "Aguardando você", match: (s) => s === "aguardando_estudante" },
  { id: "andamento", label: "Aguardando solicitante", match: (s) => s === "aguardando_solicitante" },
  { id: "liberado", label: "Contato liberado", match: (s) => s === "contato_liberado" },
  { id: "recusado", label: "Recusados", match: (s) => s === "recusado_estudante" || s === "recusado_solicitante" },
];

/**
 * Interesses do estudante: as três portas numa lista só. Convites e sugestões
 * esperam a resposta dele; candidaturas esperam o solicitante.
 */
export function Interests({ studentId }: { studentId: string }) {
  const { demands, interests } = useVitrine();
  const [filter, setFilter] = useState<Filter>("todos");

  const mine = interests.filter((i) => i.studentId === studentId);
  const count = (f: (typeof FILTERS)[number]) => mine.filter((i) => f.match(i.status)).length;
  const active = FILTERS.find((f) => f.id === filter)!;
  const shown = mine.filter((i) => active.match(i.status));
  const firstName = findStudent(studentId)?.name.split(" ")[0];

  return (
    <main className={`${PAGE} pb-20`}>
      <PageHead
        eyebrow={firstName ? `Interesses · ${firstName}` : "Interesses"}
        title={
          <>
            Quem quer trabalhar com <span className="text-red">você</span>.
          </>
        }
        lead="Convites dos solicitantes, sugestões da curadoria e as suas candidaturas. O contato só é liberado quando os dois lados aceitam."
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <FilterPill key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label} · {count(f)}
          </FilterPill>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="vt-card px-6 py-16 text-center font-mono text-[11px] uppercase tracking-[0.08em] text-navy/50">
          Nenhum interesse nesta categoria
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {shown.map((interest) => {
            const demand = demands.find((d) => d.id === interest.demandId);
            return demand ? <InterestCard key={interest.id} interest={interest} demand={demand} demands={demands} /> : null;
          })}
        </div>
      )}
    </main>
  );
}
