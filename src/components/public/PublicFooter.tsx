import { INSTITUTION } from "@/data/institution";
import { Logo } from "./Logo";
import { PAGE } from "./layout";
import type { PublicView } from "./routes";

/** Rodapé azul das páginas públicas, igual na landing e nas telas internas. */
export function PublicFooter({
  onNavigate,
  onSignIn,
  onAdmin,
}: {
  onNavigate: (view: PublicView) => void;
  onSignIn: () => void;
  onAdmin: () => void;
}) {
  const columns: { title: string; links: { label: string; onClick: () => void }[] }[] = [
    {
      title: "Plataforma",
      links: [
        { label: "Projetos", onClick: () => onNavigate("projects") },
        { label: "Estudantes", onClick: () => onNavigate("students") },
        { label: "Impacto", onClick: () => onNavigate("impact") },
      ],
    },
    {
      title: "Acesso",
      links: [
        { label: "Estudantes", onClick: onSignIn },
        { label: "Solicitantes", onClick: onSignIn },
        { label: "Curadoria", onClick: onAdmin },
      ],
    },
  ];

  return (
    <footer className={`${PAGE} pb-6`}>
      <div className="vt-stone rounded-3xl p-8 md:p-12">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Logo inverted />
            <p className="mt-4 max-w-[280px] font-sans text-sm font-light leading-[1.5] text-offwhite/60">
              Projeto de extensão do {INSTITUTION.unit} da {INSTITUTION.university}.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-sky">{col.title}</p>
              <ul className="flex flex-col gap-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <button
                      onClick={link.onClick}
                      className="font-sans text-sm text-offwhite/75 transition-colors hover:text-offwhite"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-sky">Contato</p>
            <ul className="flex flex-col gap-3 font-sans text-sm text-offwhite/75">
              <li>{INSTITUTION.contactEmail}</li>
              <li>{INSTITUTION.campus}</li>
              <li>
                {INSTITUTION.city} — {INSTITUTION.stateShort}
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-offwhite/10 pt-6 font-mono text-[10px] uppercase tracking-[0.08em] text-offwhite/60 sm:flex-row sm:justify-between">
          <span>VitrineIC — {INSTITUTION.universityShort} · 2026</span>
          <span>Curadoria humana · contato só com aceite dos dois lados</span>
        </div>


      </div>
    </footer>
  );
}
