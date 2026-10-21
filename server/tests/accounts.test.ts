import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { FastifyInstance, InjectOptions } from "fastify";
import { buildApp } from "../app";
import { readConfig } from "../config";
import type { MailMessage } from "../mail";
import type { VitrineState } from "@/types/api";
import { tokenHash, verifyPassword } from "../security";
import { RECOVERY_MESSAGE } from "../account-tokens";

const headers = { "x-vitrine-client": "web", origin: "http://localhost:5173" };
const student = { name: "Estudante de teste", email: "conta@ic.ufal.br", password: "teste12345", unit: "IC", course: "Ciência da Computação", consent: true };
const call = (app: FastifyInstance, method: InjectOptions["method"], url: string, payload?: object, cookie?: string) => app.inject({ method, url, payload, headers: { ...headers, ...(cookie ? { cookie } : {}) } });
const cookieOf = (response: { headers: Record<string, unknown> }) => String(response.headers["set-cookie"]).split(";")[0];
const tokenOf = (message: MailMessage, action: string) => {
  const token = message.text.match(new RegExp(`#account/${action}/([A-Za-z0-9_-]{43})`))?.[1];
  assert.ok(token, message.text);
  return token;
};
const project = { title: "Projeto", description: "Uma descrição", stack: ["React"], status: "coding", year: "2026", area: "Software" };

async function setup(required = false) {
  const messages: MailMessage[] = [];
  const c = await buildApp({ databasePath: ":memory:", logger: false, production: false, requireVerifiedEmail: required, mail: { ...readConfig().mail, mode: "file" } }, { mailer: { async send(message) { messages.push(message); } } });
  const signup = await call(c.app, "POST", "/api/auth/students", student);
  assert.equal(signup.statusCode, 201, signup.body);
  await c.mail.drain();
  const cookie = cookieOf(signup);
  const account = signup.json<VitrineState>().accounts[0];
  return { ...c, messages, cookie, account, studentId: account.profileId };
}

test("confirmação de e-mail: posse, privacidade, consumo único e publicação", async t => {
  const c = await setup(true); t.after(() => c.app.close());
  assert.equal(c.messages.length, 1);
  const token = tokenOf(c.messages[0], "verify-email");
  const stored = c.db.sql.prepare("SELECT token_hash FROM account_tokens").get()!;
  assert.equal(stored.token_hash, tokenHash(token));
  assert.ok(!JSON.stringify(stored).includes(token));
  await call(c.app, "PATCH", `/api/students/${c.studentId}`, { skills: ["React"] }, c.cookie);
  assert.equal((await call(c.app, "GET", "/api/state")).json<VitrineState>().students.length, 0);
  assert.equal((await call(c.app, "POST", "/api/projects", project, c.cookie)).statusCode, 403);
  assert.equal((await call(c.app, "POST", "/api/auth/verification-email")).statusCode, 401);
  const state = (await call(c.app, "GET", "/api/state", undefined, c.cookie)).body;
  assert.ok(!state.includes(token));
  assert.ok(!state.includes("credentialVersion"));
  const verified = await call(c.app, "POST", "/api/auth/verify-email", { token }, c.cookie);
  assert.equal(verified.statusCode, 200, verified.body);
  assert.ok(verified.json().state.accounts[0].emailVerifiedAt);
  assert.equal((await call(c.app, "POST", "/api/auth/verify-email", { token }, c.cookie)).statusCode, 400);
  assert.equal((await call(c.app, "GET", "/api/state")).json<VitrineState>().students.length, 1);
  assert.equal((await call(c.app, "POST", "/api/projects", project, c.cookie)).statusCode, 201);
  await call(c.app, "POST", "/api/auth/verification-email", undefined, c.cookie);
  await c.mail.drain();
  assert.equal(c.messages.length, 1);
});

test("recuperação: resposta genérica, expiração, senha nova e encerramento de sessões", async t => {
  const c = await setup(); t.after(() => c.app.close());
  c.messages.length = 0;
  const missing = await call(c.app, "POST", "/api/auth/forgot-password", { email: "inexistente@example.com" });
  const existing = await call(c.app, "POST", "/api/auth/forgot-password", { email: student.email });
  assert.equal(missing.statusCode, 202);
  assert.equal(existing.statusCode, 202);
  assert.deepEqual(missing.json(), existing.json());
  assert.equal(existing.json().message, RECOVERY_MESSAGE);
  await c.mail.drain();
  assert.equal(c.messages.length, 1);
  const first = tokenOf(c.messages[0], "reset-password");
  assert.equal((await call(c.app, "POST", "/api/auth/reset-password", { token: first, password: "curta" })).statusCode, 400);
  c.db.sql.prepare("UPDATE account_tokens SET expires_at=0 WHERE purpose='reset_password'").run();
  assert.equal((await call(c.app, "POST", "/api/auth/reset-password", { token: first, password: "nova123456" })).statusCode, 400);
  await call(c.app, "POST", "/api/auth/forgot-password", { email: student.email }); await c.mail.drain();
  const second = tokenOf(c.messages[1], "reset-password");
  assert.notEqual(first, second);
  const reset = await call(c.app, "POST", "/api/auth/reset-password", { token: second, password: "nova123456" }, c.cookie);
  assert.equal(reset.statusCode, 200, reset.body);
  assert.equal(reset.json().state.session, null);
  assert.equal((await call(c.app, "GET", "/api/auth/me", undefined, c.cookie)).statusCode, 401);
  assert.equal((await call(c.app, "POST", "/api/auth/reset-password", { token: second, password: "outra123456" })).statusCode, 400);
  assert.equal((await call(c.app, "POST", "/api/auth/login", { email: student.email, password: student.password })).statusCode, 401);
  const login = await call(c.app, "POST", "/api/auth/login", { email: student.email, password: "nova123456" });
  assert.equal(login.statusCode, 200, login.body);
  assert.ok(login.json<VitrineState>().accounts[0].emailVerifiedAt);
  assert.ok(!login.body.includes("credentialVersion"));
});

test("troca de senha exige senha atual, preserva a sessão atual e invalida sessões e links anteriores", async t => {
  const c = await setup(); t.after(() => c.app.close());
  const another = await call(c.app, "POST", "/api/auth/login", { email: student.email, password: student.password });
  const otherCookie = cookieOf(another);
  await call(c.app, "POST", "/api/auth/forgot-password", { email: student.email }); await c.mail.drain();
  const oldReset = tokenOf(c.messages.find(m => m.subject.includes("Redefinir"))!, "reset-password");
  const oldVerification = tokenOf(c.messages[0], "verify-email");
  assert.equal((await call(c.app, "POST", "/api/auth/change-password", { currentPassword: "errada", password: "alterada123" }, c.cookie)).statusCode, 400);
  const changed = await call(c.app, "POST", "/api/auth/change-password", { currentPassword: student.password, password: "alterada123" }, c.cookie);
  assert.equal(changed.statusCode, 200, changed.body);
  assert.ok(changed.json<VitrineState>().session);
  const currentCookie = cookieOf(changed);
  assert.notEqual(currentCookie, c.cookie);
  assert.equal((await call(c.app, "GET", "/api/auth/me", undefined, currentCookie)).statusCode, 200);
  assert.equal((await call(c.app, "GET", "/api/auth/me", undefined, otherCookie)).statusCode, 401);
  assert.equal((await call(c.app, "GET", "/api/auth/me", undefined, c.cookie)).statusCode, 401);
  assert.equal((await call(c.app, "POST", "/api/auth/reset-password", { token: oldReset, password: "ataque12345" })).statusCode, 400);
  assert.equal((await call(c.app, "POST", "/api/auth/verify-email", { token: oldVerification })).statusCode, 400);
  assert.ok(await verifyPassword("alterada123", c.db.get("accounts", c.account.id)!.passwordHash));
  assert.equal((await call(c.app, "POST", "/api/auth/logout-all", undefined, currentCookie)).statusCode, 200);
  assert.equal((await call(c.app, "GET", "/api/auth/me", undefined, currentCookie)).statusCode, 401);
});

test("recuperação concorrente consome token uma única vez e não encerra outra conta no navegador", async t => {
  const c = await setup(); t.after(() => c.app.close());
  await call(c.app, "POST", "/api/auth/forgot-password", { email: student.email }); await c.mail.drain();
  const token = tokenOf(c.messages.find(m => m.subject.includes("Redefinir"))!, "reset-password");
  const another = await call(c.app, "POST", "/api/auth/students", { ...student, email: "outra@ic.ufal.br" });
  const anotherCookie = cookieOf(another);
  const responses = await Promise.all([
    call(c.app, "POST", "/api/auth/reset-password", { token, password: "primeira12345" }, anotherCookie),
    call(c.app, "POST", "/api/auth/reset-password", { token, password: "segunda12345" }, anotherCookie),
  ]);
  assert.deepEqual(responses.map(r => r.statusCode).sort(), [200, 400]);
  assert.equal((await call(c.app, "GET", "/api/auth/me", undefined, anotherCookie)).statusCode, 200);
});

test("reenvio tem intervalo, link substituído expira e falha de envio permite nova tentativa", async t => {
  const messages: MailMessage[] = [];
  let fail = true;
  const c = await buildApp({ databasePath: ":memory:", logger: false, mail: { ...readConfig().mail, mode: "file" } }, { mailer: { async send(message) { if (fail) throw new Error("Falha simulada"); messages.push(message); } } });
  t.after(() => c.app.close());
  const signup = await call(c.app, "POST", "/api/auth/students", student);
  const cookie = cookieOf(signup);
  await c.mail.drain();
  assert.equal(c.db.sql.prepare("SELECT count(*) AS n FROM account_tokens").get()!.n, 0);
  fail = false;
  await call(c.app, "POST", "/api/auth/verification-email", undefined, cookie); await c.mail.drain();
  assert.equal(messages.length, 1);
  const original = tokenOf(messages[0], "verify-email");
  await call(c.app, "POST", "/api/auth/verification-email", undefined, cookie); await c.mail.drain();
  assert.equal(messages.length, 1);
  c.db.sql.prepare("UPDATE account_tokens SET created_at=0").run();
  await call(c.app, "POST", "/api/auth/verification-email", undefined, cookie); await c.mail.drain();
  assert.equal(messages.length, 2);
  assert.equal((await call(c.app, "POST", "/api/auth/verify-email", { token: original })).statusCode, 400);
  c.db.sql.prepare("UPDATE account_tokens SET expires_at=0").run();
  assert.equal((await call(c.app, "POST", "/api/auth/verify-email", { token: tokenOf(messages[1], "verify-email") })).statusCode, 400);
});

test("limites persistem por conta entre sessões e endpoints exigem CSRF", async t => {
  const c = await setup(); t.after(() => c.app.close());
  assert.equal((await c.app.inject({ method: "POST", url: "/api/auth/forgot-password", payload: { email: student.email } })).statusCode, 403);
  for (let n = 0; n < 5; n++) assert.equal((await call(c.app, "POST", "/api/auth/forgot-password", { email: student.email })).statusCode, 202);
  await c.mail.drain();
  assert.equal(c.messages.filter(m => m.subject.includes("Redefinir")).length, 1);
  assert.equal((await call(c.app, "POST", "/api/auth/forgot-password", { email: student.email })).statusCode, 429);
});

test("migração versão 1 preserva contas e dados existentes", async t => {
  const folder = mkdtempSync(join(tmpdir(), "vitrine-migration-"));
  const path = join(folder, "db.sqlite");
  const old = await buildApp({ databasePath: path, logger: false });
  const signup = await call(old.app, "POST", "/api/auth/students", student);
  const id = signup.json<VitrineState>().accounts[0].id;
  old.db.sql.exec("DROP TABLE account_tokens; DELETE FROM migrations WHERE version=2;");
  await old.app.close();
  const reopened = await buildApp({ databasePath: path, logger: false });
  t.after(async () => { await reopened.app.close(); assert.equal(dirname(folder), tmpdir()); rmSync(folder, { recursive: true, force: true }); });
  assert.equal(reopened.db.get("accounts", id)!.email, student.email);
  assert.deepEqual(reopened.db.sql.prepare("SELECT version FROM migrations ORDER BY version").all().map(r => r.version), [1, 2]);
  assert.equal(reopened.db.sql.prepare("SELECT count(*) AS n FROM account_tokens").get()!.n, 0);
});
