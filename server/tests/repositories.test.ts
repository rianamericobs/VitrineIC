/**
 * Insere um recorte representativo e lê de volta pelos repositórios,
 * conferindo se o mapeamento 3FN -> tipos do domínio bate. Desfaz tudo no fim.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readConfig } from "../config";
import { Database } from "../db/pool";
import { contas, demandas, estudantes, interesses, solicitantes } from "../db/repositories";

/**
 * Roda contra o PostgreSQL de desenvolvimento (`pnpm db:init && pnpm db:migrate`).
 * Tudo acontece numa transação que é desfeita no fim: o banco fica intacto.
 */
test("mapeamento 3FN para os tipos do domínio", async t => {
  const db = new Database(readConfig().databaseUrl);
  t.after(() => db.close());
  await assert.rejects(() => db.transaction(async sql => {
    await sql.run(`INSERT INTO conta (id,email,nome,papel,senha_hash,email_confirmado_em) VALUES
      ('ACC-001','aluno@ic.ufal.br','Rafael Souza','student','hash:1', now()),
      ('ACC-002','contato@techbr.com.br','Carlos Menezes','requester','hash:2', null)`);

    await sql.run(`INSERT INTO estudante (id,conta_id,curso_id,semestre,cra,bio,github,disponibilidade,em_projeto,onboarding_em)
      VALUES ('S001','ACC-001',(SELECT id FROM curso WHERE nome='Ciência da Computação'),'5',8.70,'Bio do Rafael','rafa','20h/semana',true,'2026-03-10')`);

    await sql.run(`INSERT INTO estudante_competencia (estudante_id,competencia_id,nivel)
      SELECT 'S001', id, 3 FROM competencia WHERE nome_canonico='React'`);
    await sql.run(`INSERT INTO estudante_competencia (estudante_id,competencia_id,nivel)
      SELECT 'S001', id, 4 FROM competencia WHERE nome_canonico='Python'`);
    await sql.run(`INSERT INTO estudante_idioma (estudante_id,idioma_id,nivel)
      SELECT 'S001', id, 3 FROM idioma WHERE nome='Inglês'`);
    await sql.run(`INSERT INTO topico_interesse (nome) VALUES ('Visão computacional') ON CONFLICT DO NOTHING`);
    await sql.run(`INSERT INTO estudante_topico (estudante_id,topico_id)
      SELECT 'S001', id FROM topico_interesse WHERE nome='Visão computacional'`);

    await sql.run(`INSERT INTO projeto_estudante (id,estudante_id,titulo,descricao,situacao,ano,area_id)
      VALUES ('PRJ-1','S001','Detector','Descrição do projeto','done','2026',
              (SELECT id FROM area WHERE nome='Inteligência Artificial / ML'))`);
    await sql.run(`INSERT INTO projeto_competencia (projeto_id,competencia_id)
      SELECT 'PRJ-1', id FROM competencia WHERE nome_canonico='Python'`);

    await sql.run(`INSERT INTO solicitante (id,conta_id,nome,tipo_codigo,rotulo_exibicao,cidade,desde,site,descricao)
      VALUES ('SOL-1','ACC-002','TechBr Soluções','empresa','Empresa de Tecnologia','Maceió, AL','2024','techbr.com.br','Descrição')`);

    await sql.run(`INSERT INTO demanda (id,solicitante_id,titulo,descricao,area_id,escopo_id,prazo,status,prioridade)
      VALUES ('VIC-2026-0046','SOL-1','Sistema IoT','Monitorar fábricas',
              (SELECT id FROM area WHERE nome='Sistemas Web / Mobile'),
              (SELECT id FROM escopo_demanda WHERE rotulo LIKE 'Médio%'),
              '2026-11-30','aprovada','normal')`);
    await sql.run(`INSERT INTO demanda_competencia (demanda_id,competencia_id)
      SELECT 'VIC-2026-0046', id FROM competencia WHERE nome_canonico IN ('React','Python')`);

    await sql.run(`INSERT INTO interesse (id,demanda_id,estudante_id,origem,status,criado_por_conta_id)
      VALUES ('INT-1','VIC-2026-0046','S001','candidatura','recusado_solicitante','ACC-001')`);
    await sql.run(`INSERT INTO interesse_resposta (interesse_id,lado,aceito,motivo_recusa)
      VALUES ('INT-1','solicitante',false,'Perfil não bate com o escopo')`);

    // ── Leitura pelos repositórios ──────────────────────────────────────────
    const aluno = (await estudantes.porId(sql, "S001"))!;
    assert.equal(aluno.name, "Rafael Souza");
    assert.equal(aluno.email, "aluno@ic.ufal.br");
    assert.equal(aluno.unit, "IC", "unidade vem pelo curso, não está duplicada no estudante");
    assert.equal(aluno.course, "Ciência da Computação");
    assert.equal(aluno.gpa, "8.70");
    assert.deepEqual(aluno.skills, ["Python", "React"]);
    assert.deepEqual(aluno.skillLevels, { Python: 4, React: 3 });
    assert.deepEqual(aluno.languages, [{ name: "Inglês", level: 3 }]);
    assert.deepEqual(aluno.interests, ["Visão computacional"]);
    assert.equal(aluno.inProject, true);
    assert.equal(aluno.onboardedAt, "2026-03-10");
    assert.equal(aluno.projects.length, 1);
    assert.equal(aluno.projects[0].title, "Detector");
    assert.deepEqual(aluno.projects[0].stack, ["Python"]);
    assert.equal(aluno.projects[0].area, "Inteligência Artificial / ML");
    assert.equal(aluno.projects[0].status, "done");

    const empresa = (await solicitantes.porNome(sql, "TechBr Soluções"))!;
    assert.equal(empresa.kind, "empresa");
    assert.equal(empresa.type, "Empresa de Tecnologia");
    assert.equal(empresa.contactName, "Carlos Menezes");
    assert.equal(empresa.contactEmail, "contato@techbr.com.br");

    const demanda = (await demandas.porId(sql, "VIC-2026-0046"))!;
    assert.equal(demanda.company, "TechBr Soluções", "a demanda aponta para o nome do solicitante");
    assert.equal(demanda.deadline, "2026-11-30");
    assert.equal(demanda.area, "Sistemas Web / Mobile");
    assert.match(demanda.scope, /^Médio/);
    assert.deepEqual(demanda.skills, ["Python", "React"]);

    const interesse = (await interesses.porId(sql, "INT-1"))!;
    assert.equal(interesse.origin, "candidatura");
    assert.equal(interesse.refusalReason, "Perfil não bate com o escopo", "motivo vem de interesse_resposta");
    assert.equal(await interesses.ativoDoPar(sql, "VIC-2026-0046", "S001"), undefined, "recusado não conta como ativo");
    assert.equal(await interesses.existeAtivoNaDemanda(sql, "VIC-2026-0046"), false);
    assert.equal(await interesses.existeNaDemanda(sql, "VIC-2026-0046"), true);

    const conta = (await contas.doEstudante(sql, "S001"))!;
    assert.equal(conta.id, "ACC-001");
    assert.equal(conta.role, "student");
    assert.equal(conta.profileId, "S001");
    assert.equal(conta.passwordHash, "hash:1");
    assert.ok(conta.emailVerifiedAt, "confirmação de e-mail preservada");
    assert.equal((contas.publica(conta) as unknown as Record<string, unknown>).passwordHash, undefined, "hash nunca sai pela API");

    const doSolicitante = (await contas.doSolicitante(sql, "TechBr Soluções"))!;
    assert.equal(doSolicitante.profileId, "TechBr Soluções", "profileId do solicitante é o nome da organização");
    assert.equal(doSolicitante.emailVerifiedAt, undefined, "sem confirmação vira campo ausente, não null");

    assert.equal((await estudantes.visiveis(sql)).length, 1, "perfil com competência aparece na vitrine");
    await sql.run("DELETE FROM estudante_competencia WHERE estudante_id='S001'");
    assert.equal((await estudantes.visiveis(sql)).length, 0, "perfil sem competência some da vitrine");

    throw new Error("ROLLBACK_PROPOSITAL");
  }), /ROLLBACK_PROPOSITAL/);

  // O rollback precisa ter valido: nada sobrou.
  assert.equal(await contas.porId(db.sql, "ACC-001"), undefined);
});
