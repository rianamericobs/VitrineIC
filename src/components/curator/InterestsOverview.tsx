import { useState } from "react";
import { ORIGIN_LABEL } from "@/lib/interest";
import { findStudent, useVitrine } from "@/lib/store";
import { Avatar } from "@/components/app/Avatar";
import { FilterPill } from "@/components/app/FilterPill";
import { InterestStatusPill } from "@/components/app/InterestStatusPill";
import { PageHead } from "@/components/public/PageHead";
import { PAGE } from "@/components/public/layout";
import type { InterestOrigin } from "@/types";
import { comoDecorrido } from "@/lib/datas";

const ORIGINS: ("todas" | InterestOrigin)[] = ["todas", "candidatura", "convite", "sugestao"];

/**
 * Visão da curadoria sobre todos os interesses, de qualquer origem. Só
 * leitura: a curadoria age apenas nas próprias sugestões (em Análise de
 * matches). Vê todas as recusas com o motivo e sabe quando o contato foi
 * liberado, sem ver o contato em si.
 */
export function InterestsOverview() {
  const { demands, interests } = useVitrine();
  const [origin, setOrigin] = useState<(typeof ORIGINS)[number]>("todas");
  const [onlyRefused, setOnlyRefused] = useState(false);

  const shown = interests.filter(
    (i) =>
      (origin === "todas" || i.origin === origin) &&
      (!onlyRefused || i.status === "recusado_estudante" || i.status === "recusado_solicitante"),
  );
  const released = interests.filter((i) => i.status === "contato_liberado").length;

  return (
    <main className={`${PAGE} pb-20`}>
      <PageHead
        eyebrow="Curadoria"
        title="Acompanhamento."
        lead={`${interests.length} interesses · ${released} contatos liberados. Candidaturas e convites acontecem entre estudante e solicitante; aqui você só observa.`}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {ORIGINS.map((o) => (
          <FilterPill key={o} active={origin === o} onClick={() => setOrigin(o)}>
            {o === "todas" ? "Todas as origens" : ORIGIN_LABEL[o]}
          </FilterPill>
        ))}
        <FilterPill active={onlyRefused} onClick={() => setOnlyRefused(!onlyRefused)}>
          Só recusas
        </FilterPill>
      </div>

      <ul className="vt-card divide-y divide-navy/8 overflow-hidden">
        {shown.map((i) => {
          const student = findStudent(i.studentId);
          const demand = demands.find((d) => d.id === i.demandId);
          if (!student || !demand) return null;
          return (
            <li key={i.id} className="flex flex-col gap-3 px-5 py-5 md:flex-row md:items-center md:gap-6 md:px-6">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar name={student.name} />
                <div className="min-w-0">
                  <p className="truncate font-sans text-[15px] text-navy">
                    {student.name} <span className="text-navy/45">→</span> {demand.title}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-navy/50">
                    {ORIGIN_LABEL[i.origin]} · {demand.company} · {comoDecorrido(i.createdAt)}
                  </p>
                  {i.refusalReason && (
                    <p className="mt-1 font-sans text-[13px] text-navy/60">Motivo da recusa: {i.refusalReason}</p>
                  )}
                </div>
              </div>
              <InterestStatusPill status={i.status} viewer="curadoria" />
            </li>
          );
        })}
        {shown.length === 0 && (
          <li className="px-6 py-14 text-center font-sans text-sm text-navy/55">Nenhum interesse com esse filtro.</li>
        )}
      </ul>
    </main>
  );
}
