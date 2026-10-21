import { randomBytes } from "node:crypto";
import type { Database, StoredAccount } from "./database";
import type { Config } from "./config";
import type { MailQueue } from "./mail";
import { tokenHash } from "./security";
import { ensure } from "./errors";

export type TokenPurpose = "reset_password" | "verify_email";
interface ActionToken { accountId: string; credentialVersion: number }
export const RECOVERY_MESSAGE = "Se houver uma conta com este e-mail, você receberá as instruções para redefinir a senha.";

export function readActionToken(db: Database, raw: string, purpose: TokenPurpose): ActionToken {
  const row = db.sql.prepare("SELECT account_id,credential_version FROM account_tokens WHERE token_hash=? AND purpose=? AND expires_at>?")
    .get(tokenHash(raw), purpose, Date.now());
  ensure(row, 400, "Link inválido ou expirado. Solicite um novo link.");
  const account = db.get("accounts", String(row.account_id));
  ensure(account && (account.credentialVersion ?? 0) === Number(row.credential_version), 400, "Link inválido ou expirado. Solicite um novo link.");
  return { accountId: account.id, credentialVersion: Number(row.credential_version) };
}

/** Somente hashes são persistidos. O link é entregue fora do ciclo HTTP. */
export function requestAccountMail(db: Database, config: Config, mail: MailQueue, account: StoredAccount, purpose: TokenPurpose, onFailure: () => void) {
  if (config.mail.mode === "disabled" || (purpose === "verify_email" && account.emailVerifiedAt)) return;
  const now = Date.now();
  const raw = randomBytes(32).toString("base64url");
  const hash = tokenHash(raw);
  const issued = db.transaction(() => {
    db.sql.prepare("DELETE FROM account_tokens WHERE expires_at<=?").run(now);
    const recent = db.sql.prepare("SELECT created_at FROM account_tokens WHERE account_id=? AND purpose=?").get(account.id, purpose);
    if (recent && Number(recent.created_at) > now - 60_000) return false;
    db.sql.prepare("DELETE FROM account_tokens WHERE account_id=? AND purpose=?").run(account.id, purpose);
    db.sql.prepare("INSERT INTO account_tokens(token_hash,account_id,purpose,credential_version,created_at,expires_at) VALUES(?,?,?,?,?,?)")
      .run(hash, account.id, purpose, account.credentialVersion ?? 0, now, now + (purpose === "reset_password" ? 30 * 60_000 : 24 * 60 * 60_000));
    return true;
  });
  if (!issued) return;
  const resetting = purpose === "reset_password";
  const url = `${config.origin}/#account/${resetting ? "reset-password" : "verify-email"}/${raw}`;
  mail.enqueue({
    to: account.email,
    subject: resetting ? "VitrineIC — Redefinir senha" : "VitrineIC — Confirmar e-mail",
    text: `${resetting ? "Você solicitou a redefinição da sua senha." : "Confirme que este e-mail pertence a você."}\n\nAbra o link e confirme a operação:\n${url}\n\nO link vale por ${resetting ? "30 minutos" : "24 horas"} e pode ser usado uma única vez.\nSe você não fez esta solicitação, ignore esta mensagem.`,
  }, () => {
    db.sql.prepare("DELETE FROM account_tokens WHERE token_hash=?").run(hash);
    onFailure();
  });
}
