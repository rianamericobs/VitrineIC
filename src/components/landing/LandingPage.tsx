import { allProjects, useVitrine } from "@/lib/store";
import { isProfileVisible } from "@/lib/profile";
import { ProjectCard } from "@/components/public/ProjectCard";
import { INSTITUTION } from "@/data/institution";
import type { PublicRoute } from "@/components/public/routes";
import { Eyebrow } from "@/components/public/Eyebrow";
import { PAGE } from "@/components/public/layout";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicNav } from "@/components/public/PublicNav";
import { UnitsCard } from "@/components/landing/UnitsCard";

/** Destaques saem da base única de projetos, para que o card abra a página do projeto. */

function Arrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export default function LandingPage({
  onSignIn,
  onAdmin,
  onNavigate,
}: {
  onSignIn: () => void;
  onAdmin: () => void;
  onNavigate: (route: PublicRoute) => void;
}) {
  const { students, companies, impact } = useVitrine();
  const stats = [
    { index: "01", value: impact.projects, label: "projetos publicados" },
    { index: "02", value: impact.students, label: "estudantes na vitrine" },
    { index: "03", value: companies.length, label: "organizações cadastradas" },
  ];
  const featured = allProjects(students.filter(isProfileVisible)).slice(0, 6);

  return (
    <div className="min-h-screen bg-offwhite">
      <PublicNav
        view="home"
        onHome={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        onNavigate={(v) => onNavigate({ view: v })}
        onSignIn={onSignIn}
        onAdmin={onAdmin}
      />

      {/* ── Hero ── */}
      <section className={`${PAGE} grid items-center gap-14 py-16 md:grid-cols-[591fr_473fr] md:py-24`}>
        <div className="flex flex-col gap-8">
          <Eyebrow>Plataforma de talentos acadêmicos</Eyebrow>
          <h1 className="font-display text-[44px] font-medium leading-[0.98] tracking-[-0.035em] text-navy md:text-hero">
            Conectando <span className="text-red">inovação</span> acadêmica ao mercado.
          </h1>
          <p className="max-w-[500px] font-sans text-lead font-light text-navy/65">
            Estudantes de todos os cursos da {INSTITUTION.universityShort} mostram o que já construíram.
            Empresas publicam demandas. Estudantes se candidatam, empresas convidam e a curadoria sugere quem combina.
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={onSignIn} className="vt-btn vt-btn-primary">
              Acessar plataforma <Arrow />
            </button>
            <button onClick={() => onNavigate({ view: "projects" })} className="vt-btn vt-btn-secondary">
              Explorar projetos
            </button>
          </div>
          <div className="md:hidden">
            <UnitsCard variant="compact" />
          </div>
        </div>

        <div className="hidden md:block">
          <UnitsCard />
        </div>
      </section>

      {/* ── Números ── */}
      <section className={PAGE}>
        <div className="grid border-y border-navy/13 md:grid-cols-3">
          {stats.map((stat, i) => (
            <div
              key={stat.index}
              className={`py-8 md:py-10 ${
                i === 0 ? "md:pr-8" : "border-t border-navy/13 md:border-t-0 md:border-l md:px-8"
              }`}
            >
              <p className="font-display text-[15px] font-medium text-red">{stat.index}</p>
              <p className="mt-4 font-display text-page font-medium tracking-[-0.04em] text-navy">{stat.value}</p>
              <p className="mt-2 font-sans text-[15px] text-navy/65">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Destaques ── */}
      <section className={`${PAGE} py-20 md:py-28`}>
        <div className="flex items-end justify-between gap-6">
          <div>
            <Eyebrow>Em destaque</Eyebrow>
            <h2 className="mt-5 font-display text-[28px] font-medium leading-[1.05] tracking-[-0.03em] text-navy md:text-section">
              Projetos que já saíram do papel.
            </h2>
          </div>
          <button
            onClick={() => onNavigate({ view: "projects" })}
            className="vt-btn vt-btn-secondary shrink-0"
          >
            Ver catálogo <Arrow />
          </button>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {featured.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              compact
              onOpen={() => onNavigate({ view: "project", id: project.id })}
            />
          ))}
        </div>
      </section>

      {/* ── Chamada ── */}
      <section className={`${PAGE} pb-20`}>
        <div className="vt-stone flex flex-col gap-8 rounded-3xl p-8 md:flex-row md:items-end md:justify-between md:p-16">
          <div className="max-w-[560px]">
            <Eyebrow onDark>Para estudantes e empresas</Eyebrow>
            <h2 className="mt-6 font-display text-[28px] font-medium leading-[1.05] tracking-[-0.03em] text-offwhite md:text-section">
              Faça parte da vitrine de <span className="text-sky">inovação</span> da{" "}
              {INSTITUTION.universityShort}
              <span className="text-sky">.</span>
            </h2>
          </div>
          <div className="max-w-[320px]">
            <p className="font-sans text-[15px] font-light leading-[1.5] text-offwhite/65">
              Cadastre seu portfólio ou publique uma demanda. A curadoria faz o resto.
            </p>
            <button onClick={onSignIn} className="vt-btn vt-btn-cream mt-6">
              Acessar plataforma <Arrow />
            </button>
          </div>
        </div>
      </section>

      <PublicFooter onNavigate={(v) => onNavigate({ view: v })} onSignIn={onSignIn} onAdmin={onAdmin} />
    </div>
  );
}
