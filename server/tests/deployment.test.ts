import { test } from "node:test";
import assert from "node:assert/strict";
import { Database } from "../database";
import { bootstrapCurator } from "../curator";
import { verifyPassword } from "../security";
import { readConfig } from "../config";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

test("Render usa origem pública automática, permite domínio próprio e preserva validação de produção", () => {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "production", RENDER: "true", RENDER_EXTERNAL_URL: "https://vitrineic-teste.onrender.com",
    MAIL_MODE: "disabled", REQUIRE_VERIFIED_EMAIL: "false",
  };
  assert.equal(readConfig(env).origin, "https://vitrineic-teste.onrender.com");
  env.APP_ORIGIN = "https://vitrine.example.com";
  assert.equal(readConfig(env).origin, "https://vitrine.example.com");
  env.APP_ORIGIN = "http://inseguro.example.com";
  assert.throws(() => readConfig(env), /HTTPS/);
  env.APP_ORIGIN = "";
  env.RENDER = "false";
  assert.throws(() => readConfig(env), /HTTPS/);
  env.APP_ORIGIN = "https://vitrine.example.com";
  env.REQUIRE_VERIFIED_EMAIL = "true";
  assert.throws(() => readConfig(env), /envio de e-mail/);
  env.MAIL_MODE = "resend";
  assert.throws(() => readConfig(env), /RESEND_API_KEY/);
  env.RESEND_API_KEY = "chave-de-teste";
  env.MAIL_FROM = "vitrine@example.com";
  assert.equal(readConfig(env).mail.mode, "resend");
});

test("bootstrap cria somente curadoria, exige opt-in e nunca redefine credenciais existentes", async t => {
  const db = new Database(":memory:");
  t.after(() => db.close());
  const env = { CURATOR_EMAIL: "curadoria@example.com", CURATOR_NAME: "Curadoria", CURATOR_PASSWORD: "senha-teste-forte" };
  assert.equal(await bootstrapCurator(db, env), false);
  assert.equal(db.all("accounts").length, 0);
  assert.equal(await bootstrapCurator(db, { ...env, BOOTSTRAP_CURATOR: "true" }), true);
  const account = db.all("accounts")[0];
  assert.equal(account.role, "curator");
  assert.ok(await verifyPassword(env.CURATOR_PASSWORD, account.passwordHash));
  assert.equal(account.emailVerifiedAt, undefined);
  assert.equal(await bootstrapCurator(db, { ...env, BOOTSTRAP_CURATOR: "true", CURATOR_PASSWORD: "outra-senha-forte" }), false);
  assert.equal(db.all("accounts")[0].passwordHash, account.passwordHash);
  db.sql.prepare("UPDATE accounts SET data=json_set(data,'$.role','student') WHERE id=?").run(account.id);
  await assert.rejects(() => bootstrapCurator(db, { ...env, BOOTSTRAP_CURATOR: "true" }), /já está cadastrado/);
  assert.equal(db.all("accounts")[0].role, "student");
  await assert.rejects(() => bootstrapCurator(db, { BOOTSTRAP_CURATOR: "true" }));
});

test("backup produz snapshot com WAL e BLOBs e não substitui banco existente", t => {
  const directory = mkdtempSync(join(tmpdir(), "vitrine-backup-"));
  const source = join(directory, "original.sqlite");
  const destination = join(directory, "snapshot.sqlite");
  const db = new DatabaseSync(source);
  t.after(() => {
    db.close();
    assert.equal(dirname(directory), tmpdir());
    rmSync(directory, { recursive: true, force: true });
  });
  db.exec("PRAGMA journal_mode=WAL; CREATE TABLE files(id INTEGER PRIMARY KEY, content BLOB);");
  const content = Buffer.from("conteúdo de um anexo");
  db.prepare("INSERT INTO files(content) VALUES(?)").run(content);
  const run = (target: string) => spawnSync(process.execPath, [resolve("scripts/backup-database.mjs")], {
    env: { ...process.env, DATABASE_PATH: source, BACKUP_PATH: target }, encoding: "utf8",
  });
  const result = run(destination);
  assert.equal(result.status, 0, result.stderr);
  db.prepare("INSERT INTO files(content) VALUES(?)").run(Buffer.from("posterior"));
  const restored = new DatabaseSync(destination, { readOnly: true });
  try {
    assert.deepEqual(Buffer.from(restored.prepare("SELECT content FROM files").get()!.content as Uint8Array), content);
    assert.equal(restored.prepare("SELECT count(*) AS total FROM files").get()!.total, 1);
  } finally { restored.close(); }
  assert.notEqual(run(destination).status, 0);
  assert.notEqual(run(source).status, 0);
  assert.equal(db.prepare("SELECT count(*) AS total FROM files").get()!.total, 2);
});
