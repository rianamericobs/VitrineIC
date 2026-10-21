import type { SkillLevel, Student, StudentLanguage, StudentSkill } from "@/types";

/**
 * Perfil mínimo para aparecer na vitrine e receber convites: sem nenhuma
 * competência o estudante fica fora do diretório, do catálogo, do
 * matchmaking e da lista de estudantes disponíveis.
 */
export function isProfileVisible(student: Student) {
  return student.skills.length > 0;
}

/**
 * Rascunho editável do perfil, usado pelo onboarding e pela edição do perfil.
 * As competências viram lista com nível, que é o formato do `SkillPicker`.
 */
export interface ProfileDraft {
  name: string;
  unit: string;
  course: string;
  photo: string;
  matricula: string;
  semester: string;
  bio: string;
  interests: string[];
  skills: StudentSkill[];
  languages: StudentLanguage[];
  github: string;
  linkedin: string;
  site: string;
  lattes: string;
}

export const BIO_MAX = 280;

export function toDraft(s: Student): ProfileDraft {
  return {
    name: s.name,
    unit: s.unit,
    course: s.course,
    photo: s.photo ?? "",
    matricula: s.matricula ?? "",
    semester: s.semester,
    bio: s.bio,
    interests: s.interests,
    skills: s.skills.map((name) => ({ name, level: s.skillLevels[name] ?? 1 })),
    languages: s.languages,
    github: s.github,
    linkedin: s.linkedin ?? "",
    site: s.site ?? "",
    lattes: s.lattes ?? "",
  };
}

export function fromDraft(d: ProfileDraft): Partial<Student> {
  const name = d.name.trim();
  const parts = name.split(/\s+/);
  return {
    name,
    initials: ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase(),
    unit: d.unit,
    course: d.course,
    photo: d.photo,
    matricula: d.matricula.trim(),
    semester: d.semester,
    bio: d.bio.trim(),
    interests: d.interests,
    skills: d.skills.map((s) => s.name),
    skillLevels: Object.fromEntries(d.skills.map((s) => [s.name, s.level])) as Partial<Record<string, SkillLevel>>,
    languages: d.languages,
    github: d.github.trim(),
    linkedin: d.linkedin.trim(),
    site: d.site.trim(),
    lattes: d.lattes.trim(),
  };
}
