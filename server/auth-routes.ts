import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Database } from "./db/pool";
import type { StoredAccount } from "./db/types";
import type { Config } from "./config";
import { loginSchema, studentSignupSchema, requesterSignupSchema } from "./schemas";
import { hashPassword, verifyPassword, createSession, clearSession, requireAccount } from "./security";
import { snapshot } from "./db/snapshot";
import { contas, solicitantes } from "./db/repositories";
import { salvarConta, salvarEstudante, salvarSolicitante } from "./db/mutations";
import { ensure } from "./errors";
import { REQUESTER_KIND_LABEL } from "@/data/companies";
import type { MailQueue } from "./mail";
import { requestAccountMail } from "./account-tokens";

export async function authRoutes(app: FastifyInstance, db: Database, config: Config, mail: MailQueue) {
  // Mesmo custo de hash para e-mail inexistente, sem revelar se a conta existe.
  const dummyHash = await hashPassword(randomUUID());
  const limits = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };
  const verificationEmail = (account: StoredAccount) =>
    requestAccountMail(db, config, mail, account, "verify_email",
      () => app.log.error("Falha ao entregar confirmação de e-mail. O usuário pode solicitar um novo link."));

  app.post("/api/auth/login", limits, async (request, reply) => {
    const data = loginSchema.parse(request.body);
    const account = await contas.porEmail(db.sql, data.email);
    const valid = await verifyPassword(data.password, account?.passwordHash ?? dummyHash);
    ensure(account && valid && (!data.role || account.role === data.role), 401, "E-mail ou senha incorretos.");
    // Não cria sessão com credenciais que mudaram enquanto o scrypt estava em andamento.
    const latest = (await contas.porId(db.sql, account.id))!;
    ensure(latest.passwordHash === account.passwordHash, 401, "E-mail ou senha incorretos.");
    await createSession(db, config, request, reply, latest);
    return snapshot(db.sql, config, latest);
  });

  app.post("/api/auth/students", limits, async (request, reply) => {
    const data = studentSignupSchema.parse(request.body);
    const passwordHash = await hashPassword(data.password);
    const id = `STU-${randomUUID()}`;
    const account: StoredAccount = {
      id: `ACC-${randomUUID()}`, name: data.name, email: data.email, role: "student",
      profileId: id, createdAt: new Date().toISOString(), passwordHash,
    };
    await db.transaction(async tx => {
      ensure(!await contas.porEmail(tx, data.email), 409, "Já existe uma conta com este e-mail.");
      await salvarConta(tx, account);
      await salvarEstudante(tx, {
        id, name: data.name, email: data.email, initials: "", unit: data.unit, course: data.course,
        semester: "", gpa: "", bio: "", interests: [], skills: [], skillLevels: {},
        languages: [], projects: [], github: "", availability: "",
      }, account.id);
    });
    await createSession(db, config, request, reply, account);
    await verificationEmail(account);
    reply.code(201);
    return snapshot(db.sql, config, account);
  });

  app.post("/api/auth/requesters", limits, async (request, reply) => {
    const data = requesterSignupSchema.parse(request.body);
    const passwordHash = await hashPassword(data.password);
    const account: StoredAccount = {
      id: `ACC-${randomUUID()}`, name: data.contactName, email: data.email, role: "requester",
      profileId: data.organization, createdAt: new Date().toISOString(), passwordHash,
    };
    await db.transaction(async tx => {
      ensure(!await contas.porEmail(tx, data.email), 409, "Já existe uma conta com este e-mail.");
      ensure(!await solicitantes.porNome(tx, data.organization), 409, "Já existe uma organização com este nome.");
      await salvarConta(tx, account);
      await salvarSolicitante(tx, {
        name: data.organization, kind: data.kind, type: REQUESTER_KIND_LABEL[data.kind],
        contactName: data.contactName, contactEmail: data.email, city: data.city, site: data.site,
        since: new Date().getFullYear().toString(), description: "",
      }, account.id, `SOL-${randomUUID()}`);
    });
    await createSession(db, config, request, reply, account);
    await verificationEmail(account);
    reply.code(201);
    return snapshot(db.sql, config, account);
  });

  app.post("/api/auth/logout", async (request, reply) => {
    await clearSession(db, request, reply);
    return snapshot(db.sql, config);
  });
  app.get("/api/auth/me", async request => {
    const account = await requireAccount(db, request);
    return snapshot(db.sql, config, account);
  });
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return `${parts[0][0]}${parts.length > 1 ? parts[parts.length - 1][0] : ""}`.toUpperCase();
}
