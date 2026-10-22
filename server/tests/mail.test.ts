import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createMailer } from "../mail";
import { readConfig } from "../config";

test("transporte local grava mensagem sem rede e não usa o assunto como caminho", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vitrine-mail-"));
  try {
    const mailer = createMailer({ ...readConfig().mail, mode: "file", directory, from: "vitrine@example.com" });
    await mailer.send({ to: "student@example.com", subject: "../confirmar", text: "Confirme seu endereço usando o link recebido." });
    const files = await readdir(directory);
    assert.equal(files.length, 1);
    assert.match(files[0], /^\d+-[a-f0-9-]+\.eml$/);
    const message = await readFile(join(directory, files[0]), "utf8");
    assert.match(message, /To: student@example.com/);
    assert.match(message, /From: vitrine@example.com/);
    assert.match(message, /Subject: \.\.\/confirmar/);
    assert.match(message, /Content-Type: text\/plain/);
  } finally {
    assert.equal(dirname(directory), tmpdir());
    await rm(directory, { recursive: true, force: true });
  }
});

test("transporte HTTPS envia mensagem e trata rejeição sem expor conteúdo ou credenciais", async () => {
  const config = { ...readConfig().mail, mode: "resend" as const, apiKey: "segredo-de-teste", from: "vitrine@example.com" };
  const message = { to: "student@example.com", subject: "Confirmação", text: "link-privado" };
  let calls = 0;
  const request: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(url, "https://api.resend.com/emails");
    assert.equal(init?.method, "POST");
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal instanceof AbortSignal);
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer segredo-de-teste");
    assert.deepEqual(JSON.parse(String(init?.body)), { ...message, from: config.from, to: [message.to] });
    return calls === 1 ? new Response('{"id":"email-teste"}') : new Response("link-privado segredo-de-teste", { status: 429 });
  };
  const mailer = createMailer(config, request);
  await mailer.send(message);
  await assert.rejects(() => mailer.send(message), error => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /429/);
    assert.ok(!error.message.includes("link-privado"));
    assert.ok(!error.message.includes(config.apiKey));
    return true;
  });
  await assert.rejects(() => createMailer(config, async () => { throw new Error("falha de rede"); }).send(message));
});
