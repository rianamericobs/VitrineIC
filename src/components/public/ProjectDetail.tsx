import { findProject, useVitrine } from "@/lib/store";
import { isProfileVisible } from "@/lib/profile";
import { BackButton } from "./BackButton";
import { Eyebrow } from "./Eyebrow";
import { ProjectStatusPill } from "./ProjectStatusPill";
import { PAGE } from "./layout";

function Arrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/** Página pública de um projeto: capa, descrição, stack, autoria e chamada para parceria. */
export function ProjectDetail({
  id,
  onBack,
  onOpenProfile,
  onSignIn,
}: {
  id: string;
  onBack: () => void;
  onOpenProfile: (studentId: string) => void;
  onSignIn: () => void;
}) {
  useVitrine();
  const project = findProject(id);

  if (!project || !isProfileVisible(project.student)) {
    return (
      <main className={`${PAGE} flex flex-col items-center gap-6 py-24`}>
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-navy/65">Projeto não encontrado</p>
        <button onClick={onBack} className="vt-btn vt-btn-secondary">
          Voltar ao catálogo
        </button>
      </main>
    );
  }

  const { student } = project;

  return (
    <main className={`${PAGE} pt-8 pb-20 md:pb-28`}>
      <BackButton label="Projetos" onClick={onBack} />

      <header className="pt-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="vt-pill">{project.area}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-navy/65">{project.year}</span>
          <ProjectStatusPill status={project.status} />
        </div>
        <h1 className="mt-6 max-w-[860px] font-display text-[36px] font-medium leading-[1.02] tracking-[-0.025em] text-navy md:text-[56px]">
          {project.title}
        </h1>
      </header>

      <div className="vt-stone relative mt-10 h-[220px] rounded-3xl md:h-[380px]">
        <span className="absolute bottom-6 left-6 font-mono text-[10px] uppercase tracking-[0.08em] text-sky">
          VIC · {project.id.replace("PRJ-", "P")} · capa do projeto
        </span>
      </div>

      <div className="mt-10 grid items-start gap-10 lg:grid-cols-[1fr_340px]">
        <div>
          <Eyebrow>Descrição</Eyebrow>
          <p className="mt-4 max-w-[740px] font-sans text-[17px] leading-[1.6] text-navy/65">
            {project.description}
          </p>
          {project.link && (
            <a href={project.link} target="_blank" rel="noreferrer" className="vt-btn vt-btn-secondary mt-5">
              Abrir projeto <Arrow />
            </a>
          )}

          <div className="mt-10">
            <Eyebrow>Stack</Eyebrow>
            <div className="mt-4 flex flex-wrap gap-2">
              {project.stack.map((tech) => (
                <span key={tech} className="vt-pill">
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>

        <aside className="flex flex-col gap-5">
          <button
            onClick={() => onOpenProfile(student.id)}
            className="vt-card vt-card-interactive flex flex-col gap-3 p-6 text-left"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-navy/65">Autoria</span>
            <span className="flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-[13px] bg-navy font-display text-xl font-medium text-offwhite">
                {student.name[0]}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-sans text-[15px] text-navy">{student.name}</span>
                <span className="block truncate font-sans text-[13px] text-navy/65">
                  {student.course} · {student.semester}
                </span>
              </span>
            </span>
          </button>

          <section className="vt-stone rounded-2xl p-6">
            <Eyebrow onDark>Parceria</Eyebrow>
            <h2 className="mt-5 font-display text-2xl font-medium leading-[1.25] tracking-[-0.02em] text-offwhite">
              Sua empresa tem uma demanda parecida?
            </h2>
            <p className="mt-4 font-sans text-sm font-light leading-[1.5] text-offwhite/65">
              Publique a demanda e a curadoria indica o estudante mais compatível.
            </p>
            <button onClick={onSignIn} className="vt-btn vt-btn-cream mt-5">
              Publicar demanda <Arrow />
            </button>
          </section>
        </aside>
      </div>
    </main>
  );
}
