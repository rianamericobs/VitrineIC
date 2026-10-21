import { courseShort } from "@/data/institution";
import { IMPACT_PERIOD, TESTIMONIALS } from "@/data/impact";
import { useVitrine } from "@/lib/store";
import { Eyebrow } from "./Eyebrow";
import { PageHead } from "./PageHead";
import { PAGE } from "./layout";

/** Aspas vermelhas do topo do depoimento. */
function QuoteMark() {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" fill="none" aria-hidden="true" className="text-red">
      <path
        d="M0 16V9.6C0 4.4 2.6 1.2 7.4 0l1 2.2C5.6 3.2 4.4 5 4.3 7.6H8.6V16H0Zm12.6 0V9.6c0-5.2 2.6-8.4 7.4-9.6l1 2.2c-2.8 1-4 2.8-4.1 5.4h4.3V16h-8.6Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Painel de indicadores da atividade de extensão (ACE1).
 *
 * Todos os números são DERIVADOS das bases em tempo de render — nenhum valor
 * é digitado aqui. Assim o painel não pode divergir do que a plataforma mostra
 * nas outras telas.
 */
export function Impact() {
  const { impact } = useVitrine();
  const headline = [
    { value: impact.released, label: "contatos liberados" },
    { value: impact.projects, label: "projetos na vitrine" },
    { value: impact.demands, label: "demandas recebidas" },
    { value: impact.students, label: "estudantes com perfil público" },
  ];
  const byArea = impact.byArea;
  const maxArea = Math.max(...byArea.map(([, n]) => n), 1);
  const byCourse = impact.byCourse.map(([course, n]) => ({ course, pct: impact.students ? Math.round(n / impact.students * 100) : 0 }));

  return (
    <main className={`${PAGE} pb-20 md:pb-28`}>
      <PageHead
        eyebrow="Extensão"
        title={
          <>
            <span className="text-red">Impacto</span> em números.
          </>
        }
        lead={`Indicadores do projeto de extensão em ${IMPACT_PERIOD}, apurados direto da base da plataforma.`}
      />

      {/* ── Indicadores ── */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {headline.map((item, i) => (
          <div key={item.label} className="vt-card flex flex-col p-6">
            <p className="font-display text-[15px] font-medium text-red">{String(i + 1).padStart(2, "0")}</p>
            <p className="mt-8 font-display text-[48px] font-medium leading-none tracking-[-0.04em] text-navy">
              {item.value}
            </p>
            <p className="mt-3 font-sans text-sm text-navy/65">{item.label}</p>
          </div>
        ))}
      </div>

      {/* ── Distribuições ── */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="vt-card p-6 md:p-8">
          <Eyebrow>Demandas por área</Eyebrow>
          <ul className="mt-6 flex flex-col gap-5">
            {byArea.map(([area, n]) => (
              <li key={area} className="grid grid-cols-[minmax(0,9rem)_1fr_1.5rem] items-center gap-4 md:gap-6">
                <span className="truncate font-sans text-sm text-navy">{area}</span>
                <span className="h-1 rounded-full bg-navy/10">
                  <span className="block h-1 rounded-full bg-navy" style={{ width: `${(n / maxArea) * 100}%` }} />
                </span>
                <span className="text-right font-mono text-[10px] text-navy/65">{n}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="vt-stone rounded-2xl p-6 md:p-8">
          <Eyebrow onDark>Distribuição por curso</Eyebrow>
          <ul className="mt-6 flex flex-col gap-6">
            {byCourse.map(({ course, pct }) => (
              <li key={course}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-sans text-sm text-offwhite" title={course}>{courseShort(course)}</span>
                  <span className="font-mono text-[10px] text-offwhite/65">{pct}%</span>
                </div>
                <span className="mt-2.5 block h-1 rounded-full bg-offwhite/15">
                  <span className="block h-1 rounded-full bg-sky" style={{ width: `${pct}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* ── Depoimentos ── */}
      <section className="pt-20 md:pt-24">
        <Eyebrow>Depoimentos</Eyebrow>
        <h2 className="mt-5 font-display text-[28px] font-medium leading-[1.05] tracking-[-0.03em] text-navy md:text-[36px]">
          Quem passou pela vitrine.
        </h2>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.author} className="vt-card m-0 flex flex-col gap-6 p-6">
              <QuoteMark />
              <blockquote className="font-display text-lg leading-[1.35] tracking-[-0.01em] text-navy">
                {t.quote}
              </blockquote>
              <figcaption className="mt-auto flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-navy font-display text-[13px] font-medium text-offwhite">
                  {t.author[0]}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-sans text-[13px] text-navy">{t.author}</p>
                  <p className="truncate font-sans text-xs text-navy/65">{t.role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </main>
  );
}
