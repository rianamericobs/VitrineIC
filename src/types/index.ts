/** Tipos do domínio do VitrineIC. */

/**
 * Status da demanda, o mesmo vocabulário nas três áreas (cada uma escolhe o
 * rótulo que mostra). A demanda não tem etapa de "concluída": depois que um
 * contato é liberado, o site não acompanha o que acontece fora dele.
 */
export type DemandStatus = "nova" | "em_analise" | "aprovada" | "rejeitada" | "contato_liberado";

export interface Demand {
  id: string;
  title: string;
  company: string;
  area: string;
  scope: string;
  deadline: string;
  skills: string[];
  description: string;
  submitted: string;
  status: DemandStatus;
  priority: "alta" | "normal" | "baixa";
  audience?: string;
  academicLevel?: string;
  notes?: string;
  teamSize?: string;
  budget?: string;
}

/** Curso de qualquer unidade da UFAL. A lista vive em `UNITS`, de `@/data/institution`. */
export type Course = string;

/** Proficiência declarada numa tecnologia, de Básico (1) a Especialista (4). */
export type SkillLevel = 1 | 2 | 3 | 4;

export interface StudentSkill {
  name: string;
  level: SkillLevel;
}

export interface StudentLanguage {
  name: string;
  /** De Básico (1) a Fluente (4), ver `LANGUAGE_LEVELS`. */
  level: SkillLevel;
}

/** Estágio de um projeto na vitrine do estudante. */
export type ProjectStatus = "ideation" | "coding" | "review" | "done";

export interface StudentProject {
  id: string;
  title: string;
  stack: string[];
  status: ProjectStatus;
  description: string;
  year: string;
  area: string;
  link?: string;
}

export interface Student {
  id: string;
  name: string;
  initials: string;
  /** E-mail da UFAL; liberado ao solicitante só depois do aceite dos dois lados. */
  email: string;
  /** Sigla da unidade (IC, FEAC...), ver `UNITS`. */
  unit: string;
  matricula?: string;
  course: Course;
  semester: string;
  gpa: string;
  bio: string;
  interests: string[];
  skills: string[];
  /** Proficiência declarada nas principais skills; aparece no perfil público. */
  skillLevels: Partial<Record<string, SkillLevel>>;
  certificados?: string;
  languages: StudentLanguage[];
  projects: StudentProject[];
  github: string;
  availability: string;
  /**
   * Selo "em projeto": o estudante marca quando está alocado em algum
   * projeto. É o único dado que o site mantém depois do contato liberado.
   */
  inProject?: boolean;
  photo?: string;
  linkedin?: string;
  site?: string;
  lattes?: string;
  /** Preenchido ao concluir o onboarding. */
  onboardedAt?: string;
  /** O estudante pulou o onboarding; o painel mostra o aviso de perfil incompleto. */
  onboardingSkipped?: boolean;
}

/* Contas públicas da API: nunca incluem credenciais. */

export type Role = "student" | "requester" | "curator";

export interface Account {
  /** Preenchido somente após confirmação de posse do endereço. */
  emailVerifiedAt?: string;
  id: string;
  role: Role;
  /** Sempre em minúsculas. */
  email: string;
  /** Pessoa: estudante, responsável pela organização ou curador. */
  name: string;
  /** Estudante: id em `students`. Solicitante: nome da organização. Curador: vazio. */
  profileId: string;
  createdAt: string;
}

export type RequesterKind = "empresa" | "ong" | "orgao_publico" | "professor";

/**
 * Por qual porta o interesse nasceu: o estudante se candidatou, o solicitante
 * convidou pela vitrine ou a curadoria sugeriu. Ver `fluxo/fluxo-match.md`.
 */
export type InterestOrigin = "candidatura" | "convite" | "sugestao";

/**
 * Andamento do interesse. O contato só é liberado quando os dois lados
 * aceitam; na candidatura o "sim" do estudante é o próprio ato de se
 * candidatar, e na sugestão o estudante responde antes do solicitante.
 */
export type InterestStatus =
  | "aguardando_estudante"
  | "aguardando_solicitante"
  | "contato_liberado"
  | "recusado_estudante"
  | "recusado_solicitante";

/** Lado que responde a um interesse. A curadoria só cria sugestões e observa. */
export type InterestSide = "estudante" | "solicitante";

/**
 * Registro único de interesse entre um estudante e uma demanda, qualquer que
 * seja a origem. Referencia a demanda em `@/data/demands` e o estudante em
 * `@/data/students` por id — não duplica esses dados.
 */
export interface Interest {
  id: string;
  demandId: string;
  studentId: string;
  origin: InterestOrigin;
  /** Obrigatória na sugestão; opcional na candidatura e no convite. */
  justification?: string;
  status: InterestStatus;
  /** Visível ao solicitante e à curadoria, nunca ao estudante. */
  refusalReason?: string;
  createdAt: string;
}
