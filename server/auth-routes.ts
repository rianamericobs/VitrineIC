import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Database, StoredAccount } from "./database";
import type { Config } from "./config";
import { loginSchema, studentSignupSchema, requesterSignupSchema } from "./schemas";
import { hashPassword, verifyPassword, createSession, clearSession, requireAccount } from "./security";
import { snapshot } from "./views";
import { ensure } from "./errors";
import { REQUESTER_KIND_LABEL } from "@/data/companies";
import type { MailQueue } from "./mail";
import { requestAccountMail } from "./account-tokens";

export async function authRoutes(app: FastifyInstance, db: Database, config: Config, mail: MailQueue) {
  // Mesmo custo de hash para e-mail inexistente, sem revelar se a conta existe.
  const dummyHash = await hashPassword(randomUUID());
  const limits = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };
  const verificationEmail = (account: StoredAccount) => requestAccountMail(db, config, mail, account, "verify_email", () => app.log.error("Falha ao entregar confirmação de e-mail. O usuário pode solicitar um novo link."));

  app.post("/api/auth/login", limits, async (request, reply) => {
    const data = loginSchema.parse(request.body);
    const row = db.sql.prepare("SELECT data FROM accounts WHERE email=?").get(data.email);
    const account = row ? JSON.parse(String(row.data)) as StoredAccount : undefined;
    const valid = await verifyPassword(data.password, account?.passwordHash ?? dummyHash);
    ensure(account && valid && (!data.role || account.role === data.role), 401, "E-mail ou senha incorretos.");
    // Não cria sessão com credenciais que mudaram enquanto scrypt estava em andamento.
    const latest = db.get("accounts", account.id)!;
    ensure(latest.passwordHash === account.passwordHash, 401, "E-mail ou senha incorretos.");
    createSession(db, config, request, reply, latest);
    return snapshot(db, config, latest);
  });

  app.post("/api/auth/students", limits, async (request, reply) => {
    const data = studentSignupSchema.parse(request.body);
    const passwordHash = await hashPassword(data.password);
    const id = `STU-${randomUUID()}`;
    const account: StoredAccount = { id: randomUUID(), name: data.name, email: data.email, role: "student", profileId: id, createdAt: new Date().toISOString(), passwordHash };
    db.transaction(() => {
      ensure(!db.sql.prepare("SELECT id FROM accounts WHERE email=?").get(data.email), 409, "Já existe uma conta com este e-mail.");
      db.put("students", {
        id, name: data.name, email: data.email, initials: initialsOf(data.name), unit: data.unit, course: data.course,
        semester: "", gpa: "", bio: "", interests: [], skills: [], skillLevels: {}, languages: [], projects: [], github: "", availability: "",
      });
      db.put("accounts", account);
      createSession(db, config, request, reply, account);
    });
    verificationEmail(account);
    reply.code(201);
    return snapshot(db, config, account);
  });

  app.post("/api/auth/requesters", limits, async (request, reply) => {
    const data = requesterSignupSchema.parse(request.body);
    const passwordHash = await hashPassword(data.password);
    const account: StoredAccount = { id: randomUUID(), name: data.contactName, email: data.email, role: "requester", profileId: data.organization, createdAt: new Date().toISOString(), passwordHash };
    db.transaction(() => {
      ensure(!db.sql.prepare("SELECT id FROM accounts WHERE email=?").get(data.email), 409, "Já existe uma conta com este e-mail.");
      ensure(!db.get("companies", data.organization), 409, "Já existe uma organização com este nome.");
      db.put("companies", { name: data.organization, kind: data.kind, type: REQUESTER_KIND_LABEL[data.kind], contactName: data.contactName, contactEmail: data.email, city: data.city, site: data.site, since: new Date().getFullYear().toString(), description: "" });
      db.put("accounts", account);
      createSession(db, config, request, reply, account);
    });
    verificationEmail(account);
    reply.code(201);
    return snapshot(db, config, account);
  });

  app.post("/api/auth/logout", async (request, reply) => {
    clearSession(db, request, reply);
    return snapshot(db, config);
  });
  app.get("/api/auth/me", async request => {
    const account = requireAccount(db, request);
    return snapshot(db, config, account);
  });
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return `${parts[0][0]}${parts.length > 1 ? parts[parts.length - 1][0] : ""}`.toUpperCase();
}
