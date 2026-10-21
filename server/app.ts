import Fastify from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import staticFiles from "@fastify/static";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { ZodError } from "zod";
import { Database } from "./database";
import { readConfig, type Config } from "./config";
import { accountFor } from "./security";
import { ensure, HttpError } from "./errors";
import { snapshot } from "./views";
import { authRoutes } from "./auth-routes";
import { domainRoutes } from "./domain-routes";
import { inboxRoutes } from "./inbox-routes";
import { fileRoutes } from "./file-routes";
import { createMailer, MailQueue, type Mailer } from "./mail";
import { accountRoutes } from "./account-routes";

export async function buildApp(overrides: Partial<Config> = {}, services: { mailer?: Mailer } = {}) {
  const config = { ...readConfig(), ...overrides };
  ensure(!(config.production && config.demo), 500, "Modo de demonstração proibido em produção.");
  ensure(!(config.production && config.mail.mode === "file" && !services.mailer), 500, "E-mails em arquivo são exclusivos de desenvolvimento.");
  ensure(!config.requireVerifiedEmail || config.mail.mode !== "disabled", 500, "A confirmação de e-mail exige um serviço de envio configurado.");
  const mail = new MailQueue(services.mailer ?? createMailer(config.mail));
  const db = new Database(config.databasePath);
  if (config.production && db.sql.prepare("SELECT id FROM accounts WHERE id IN ('ACC-001','ACC-002','ACC-003')").get()) {
    db.close();
    throw new Error("Use um banco sem contas de demonstração em produção.");
  }
  const app = Fastify({ logger: config.logger ? { redact: ["req.headers.cookie", "req.headers.authorization", "res.headers.set-cookie"] } : false, bodyLimit: 2 * 1024 * 1024, trustProxy: false });
  await app.register(cookie);
  await app.register(rateLimit, { max: 240, timeWindow: "1 minute" });
  await app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 0, parts: 1 } });
  app.addHook("onClose", async () => { await mail.drain(); db.close(); });
  app.addHook("onRequest", async (request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff").header("Referrer-Policy", "same-origin").header("X-Frame-Options", "DENY");
    if (config.production) reply.header("Strict-Transport-Security", "max-age=31536000");
    if (!request.url.startsWith("/api/")) return;
    reply.header("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      // Cabeçalho não simples impede CSRF inclusive em multipart; nenhuma origem recebe CORS.
      ensure(request.headers["x-vitrine-client"] === "web", 403, "Cabeçalho de segurança ausente.");
      ensure(!request.headers.origin || request.headers.origin === config.origin, 403, "Origem não autorizada.");
      ensure(request.headers["sec-fetch-site"] !== "cross-site", 403, "Requisição entre sites não autorizada.");
    }
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send({ error: "Confira os dados enviados.", fields: error.flatten().fieldErrors });
    const status = error instanceof HttpError ? error.statusCode : (typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 500);
    if (status >= 500) request.log.error(error);
    const message = status >= 500 ? "Não foi possível concluir a operação." : error instanceof Error ? error.message : "Requisição inválida.";
    return reply.code(status >= 400 && status < 600 ? status : 500).send({ error: message });
  });
  app.get("/api/health", async () => { db.sql.prepare("SELECT 1").get(); return { status: "ok" }; });
  app.get("/api/state", async request => snapshot(db, config, accountFor(db, request)));
  app.get("/api/impact", async () => snapshot(db, config).impact);
  await authRoutes(app, db, config, mail);
  accountRoutes(app, db, config, mail);
  domainRoutes(app, db, config);
  inboxRoutes(app, db, config);
  fileRoutes(app, db, config);
  const dist = resolve("dist");
  if (existsSync(dist)) await app.register(staticFiles, { root: dist, prefix: "/" });
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/") || request.method !== "GET" || !existsSync(resolve(dist, "index.html"))) return reply.code(404).send({ error: "Rota não encontrada." });
    return reply.sendFile("index.html");
  });
  return { app, db, mail };
}
