import type { FastifyInstance } from "fastify";
import type { Database, StoredAccount } from "./database";
import type { Config } from "./config";
import type { MailQueue } from "./mail";
import { accountFor, clearSession, createSession, hashPassword, requireAccount, verifyPassword } from "./security";
import { changePasswordSchema, confirmationSchema, recoverySchema, resetPasswordSchema } from "./schemas";
import { ensure } from "./errors";
import { readActionToken, RECOVERY_MESSAGE, requestAccountMail } from "./account-tokens";
import { snapshot } from "./views";
import { notify } from "./notifications";

export function accountRoutes(app: FastifyInstance, db: Database, config: Config, mail: MailQueue) {
  const limits = { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } };
  const mailAvailable = () => ensure(config.mail.mode !== "disabled", 503, "O envio de e-mail ainda não foi configurado. Fale com a coordenação.");
  const mailFailed = () => app.log.error("Não foi possível entregar um e-mail de acesso. Verifique a configuração do serviço de e-mail.");

  app.post("/api/auth/forgot-password", limits, async (request, reply) => {
    mailAvailable();
    const { email } = recoverySchema.parse(request.body);
    const row = db.sql.prepare("SELECT data FROM accounts WHERE email=?").get(email);
    if (row) requestAccountMail(db, config, mail, JSON.parse(String(row.data)) as StoredAccount, "reset_password", mailFailed);
    return reply.code(202).send({ message: RECOVERY_MESSAGE });
  });

  app.post("/api/auth/reset-password", limits, async (request, reply) => {
    const data = resetPasswordSchema.parse(request.body);
    readActionToken(db, data.token, "reset_password");
    const passwordHash = await hashPassword(data.password);
    const current = accountFor(db, request);
    db.transaction(() => {
      // A validade é verificada novamente após o hash assíncrono: duas requisições não consomem o mesmo link.
      const token = readActionToken(db, data.token, "reset_password");
      const account = db.get("accounts", token.accountId)!;
      db.put("accounts", { ...account, passwordHash, credentialVersion: token.credentialVersion + 1, emailVerifiedAt: account.emailVerifiedAt ?? new Date().toISOString() });
      db.sql.prepare("DELETE FROM sessions WHERE account_id=?").run(account.id);
      db.sql.prepare("DELETE FROM account_tokens WHERE account_id=?").run(account.id);
      if (current?.id === account.id) clearSession(db, request, reply);
      notify(db, account.id, "Senha redefinida", "Sua senha foi redefinida. As sessões anteriores foram encerradas.");
    });
    return { message: "Senha redefinida. Entre novamente com a nova senha.", state: snapshot(db, config, accountFor(db, request)) };
  });

  app.post("/api/auth/verification-email", limits, async (request, reply) => {
    const account = requireAccount(db, request);
    mailAvailable();
    requestAccountMail(db, config, mail, account, "verify_email", mailFailed);
    return reply.code(202).send({ message: "Se o e-mail ainda não estiver confirmado, você receberá um link de confirmação." });
  });

  app.post("/api/auth/verify-email", limits, async request => {
    const { token } = confirmationSchema.parse(request.body);
    db.transaction(() => {
      const target = readActionToken(db, token, "verify_email");
      const account = db.get("accounts", target.accountId)!;
      db.put("accounts", { ...account, emailVerifiedAt: new Date().toISOString() });
      db.sql.prepare("DELETE FROM account_tokens WHERE account_id=? AND purpose='verify_email'").run(account.id);
    });
    return { message: "E-mail confirmado com sucesso.", state: snapshot(db, config, accountFor(db, request)) };
  });

  app.post("/api/auth/change-password", limits, async (request, reply) => {
    const account = requireAccount(db, request);
    const data = changePasswordSchema.parse(request.body);
    ensure(await verifyPassword(data.currentPassword, account.passwordHash), 400, "A senha atual está incorreta.");
    ensure(data.currentPassword !== data.password, 400, "Escolha uma senha diferente da atual.");
    const passwordHash = await hashPassword(data.password);
    db.transaction(() => {
      const latest = db.get("accounts", account.id)!;
      ensure(latest.passwordHash === account.passwordHash && accountFor(db, request)?.id === account.id, 409, "A sessão ou a senha mudou. Entre novamente antes de continuar.");
      const updated = { ...latest, passwordHash, credentialVersion: (latest.credentialVersion ?? 0) + 1 };
      db.put("accounts", updated);
      db.sql.prepare("DELETE FROM sessions WHERE account_id=?").run(account.id);
      db.sql.prepare("DELETE FROM account_tokens WHERE account_id=?").run(account.id);
      createSession(db, config, request, reply, updated);
      notify(db, account.id, "Senha alterada", "Sua senha foi alterada. As demais sessões foram encerradas.");
    });
    return snapshot(db, config, db.get("accounts", account.id));
  });

  app.post("/api/auth/logout-all", limits, async (request, reply) => {
    const account = requireAccount(db, request);
    db.sql.prepare("DELETE FROM sessions WHERE account_id=?").run(account.id);
    clearSession(db, request, reply);
    return snapshot(db, config);
  });
}
