import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Database, StoredAccount } from "./database";
import type { Config } from "./config";
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
  const actual = await derive(password, salt);
  const bytes = Buffer.from(expected, "hex");
  return bytes.length === actual.length && timingSafeEqual(bytes, actual);
}

export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export function accountFor(db: Database, request: FastifyRequest): StoredAccount | undefined {
  const token = request.cookies[COOKIE];
  if (!token) return;
  const row = db.sql.prepare("SELECT account_id FROM sessions WHERE token_hash=? AND expires_at>?").get(tokenHash(token), Date.now());
  return row ? db.get("accounts", String(row.account_id)) : undefined;
}

export function requireAccount(db: Database, request: FastifyRequest, role?: Role) {
  const account = accountFor(db, request);
  ensure(account, 401, "Entre na sua conta para continuar.");
  ensure(!role || account.role === role, 403, "Seu perfil não tem permissão para esta ação.");
  return account;
}

export function clearSession(db: Database, request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies[COOKIE];
  if (token) db.sql.prepare("DELETE FROM sessions WHERE token_hash=?").run(tokenHash(token));
  reply.clearCookie(COOKIE, { path: "/" });
}

export function createSession(db: Database, config: Config, request: FastifyRequest, reply: FastifyReply, account: StoredAccount) {
  clearSession(db, request, reply);
  db.sql.prepare("DELETE FROM sessions WHERE expires_at<=?").run(Date.now());
  const token = randomBytes(32).toString("base64url");
  db.sql.prepare("INSERT INTO sessions(token_hash,account_id,expires_at) VALUES(?,?,?)")
    .run(tokenHash(token), account.id, Date.now() + SESSION_SECONDS * 1000);
  reply.setCookie(COOKIE, token, { httpOnly: true, secure: config.production, sameSite: "strict", path: "/", maxAge: SESSION_SECONDS });
}

export function publicAccount({ passwordHash: _hash, credentialVersion: _version, ...account }: StoredAccount) { return account; }

export function requireVerifiedAccount(db: Database, request: FastifyRequest, config: Config, role?: Role) {
  const account = requireAccount(db, request, role);
  ensure(!config.requireVerifiedEmail || account.emailVerifiedAt, 403, "Confirme seu e-mail para continuar.");
  return account;
}
