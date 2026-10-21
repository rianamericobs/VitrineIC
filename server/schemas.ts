import { z } from "zod";
import { findUnit, isUfalEmail } from "@/data/institution";
import { canonicalSkill } from "@/data/skills";

const text = (max = 200) => z.string().trim().min(1, "Campo obrigatório.").max(max);
const optionalText = (max = 2000) => z.string().trim().max(max);
export const emailSchema = z.string().trim().toLowerCase().email("E-mail inválido.").max(254);
export const passwordSchema = z.string().min(8, "A senha precisa de pelo menos 8 caracteres.").max(128);
const kind = z.enum(["empresa", "ong", "orgao_publico", "professor"]);
const link = z.string().trim().max(2048).refine(value => {
  if (!value) return true;
  try { return ["http:", "https:"].includes(new URL(value.includes(":") ? value : `https://${value}`).protocol); }
  catch { return false; }
}, "Use um endereço HTTP ou HTTPS válido.");
const skills = z.array(text(80)).max(60).transform(values => [...new Set(values.map(canonicalSkill))]);
const courseValid = (data: { unit: string; course: string }) => !!findUnit(data.unit)?.courses.includes(data.course);
const courseError = { message: "Escolha um curso válido para a unidade.", path: ["course"] };

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128), role: z.enum(["student", "requester", "curator"]).optional() }).strict();
export const studentSignupSchema = z.object({
  name: text(150), email: emailSchema.refine(isUfalEmail, "Use seu e-mail institucional."), password: passwordSchema,
  unit: text(), course: text(), consent: z.literal(true),
}).strict().refine(courseValid, courseError);
export const requesterSignupSchema = z.object({
  organization: text(150), contactName: text(150), email: emailSchema, password: passwordSchema,
  city: text(), kind, site: link.default(""),
}).strict();
export const projectSchema = z.object({
  title: text(200), description: text(10000), stack: skills.default([]),
  status: z.enum(["ideation", "coding", "review", "done"]),
  year: z.string().regex(/^\d{4}$/), area: optionalText(200),
  link: link.transform(v => v && !/^https?:\/\//i.test(v) ? `https://${v}` : v).optional(),
}).strict();
export const studentPatchSchema = z.object({
  name: text(150).optional(), initials: optionalText(10).optional(),
  unit: text().optional(), course: text().optional(), matricula: z.string().regex(/^\d{0,30}$/).optional(),
  semester: optionalText(40).optional(), bio: optionalText(280).optional(),
  interests: z.array(text(100)).max(30).optional(), skills: skills.optional(),
  skillLevels: z.record(z.string().min(1).max(80), z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])).refine(v => Object.keys(v).length <= 60).optional(),
  languages: z.array(z.object({ name: text(80), level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]) }).strict()).max(30).optional(),
  github: link.optional(), linkedin: link.optional(), site: link.optional(), lattes: link.optional(),
  availability: optionalText(200).optional(), inProject: z.boolean().optional(),
  photo: z.string().max(1_500_000).refine(v => !v || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v) || /^https:\/\//.test(v), "Foto inválida.").optional(),
  onboardedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), onboardingSkipped: z.boolean().optional(),
}).strict();
export const companyPatchSchema = z.object({
  contactName: text(150).optional(), contactEmail: emailSchema.optional(), kind: kind.optional(),
  city: text().optional(), site: link.optional(), description: optionalText(10000).optional(),
}).strict();
export const demandSchema = z.object({
  title: text(200), description: text(10000), area: text(), scope: text(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "Data inválida."),
  skills: skills.refine(v => v.length > 0, "Informe ao menos uma competência."),
  audience: optionalText().optional(), academicLevel: optionalText().optional(),
  notes: optionalText(10000).optional(), teamSize: optionalText().optional(), budget: optionalText().optional(),
}).strict();
export const statusSchema = z.object({ status: z.enum(["nova", "em_analise", "aprovada", "rejeitada"]) }).strict();
export const interestSchema = z.object({
  demandId: text(), studentId: text(), origin: z.enum(["candidatura", "convite", "sugestao"]),
  justification: optionalText(3000).optional(),
}).strict().refine(v => v.origin !== "sugestao" || !!v.justification, { message: "Justifique a sugestão.", path: ["justification"] });
export const responseSchema = z.object({ accept: z.boolean(), refusalReason: optionalText(3000).optional() }).strict();
export const messageSchema = z.object({ content: text(5000) }).strict();
export const recoverySchema = z.object({ email: emailSchema }).strict();
export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Link inválido ou expirado.");
export const confirmationSchema = z.object({ token: tokenSchema }).strict();
export const resetPasswordSchema = z.object({ token: tokenSchema, password: passwordSchema }).strict();
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), password: passwordSchema }).strict();
export { courseValid };
