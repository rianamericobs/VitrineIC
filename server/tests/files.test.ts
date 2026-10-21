import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../app";
import { hashPassword, tokenHash } from "../security";

const headers = { "x-vitrine-client": "web", origin: "http://localhost:5173" };

test("anexos privados: upload, formato, isolamento, download e exclusão", async t => {
  const { app, db } = await buildApp({ databasePath: ":memory:", logger: false });
  t.after(() => app.close());
  const signup = await app.inject({ method: "POST", url: "/api/auth/students", headers, payload: { name: "Aluno", email: "files@ic.ufal.br", password: "teste12345", unit: "IC", course: "Ciência da Computação", consent: true } });
  const cookie = String(signup.headers["set-cookie"]).split(";")[0];
  const boundary = "vitrine-test-boundary";
  const payload = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="certificado.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.4\narquivo de teste\r\n--${boundary}--\r\n`);
  const uploaded = await app.inject({ method: "POST", url: "/api/attachments/tech", headers: { ...headers, cookie, "content-type": `multipart/form-data; boundary=${boundary}` }, payload });
  assert.equal(uploaded.statusCode, 201, uploaded.body);
  const id = uploaded.json().attachments[0].id;
  const download = await app.inject({ url: `/api/attachments/${id}`, headers: { cookie } });
  assert.equal(download.statusCode, 200);
  assert.match(String(download.headers["content-disposition"]), /attachment/);
  assert.match(download.body, /%PDF-1.4/);
  assert.equal((await app.inject({ url: `/api/attachments/${id}` })).statusCode, 401);
  const other = await app.inject({ method: "POST", url: "/api/auth/students", headers, payload: { name: "Outro", email: "other@ic.ufal.br", password: "teste12345", unit: "IC", course: "Ciência da Computação", consent: true } });
  const otherCookie = String(other.headers["set-cookie"]).split(";")[0];
  assert.equal((await app.inject({ url: `/api/attachments/${id}`, headers: { cookie: otherCookie } })).statusCode, 403);
  assert.equal((await app.inject({ method: "DELETE", url: `/api/attachments/${id}`, headers: { ...headers, cookie: otherCookie } })).statusCode, 404);
  const invalid = Buffer.from(payload.toString().replace("%PDF-1.4", "not-a-pdf"));
  assert.equal((await app.inject({ method: "POST", url: "/api/attachments/tech", headers: { ...headers, cookie, "content-type": `multipart/form-data; boundary=${boundary}` }, payload: invalid })).statusCode, 400);
  const removed = await app.inject({ method: "DELETE", url: `/api/attachments/${id}`, headers: { ...headers, cookie } });
  assert.equal(removed.statusCode, 200);
  assert.equal(removed.json().attachments.length, 0);
});

test("cookies Secure em produção, expiração e rotação de sessão", async t => {
  const { app, db } = await buildApp({ databasePath: ":memory:", logger: false, production: true, origin: "https://vitrine.example" });
  t.after(() => app.close());
  db.put("accounts", { id: "curator", name: "Curadoria", role: "curator", profileId: "", createdAt: "2026-01-01", email: "curator@example.com", passwordHash: await hashPassword("curator12345") });
  const login = (cookie?: string) => app.inject({ method: "POST", url: "/api/auth/login", headers: { ...headers, origin: "https://vitrine.example", ...(cookie ? { cookie } : {}) }, payload: { email: "curator@example.com", password: "curator12345" } });
  const first = await login();
  assert.match(String(first.headers["set-cookie"]), /; Secure/);
  const firstCookie = String(first.headers["set-cookie"]).split(";")[0];
  const second = await login(firstCookie);
  const secondCookie = String(second.headers["set-cookie"]).split(";")[0];
  assert.notEqual(firstCookie, secondCookie);
  assert.equal((await app.inject({ url: "/api/auth/me", headers: { cookie: firstCookie } })).statusCode, 401);
  const rawToken = secondCookie.split("=")[1];
  assert.equal(db.sql.prepare("SELECT token_hash FROM sessions").get()!.token_hash, tokenHash(rawToken));
  db.sql.prepare("UPDATE sessions SET expires_at=0").run();
  assert.equal((await app.inject({ url: "/api/auth/me", headers: { cookie: secondCookie } })).statusCode, 401);
});
