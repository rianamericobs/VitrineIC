import { useState } from "react";
import { StatusBadge } from "./StatusBadge";
import { useCurrentRequester } from "@/lib/auth";
import { visibleToRequester } from "@/lib/interest";
import { useVitrine } from "@/lib/store";
import { ArrowIcon, ChevronIcon } from "@/components/app/Icons";
import { PageHead } from "@/components/public/PageHead";
import { PAGE } from "@/components/public/layout";
import { paraExibicao } from "@/lib/datas";

export function MyDemands({ onNew, onViewMatch }: { onNew: () => void; onViewMatch: (demandId: string) => void }) {
  const { demands, interests } = useVitrine();
  const requester = useCurrentRequester();
  const [selected, setSelected] = useState<string | null>(null);

  const mine = demands.filter((d) => d.company === requester);
  const openCount = mine.filter((d) => d.status === "aprovada" || d.status === "contato_liberado").length;
  const analysisCount = mine.filter((d) => d.status === "nova" || d.status === "em_analise").length;

  return (
    <main className={`${PAGE} pb-20`}>
      <PageHead
        eyebrow="Demandas"
        title="Minhas demandas."
        lead={`${mine.length} no total · ${openCount} publicadas · ${analysisCount} em análise`}
        aside={
          <button onClick={onNew} className="vt-btn vt-btn-primary self-start md:self-auto">
            Nova demanda <ArrowIcon />
          </button>
        }
      />

      <ul className="vt-card divide-y divide-navy/8 overflow-hidden">
        {mine.map((d) => {
          const open = selected === d.id;
          const published = d.status === "aprovada" || d.status === "contato_liberado";
          const visible = interests.filter((i) => i.demandId === d.id && visibleToRequester(i));
          const awaiting = visible.filter((i) => i.status === "aguardando_solicitante").length;
          return (
            <li key={d.id}>
              <button
                onClick={() => setSelected(open ? null : d.id)}
                aria-expanded={open}
                className="flex w-full items-center gap-4 rounded-none! px-5 py-5 text-left transition-colors hover:bg-navy/[0.02] md:gap-6 md:px-6"
              >
                <span className="hidden w-28 shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-navy/45 md:block">
                  {d.id}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-sans text-[15px] text-navy">{d.title}</span>
                  <span className="block font-sans text-[13px] text-navy/55">
                    Prazo {paraExibicao(d.deadline)} · {d.area}
                    {awaiting > 0 && <span className="text-red"> · {awaiting} aguardando você</span>}
                  </span>
                </span>
                <StatusBadge status={d.status} />
                <span className={`hidden text-navy/35 transition-transform sm:block ${open ? "rotate-90" : ""}`}>
                  <ChevronIcon />
                </span>
              </button>

              {open && (
                <div className="flex flex-col gap-4 border-t border-navy/8 bg-navy/[0.02] px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6 md:pl-[166px]">
                  <p className="max-w-[560px] font-sans text-[13px] leading-[1.6] text-navy/65">
                    {published
                      ? d.description
                      : "A curadoria está validando o escopo. Depois de aprovada, a demanda aparece para os estudantes e recebe candidaturas e sugestões."}
                  </p>
                  {published ? (
                    <button onClick={() => onViewMatch(d.id)} className="vt-btn vt-btn-secondary shrink-0">
                      {visible.length > 0 ? `Ver interessados (${visible.length})` : "Ver interessados"} <ArrowIcon />
                    </button>
                  ) : (
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-navy/50">Aguardando curadoria</span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
