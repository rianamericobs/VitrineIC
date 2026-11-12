import type { FastifyInstance } from "fastify";
import type { Database } from "./db/pool";
import type { Config } from "./config";
import type { MailQueue } from "./mail";
import { accountFor, clearSession, createSession, hashPassword, requireAccount, verifyPassword } from "./security";
import { changePasswordSchema, confirmationSchema, recoverySchema, resetPasswordSchema } from "./schemas";
import { ensure } from "./errors";
import { readActionToken, RECOVERY_MESSAGE, requestAccountMail } from "./account-tokens";
import { snapshot } from "./db/snapshot";
import { contas } from "./db/repositories";
import { salvarConta } from "./db/mutations";
import { notificar } from "./notifications";

export function accountRoutes(app: FastifyInstance, db: Database, config: Config, mail: MailQueue) {
  const limits = { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } };
  const mailAvailable = () => ensure(config.mail.mode !== "disabled", 503,
    "O envio de e-mail ainda não foi configurado. Fale com a coordenação.");
  const mailFailed = () => app.log.error(
    "Não foi possível entregar um e-mail de acesso. Verifique a configuração do serviço de e-mail.");

  app.post("/api/auth/forgot-password", limits, async (request, reply) => {
    mailAvailable();
    const { email } = recoverySchema.parse(request.body);
    const conta = await contas.porEmail(db.sql, email);
    if (conta) await requestAccountMail(db, config, mail, conta, "reset_password", mailFailed);
    return reply.code(202).send({ message: RECOVERY_MESSAGE });
  });

  app.post("/api/auth/reset-password", limits, async (request, reply) => {
    const data = resetPasswordSchema.parse(request.body);
    await readActionToken(db, data.token, "reset_password");
    const passwordHash = await hashPassword(data.password);
    const atual = await accountFor(db, request);
    const alvoId = await db.transaction(async tx => {
      // Revalida depois do hash assíncrono: duas requisições não consomem o mesmo link.
      const token = await readActionToken(db, data.token, "reset_password");
      const conta = (await contas.porId(tx, token.accountId))!;
      await salvarConta(tx, {
        ...conta, passwordHash,
        credentialVersion: token.credentialVersion + 1,
        emailVerifiedAt: conta.emailVerifiedAt ?? new Date().toISOString(),
      });
      await tx.run("DELETE FROM sessao WHERE conta_id = $1", [conta.id]);
      await tx.run("DELETE FROM token_conta WHERE conta_id = $1", [conta.id]);
      await notificar(tx, conta.id, "Senha redefinida",
        "Sua senha foi redefinida. As sessões anteriores foram encerradas.");
      return conta.id;
    });
    // Só derruba o cookie de quem está logado na própria conta redefinida.
    if (atual?.id === alvoId) await clearSession(db, request, reply);
    return {
      message: "Senha redefinida. Entre novamente com a nova senha.",
      state: await snapshot(db.sql, config, await accountFor(db, request)),
    };
  });

  app.post("/api/auth/verification-email", limits, async (request, reply) => {
    const account = await requireAccount(db, request);
    mailAvailable();
    await requestAccountMail(db, config, mail, account, "verify_email", mailFailed);
    return reply.code(202).send({
      message: "Se o e-mail ainda não estiver confirmado, você receberá um link de confirmação.",
    });
  });

  app.post("/api/auth/verify-email", limits, async request => {
    const { token } = confirmationSchema.parse(request.body);
    await db.transaction(async tx => {
      const alvo = await readActionToken(db, token, "verify_email");
      const conta = (await contas.porId(tx, alvo.accountId))!;
      await salvarConta(tx, { ...conta, emailVerifiedAt: new Date().toISOString() });
      await tx.run("DELETE FROM token_conta WHERE conta_id = $1 AND proposito = 'verify_email'", [conta.id]);
    });
    return {
      message: "E-mail confirmado com sucesso.",
      state: await snapshot(db.sql, config, await accountFor(db, request)),
    };
  });

  app.post("/api/auth/change-password", limits, async (request, reply) => {
    const account = await requireAccount(db, request);
    const data = changePasswordSchema.parse(request.body);
    ensure(await verifyPassword(data.currentPassword, account.passwordHash), 400, "A senha atual está incorreta.");
    ensure(data.currentPassword !== data.password, 400, "Escolha uma senha diferente da atual.");
    const passwordHash = await hashPassword(data.password);
    const atualizada = await db.transaction(async tx => {
      const latest = (await contas.porId(tx, account.id))!;
      const sessao = await accountFor(db, request);
      ensure(latest.passwordHash === account.passwordHash && sessao?.id === account.id, 409,
        "A sessão ou a senha mudou. Entre novamente antes de continuar.");
      const nova = { ...latest, passwordHash, credentialVersion: (latest.credentialVersion ?? 0) + 1 };
      await salvarConta(tx, nova);
      await tx.run("DELETE FROM sessao WHERE conta_id = $1", [account.id]);
      await tx.run("DELETE FROM token_conta WHERE conta_id = $1", [account.id]);
      await notificar(tx, account.id, "Senha alterada",
        "Sua senha foi alterada. As demais sessões foram encerradas.");
      return nova;
    });
    await createSession(db, config, request, reply, atualizada);
    return snapshot(db.sql, config, atualizada);
  });

  app.post("/api/auth/logout-all", limits, async (request, reply) => {
    const account = await requireAccount(db, request);
    await db.sql.run("DELETE FROM sessao WHERE conta_id = $1", [account.id]);
    await clearSession(db, request, reply);
    return snapshot(db.sql, config);
  });
}
