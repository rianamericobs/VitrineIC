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
