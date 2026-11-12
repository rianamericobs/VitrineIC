import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Database } from "./db/pool";
import type { StoredAccount } from "./db/types";
import type { Config } from "./config";
import { contas } from "./db/repositories";
import { ensure } from "./errors";
import type { Role } from "@/types";

const COOKIE = "vitrine_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const derive = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key));
});

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${(await derive(password, salt)).toString("hex")}`;
}

export async function verifyPassword(password: string, hash: string) {
  const [, salt, expected] = hash.split(":");
  // Hash fora do formato nunca chega ao scrypt: viraria erro 500 em vez de senha errada.
  if (!salt || !expected) return false;
  const actual = await derive(password, salt);
  const bytes = Buffer.from(expected, "hex");
  return bytes.length === actual.length && timingSafeEqual(bytes, actual);
}

export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function accountFor(db: Database, request: FastifyRequest): Promise<StoredAccount | undefined> {
  const token = request.cookies[COOKIE];
  if (!token) return;
  const sessao = await db.sql.row<{ conta_id: string }>(
    "SELECT conta_id FROM sessao WHERE token_hash = $1 AND expira_em > now()", [tokenHash(token)]);
  return sessao ? contas.porId(db.sql, sessao.conta_id) : undefined;
}

export async function requireAccount(db: Database, request: FastifyRequest, role?: Role) {
  const account = await accountFor(db, request);
  ensure(account, 401, "Entre na sua conta para continuar.");
  ensure(!role || account.role === role, 403, "Seu perfil não tem permissão para esta ação.");
  return account;
}

export async function requireVerifiedAccount(db: Database, request: FastifyRequest, config: Config, role?: Role) {
  const account = await requireAccount(db, request, role);
  ensure(!config.requireVerifiedEmail || account.emailVerifiedAt, 403,
    "Confirme seu e-mail para continuar.");
  return account;
}

export async function clearSession(db: Database, request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies[COOKIE];
  if (token) await db.sql.run("DELETE FROM sessao WHERE token_hash = $1", [tokenHash(token)]);
  reply.clearCookie(COOKIE, { path: "/" });
}

export async function createSession(
  db: Database, config: Config, request: FastifyRequest, reply: FastifyReply, account: StoredAccount,
) {
  await clearSession(db, request, reply);
  await db.sql.run("DELETE FROM sessao WHERE expira_em <= now()");
  const token = randomBytes(32).toString("base64url");
  await db.sql.run(
    "INSERT INTO sessao (token_hash, conta_id, expira_em) VALUES ($1, $2, now() + ($3 || ' seconds')::interval)",
    [tokenHash(token), account.id, SESSION_SECONDS],
  );
  reply.setCookie(COOKIE, token, {
    httpOnly: true, secure: config.production, sameSite: "strict", path: "/", maxAge: SESSION_SECONDS,
  });
}

export const publicAccount = contas.publica;
