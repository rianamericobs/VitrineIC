import { useState } from "react";
import { Input, Select } from "./ui";
import { ArrowIcon, ChevronIcon, PlusIcon } from "@/components/app/Icons";
import { InProjectBadge } from "@/components/app/InProjectBadge";
import { Modal } from "@/components/app/Modal";
import { StatusPill } from "@/components/app/StatusPill";
import { PageHead } from "@/components/public/PageHead";
import { PAGE } from "@/components/public/layout";
import { addProject, setInProject, useVitrine } from "@/lib/store";
import { required, useValidation } from "@/lib/validate";
import { MOSS, OCHRE, SLATE } from "@/styles/tokens";

export interface MyProject {
  id: string;
  title: string;
  description: string;
  phase: string;
  link?: string;
  tools?: string;
}

const PHASES = ["Idealização", "Codificação", "Revisão", "Publicado"];

const PHASE_COLOR: Record<string, string> = {
  Idealização: SLATE,
  Codificação: OCHRE,
  Revisão: OCHRE,
  Publicado: MOSS,
};

const PHASE_STATUS: Record<string, import("@/types").ProjectStatus> = { Idealização: "ideation", Codificação: "coding", Revisão: "review", Publicado: "done" };

export function toMyProject(project: import("@/types").StudentProject): MyProject {
  return { id: project.id, title: project.title, description: project.description,
    phase: Object.keys(PHASE_STATUS).find(k => PHASE_STATUS[k] === project.status) ?? "Idealização",
    tools: project.stack.join(", "), link: project.link };
}

/**
 * Selo "em projeto": o estudante avisa que já está alocado. É o único dado
 * que o site mantém depois que um contato é liberado.
 */
function InProjectToggle({ studentId }: { studentId: string }) {
  const { inProject } = useVitrine();
  const on = !!inProject[studentId];

  return (
    <section className="vt-card mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between md:px-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <p className="font-sans text-[15px] text-navy">Estou em projeto</p>
          {on && <InProjectBadge />}
        </div>
        <p className="font-sans text-[13px] text-navy/55">
          O selo aparece no seu perfil público e para quem consulta a vitrine.
        </p>
      </div>
      <button
        role="switch"
        aria-checked={on}
        onClick={() => setInProject(studentId, !on)}
        className={`vt-btn shrink-0 self-start sm:self-auto ${on ? "vt-btn-secondary" : "vt-btn-primary"}`}
      >
        {on ? "Remover selo" : "Marcar em projeto"}
      </button>
    </section>
  );
}

export function Projects({
  projects,
  studentId,
}: {
  projects: MyProject[];
  studentId: string;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState<Partial<MyProject>>({});
  const [opened, setOpened] = useState<MyProject | null>(null);

  const { validate, field, reset } = useValidation<"title" | "phase" | "description">(() => ({
    title: required(form.title ?? "", "Dê um nome ao projeto."),
    phase: required(form.phase ?? "", "Escolha a etapa."),
    description: required(form.description ?? "", "Descreva o projeto."),
  }));

  const close = () => {
    setIsAdding(false);
    setForm({});
    reset();
  };

  const saveProject = async () => {
    if (!validate()) return;
    const project = await addProject({
      title: form.title!, description: form.description!,
      status: PHASE_STATUS[form.phase!],
      stack: (form.tools ?? "").split(",").map(s => s.trim()).filter(Boolean),
      year: String(new Date().getFullYear()), area: "", link: form.link ?? "",
    });
    if (project) close();
  };

  return (
    <main className={`${PAGE} pb-20`}>
      <PageHead
        eyebrow="Portfólio"
        title="Meus projetos."
        aside={
          <button onClick={() => setIsAdding(true)} className="vt-btn vt-btn-primary self-start md:self-auto">
            <PlusIcon /> Novo projeto <ArrowIcon />
          </button>
        }
      />

      <InProjectToggle studentId={studentId} />

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-navy/20 p-12 text-center font-sans text-sm text-navy/55">
          Você ainda não publicou nenhum projeto.
        </div>
      ) : (
        <ul className="vt-card divide-y divide-navy/8 overflow-hidden">
          {projects.map((p, i) => (
            <li key={p.id}>
              <button
                onClick={() => setOpened(p)}
                className="flex w-full items-center gap-4 rounded-none! px-5 py-5 text-left transition-colors hover:bg-navy/[0.03] md:gap-6 md:px-6"
              >
                <span className="hidden w-14 shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-navy/45 sm:block">
                  P{String(projects.length - i).padStart(3, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-[15px] text-navy">{p.title}</p>
                  <p className="truncate font-sans text-[13px] text-navy/55">{p.tools || p.description}</p>
                </div>
                <StatusPill color={PHASE_COLOR[p.phase] ?? SLATE}>{p.phase}</StatusPill>
                <span className="grid size-8 shrink-0 place-items-center text-navy/40">
                  <ChevronIcon />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {opened && (
        <Modal eyebrow={opened.phase} title={opened.title} onClose={() => setOpened(null)}>
          <div className="flex flex-col gap-6">
            <p className="font-sans text-[15px] leading-[1.6] text-navy/75">{opened.description}</p>
            {opened.tools && (
              <div className="flex flex-wrap gap-1.5">
                {opened.tools
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean)
                  .map((t) => (
                    <span key={t} className="vt-pill">
                      {t}
                    </span>
                  ))}
              </div>
            )}
          </div>
          <div className="mt-8 flex items-center justify-end gap-3">
            <button
              onClick={() => setOpened(null)}
              className="rounded-[10px] px-3 py-2 font-sans text-sm text-navy/65 transition-colors hover:text-navy"
            >
              Fechar
            </button>
            {opened.link && (
              <a href={opened.link} target="_blank" rel="noreferrer" className="vt-btn vt-btn-primary">
                Abrir link <ArrowIcon />
              </a>
            )}
          </div>
        </Modal>
      )}

      {isAdding && (
        <Modal eyebrow="Cadastro" title="Novo projeto." onClose={close}>
          <div className="flex flex-col gap-5">
            <Input
              label="Título"
              placeholder="Nome do projeto"
              value={form.title || ""}
              onChange={(v) => setForm({ ...form, title: v })}
              {...field("title")}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Select
                {...field("phase")}
                label="Etapa"
                options={PHASES}
                value={form.phase || ""}
                onChange={(v) => setForm({ ...form, phase: v })}
              />
              <Input
                label="Link (opcional)"
                placeholder="https://github.com/..."
                value={form.link || ""}
                onChange={(v) => setForm({ ...form, link: v })}
                mono
              />
            </div>
            <Input
              label="Descrição"
              placeholder="O que o projeto resolve e como"
              textarea
              rows={4}
              value={form.description || ""}
              onChange={(v) => setForm({ ...form, description: v })}
              {...field("description")}
            />
            <Input
              label="Tecnologias"
              placeholder="React, Python..."
              value={form.tools || ""}
              onChange={(v) => setForm({ ...form, tools: v })}
            />
          </div>
          <div className="mt-8 flex items-center justify-end gap-3">
            <button onClick={close} className="rounded-[10px] px-3 py-2 font-sans text-sm text-navy/65 transition-colors hover:text-navy">
              Cancelar
            </button>
            <button
              onClick={saveProject}
              className="vt-btn vt-btn-primary"
            >
              Publicar projeto <ArrowIcon />
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
