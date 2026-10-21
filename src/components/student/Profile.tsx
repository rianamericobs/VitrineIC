import { useState } from "react";
import { Input, Select, MultiSelect, Label } from "./ui";
import { SkillPicker } from "./SkillPicker";
import { LanguagePicker } from "./LanguagePicker";
import type { MyProject } from "./Projects";
import { Avatar } from "@/components/app/Avatar";
import { ArrowIcon } from "@/components/app/Icons";
import { BackButton } from "@/components/public/BackButton";
import { Eyebrow } from "@/components/public/Eyebrow";
import { PAGE } from "@/components/public/layout";
import { UNITS, findUnit } from "@/data/institution";
import { LANGUAGE_LEVELS } from "@/data/languages";
import { LEVELS } from "@/data/skills";
import { BIO_MAX, fromDraft, isProfileVisible, toDraft, type ProfileDraft } from "@/lib/profile";
import { updateStudent } from "@/lib/store";
import { digits, first, maxLength, required, useValidation } from "@/lib/validate";
import type { Student, StudentSkill, StudentLanguage } from "@/types";

const INTERESTS = [
  "Inteligência Artificial", "Engenharia de Software", "Redes & Sistemas",
  "Segurança da Informação", "Banco de Dados", "Computação Gráfica",
  "Sistemas Embarcados", "Bioinformática", "HCI & Design",
];

/** Barra de nível do Figma: rótulo à direita e trilho navy a 8%. */
function LevelBar({ name, level, labels }: { name: string; level: number; labels: readonly string[] }) {
  return (
    <li className="pt-5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-sans text-sm text-navy">{name}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-navy/65">{labels[level - 1]}</span>
      </div>
      <span className="mt-2 block h-1.5 rounded-full bg-navy/8">
        <span className="block h-1.5 rounded-full bg-navy" style={{ width: `${(level / labels.length) * 100}%` }} />
      </span>
    </li>
  );
}

export function Profile({
  student,
  email,
  projects,
}: {
  student: Student;
  email: string;
  projects: MyProject[];
}) {
  const [editing, setEditing] = useState(false);
  const [data, setDataState] = useState<ProfileDraft>(() => toDraft(student));
  const setData = (patch: Partial<ProfileDraft>) => setDataState({ ...data, ...patch });

  const { validate, field, reset } = useValidation<"name" | "unit" | "course" | "matricula" | "bio">(() => ({
    name: required(data.name, "Informe seu nome."),
    unit: required(data.unit, "Escolha o instituto."),
    course: required(data.course, "Escolha o curso."),
    matricula: digits(data.matricula),
    bio: first(maxLength(data.bio, BIO_MAX)),
  }));

  const skills: StudentSkill[] = data.skills;
  const languages: StudentLanguage[] = data.languages;
  const unit = findUnit(data.unit);

  const startEditing = () => {
    setDataState(toDraft(student));
    reset();
    setEditing(true);
  };

  const save = async () => {
    if (!validate()) return;
    if (!await updateStudent(student.id, fromDraft(data))) return;
    setEditing(false);
  };

  if (editing) {
    return (
      <main className={`${PAGE} pt-8 pb-20`}>
        <BackButton label="Voltar ao perfil" onClick={() => setEditing(false)} />

        <header className="flex flex-col gap-6 pt-10 pb-8 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-5">
            <Eyebrow>Configurações</Eyebrow>
            <h1 className="font-display text-[40px] font-medium leading-none tracking-[-0.035em] text-navy md:text-page">
              Editar perfil.
            </h1>
          </div>
          <button onClick={save} className="vt-btn vt-btn-primary self-start md:self-auto">
            Salvar alterações <ArrowIcon />
          </button>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-6">
            <section className="vt-card flex flex-col gap-5 p-6 md:p-8">
              <Eyebrow>Informações básicas</Eyebrow>
              <div className="grid gap-5 md:grid-cols-2">
                <Input label="Nome completo" value={data.name} onChange={(v) => setData({ name: v })} {...field("name")} />
                <div>
                  <Label>E-mail institucional</Label>
                  <p className="flex h-[41px] items-center font-mono text-[13px] text-navy/80">{email}</p>
                  <p className="mt-1.5 font-sans text-xs text-navy/55">É o seu login e não muda aqui.</p>
                </div>
                <Select
                  {...field("unit")}
                  label="Instituto ou faculdade"
                  options={UNITS.map((u) => ({ value: u.short, label: `${u.name} (${u.short})` }))}
                  value={data.unit}
                  onChange={(v: string) => setData({ unit: v, course: "" })}
                />
                <Select
                  {...field("course")}
                  label="Curso"
                  options={unit?.courses ?? []}
                  value={data.course}
                  onChange={(v: string) => setData({ course: v })}
                />
                <Input
                  label="Matrícula"
                  inputMode="numeric"
                  value={data.matricula}
                  onChange={(v) => setData({ matricula: v })}
                  mono
                  {...field("matricula")}
                />
                <Select
                  label="Semestre atual"
                  options={Array.from({ length: 14 }, (_, i) => `${i + 1}º semestre`)}
                  value={data.semester}
                  onChange={(v: string) => setData({ semester: v })}
                />
              </div>
              <Input
                label="Bio"
                textarea
                rows={4}
                value={data.bio}
                onChange={(v) => setData({ bio: v })}
                hint={`${data.bio.length} de ${BIO_MAX}`}
                {...field("bio")}
              />
            </section>

            <section className="vt-card flex flex-col gap-6 p-6 md:p-8">
              <Eyebrow>Áreas e competências</Eyebrow>
              <MultiSelect
                label="Áreas de interesse"
                options={INTERESTS}
                value={data.interests}
                onChange={(v) => setData({ interests: v })}
              />
              <SkillPicker value={skills} course={data.course} onChange={(s: StudentSkill[]) => setData({ skills: s })} />
              <div>
                <Label>Idiomas</Label>
                <LanguagePicker value={languages} onChange={(l: StudentLanguage[]) => setData({ languages: l })} />
              </div>
            </section>
          </div>

          <aside className="vt-card flex flex-col items-center gap-5 p-6 md:p-8">
            {data.photo ? (
              <img src={data.photo} alt="Foto de perfil" className="size-28 rounded-[28px] object-cover" />
            ) : (
              <Avatar name={data.name || "?"} size="xl" />
            )}
            <div className="flex w-full flex-col gap-4">
              <Input label="GitHub" placeholder="github.com/usuario" value={data.github} onChange={(v) => setData({ github: v })} />
              <Input label="LinkedIn" placeholder="linkedin.com/in/usuario" value={data.linkedin} onChange={(v) => setData({ linkedin: v })} />
              <Input label="Site / Portfólio" placeholder="seusite.dev" value={data.site} onChange={(v) => setData({ site: v })} />
              <Input label="Lattes" placeholder="lattes.cnpq.br/xxxxxxxx" value={data.lattes} onChange={(v) => setData({ lattes: v })} />
            </div>
          </aside>
        </div>
      </main>
    );
  }

  const shown = toDraft(student);

  return (
    <main className={`${PAGE} pt-12 pb-20 md:pt-16`}>
      <div className="grid items-start gap-6 lg:grid-cols-[340px_1fr]">
        <aside className="vt-card flex flex-col p-7">
          {shown.photo ? (
            <img src={shown.photo} alt="" className="size-20 rounded-[22px] object-cover" />
          ) : (
            <Avatar name={shown.name || "?"} size="xl" />
          )}
          <h1 className="mt-6 font-display text-[22px] font-medium tracking-[-0.01em] text-navy">
            {shown.name || "Seu nome"}
          </h1>
          <p className="mt-1 font-sans text-sm text-navy/60">
            {[shown.course, shown.semester].filter(Boolean).join(" · ") || "Curso e período"}
          </p>
          {shown.bio && <p className="mt-6 font-sans text-[15px] leading-[1.5] text-navy/80">{shown.bio}</p>}
          {!isProfileVisible(student) && (
            <p className="mt-6 font-sans text-xs text-ochre">Fora da vitrine até você adicionar uma competência.</p>
          )}
          {shown.skills.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-1.5">
              {shown.skills.slice(0, 3).map((s) => (
                <span key={s.name} className="vt-pill">
                  {s.name}
                </span>
              ))}
            </div>
          )}
          <button onClick={startEditing} className="vt-btn vt-btn-secondary mt-6 w-full">
            Editar perfil
          </button>
        </aside>

        <div className="flex min-w-0 flex-col gap-8">
          <section className="vt-card p-7">
            <Eyebrow>Competências</Eyebrow>
            {shown.skills.length === 0 ? (
              <p className="mt-5 font-sans text-sm text-navy/55">
                Nenhuma competência cadastrada. Use "Editar perfil" para adicionar.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col">
                {shown.skills.map((s) => (
                  <LevelBar key={s.name} name={s.name} level={s.level} labels={LEVELS} />
                ))}
              </ul>
            )}
          </section>

          {shown.languages.length > 0 && (
            <section className="vt-card p-7">
              <Eyebrow>Idiomas</Eyebrow>
              <ul className="mt-2 flex flex-col">
                {shown.languages.map((l) => (
                  <LevelBar key={l.name} name={l.name} level={l.level} labels={LANGUAGE_LEVELS} />
                ))}
              </ul>
            </section>
          )}

          <section>
            <Eyebrow>Projetos</Eyebrow>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {projects.map((p, i) => (
                <article key={p.id} className="vt-card flex flex-col gap-5 p-6">
                  <div className="flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.08em] text-navy/60">
                    <span>{p.phase}</span>
                    <span className="truncate">{p.tools}</span>
                  </div>
                  <div className="vt-stone relative h-28 rounded-xl">
                    <span className="absolute bottom-4 left-4 font-mono text-[10px] uppercase tracking-[0.08em] text-sky">
                      VIC · P{String(projects.length - i).padStart(3, "0")}
                    </span>
                  </div>
                  <h3 className="font-display text-xl font-medium leading-[1.2] tracking-[-0.02em] text-navy">{p.title}</h3>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
