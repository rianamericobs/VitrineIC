import { test } from "node:test";
import assert from "node:assert/strict";
import { readConfig } from "../config";
import { Database } from "../db/pool";
import { snapshot } from "../db/snapshot";
import { contas } from "../db/repositories";

/**
 * Roda sobre a carga de demonstração (`pnpm db:migrate && pnpm db:seed`).
 * Só lê: nada aqui altera o banco.
 */
const config = { ...readConfig(), requireVerifiedEmail: false, demo: true };

test("snapshot filtra por conta e nunca vaza contato antes do aceite duplo", async t => {
  const db = new Database(config.databaseUrl);
  t.after(() => db.close());

  const anonimo = await snapshot(db.sql, config);
  assert.equal(anonimo.session, null);
  assert.deepEqual(anonimo.accounts, []);
  assert.deepEqual(anonimo.interests, []);
  assert.deepEqual(anonimo.notifications, []);
  assert.ok(anonimo.demands.length > 0, "a vitrine pública mostra demandas");
  assert.ok(
    anonimo.demands.every(d => d.status === "aprovada" || d.status === "contato_liberado"),
    "anônimo não vê demanda em triagem nem rejeitada",
  );
  assert.ok(anonimo.students.every(s => s.email === ""), "nenhum e-mail de estudante exposto");
  assert.ok(anonimo.companies.every(c => c.contactEmail === ""), "nenhum contato de empresa exposto");
  assert.ok(anonimo.students.every(s => s.matricula === undefined), "matrícula nunca sai");
  assert.ok(anonimo.impact.students > 0 && anonimo.impact.demands > 0, "indicadores agregados pelo banco");

  const estudante = (await contas.porEmail(db.sql, "estudante@ic.ufal.br"))!;
  const visaoEstudante = await snapshot(db.sql, config, estudante);
  assert.equal(visaoEstudante.session?.accountId, estudante.id);
  assert.equal(visaoEstudante.accounts.length, 1);
  assert.equal((visaoEstudante.accounts[0] as unknown as Record<string, unknown>).passwordHash, undefined);
  const proprio = visaoEstudante.students.find(s => s.id === estudante.profileId)!;
  assert.equal(proprio.email, "estudante@ic.ufal.br", "o estudante vê o próprio e-mail");
  assert.ok(visaoEstudante.interests.length > 0, "vê os próprios interesses");
  assert.ok(
    visaoEstudante.interests.every(i => i.studentId === estudante.profileId),
    "não vê interesse de outro estudante",
  );
  assert.ok(
    visaoEstudante.interests.every(i => i.refusalReason === undefined),
    "o motivo da recusa nunca chega ao estudante",
  );

  const solicitante = (await contas.porEmail(db.sql, "contato@techbr.com.br"))!;
  const visaoSolicitante = await snapshot(db.sql, config, solicitante);
  assert.ok(
    visaoSolicitante.demands.some(d => d.company === solicitante.profileId),
    "vê as próprias demandas",
  );
  assert.ok(
    visaoSolicitante.interests.every(i =>
      visaoSolicitante.demands.some(d => d.id === i.demandId && d.company === solicitante.profileId)),
    "só vê interesses das próprias demandas",
  );
  assert.ok(
    visaoSolicitante.interests.every(i => !(i.origin === "sugestao" && i.status === "aguardando_estudante")),
    "sugestão só aparece depois que o estudante responde",
  );
  const liberados = new Set(
    visaoSolicitante.interests.filter(i => i.status === "contato_liberado").map(i => i.studentId));
  for (const aluno of visaoSolicitante.students) {
    assert.equal(aluno.email === "" , !liberados.has(aluno.id),
      `e-mail de ${aluno.id} só com contato liberado`);
  }

  const curador = (await contas.porEmail(db.sql, "curadoria@ic.ufal.br"))!;
  const visaoCurador = await snapshot(db.sql, config, curador);
  assert.ok(
    visaoCurador.demands.some(d => d.status === "nova" || d.status === "em_analise"),
    "a curadoria vê a fila de triagem",
  );
  assert.ok(visaoCurador.interests.length >= visaoSolicitante.interests.length, "vê todos os interesses");
  assert.ok(
    visaoCurador.students.every(s => s.email === ""),
    "nem a curadoria recebe e-mail de estudante",
  );
});
