import { randomBytes } from "node:crypto";
import type { Database } from "./db/pool";
import type { StoredAccount } from "./db/types";
import type { Config } from "./config";
import type { MailQueue } from "./mail";
import { contas } from "./db/repositories";
import { tokenHash } from "./security";
import { ensure } from "./errors";

export type TokenPurpose = "reset_password" | "verify_email";
interface ActionToken { accountId: string; credentialVersion: number }
export const RECOVERY_MESSAGE = "Se houver uma conta com este e-mail, você receberá as instruções para redefinir a senha.";

export async function readActionToken(db: Database, raw: string, purpose: TokenPurpose): Promise<ActionToken> {
  const linha = await db.sql.row<{ conta_id: string; versao_credencial: number }>(
    `SELECT conta_id, versao_credencial FROM token_conta
     WHERE token_hash = $1 AND proposito = $2 AND expira_em > now()`,
    [tokenHash(raw), purpose],
  );
  ensure(linha, 400, "Link inválido ou expirado. Solicite um novo link.");
  const conta = await contas.porId(db.sql, linha.conta_id);
  // Trocar a senha invalida os links emitidos antes dela.
  ensure(conta && (conta.credentialVersion ?? 0) === Number(linha.versao_credencial),
    400, "Link inválido ou expirado. Solicite um novo link.");
  return { accountId: conta.id, credentialVersion: Number(linha.versao_credencial) };
}

/** Somente hashes são persistidos. O link é entregue fora do ciclo HTTP. */
export async function requestAccountMail(
  db: Database, config: Config, mail: MailQueue, account: StoredAccount,
  purpose: TokenPurpose, onFailure: () => void,
) {
  if (config.mail.mode === "disabled" || (purpose === "verify_email" && account.emailVerifiedAt)) return;
  const raw = randomBytes(32).toString("base64url");
  const hash = tokenHash(raw);
  const minutos = purpose === "reset_password" ? 30 : 24 * 60;

  const emitido = await db.transaction(async tx => {
    await tx.run("DELETE FROM token_conta WHERE expira_em <= now()");
    const recente = await tx.row(
      `SELECT 1 FROM token_conta
       WHERE conta_id = $1 AND proposito = $2 AND criado_em > now() - interval '1 minute'`,
      [account.id, purpose],
    );
    if (recente) return false;
    await tx.run("DELETE FROM token_conta WHERE conta_id = $1 AND proposito = $2", [account.id, purpose]);
    await tx.run(
      `INSERT INTO token_conta (token_hash, conta_id, proposito, versao_credencial, expira_em)
       VALUES ($1, $2, $3, $4, now() + ($5 || ' minutes')::interval)`,
      [hash, account.id, purpose, account.credentialVersion ?? 0, minutos],
    );
    return true;
  });
  if (!emitido) return;

  const resetting = purpose === "reset_password";
  const url = `${config.origin}/#account/${resetting ? "reset-password" : "verify-email"}/${raw}`;
  mail.enqueue({
    to: account.email,
    subject: resetting ? "VitrineIC — Redefinir senha" : "VitrineIC — Confirmar e-mail",
    text: `${resetting ? "Você solicitou a redefinição da sua senha." : "Confirme que este e-mail pertence a você."}\n\nAbra o link e confirme a operação:\n${url}\n\nO link vale por ${resetting ? "30 minutos" : "24 horas"} e pode ser usado uma única vez.\nSe você não fez esta solicitação, ignore esta mensagem.`,
  }, async () => {
    await db.sql.run("DELETE FROM token_conta WHERE token_hash = $1", [hash]);
    onFailure();
  });
}

export const consumirToken = (db: Database, raw: string) =>
  db.sql.run("DELETE FROM token_conta WHERE token_hash = $1", [tokenHash(raw)]);
