import type { Sql } from "./pool";
import type { Demand, Interest, InterestSide, Student, StudentProject } from "@/types";
import type { Company } from "@/data/companies";
import type { StoredAccount } from "./types";
import { paraISO, paraTimestamp } from "@/lib/datas";

/**
 * Escritas sobre o esquema 3FN.
 *
 * Catálogos: competência e tópico são abertos — o estudante pode declarar algo
 * fora da lista — então a linha é criada sob demanda, marcada como
 * `fora_do_catalogo`. Área e escopo seguem o mesmo caminho porque o texto
 * chega de formulário. Nada aqui apaga catálogo.
 */

async function idDe(sql: Sql, consulta: string, params: unknown[]) {
  return (await sql.row<{ id: string }>(consulta, params))!.id;
}

const garantirCompetencia = (sql: Sql, nome: string) => idDe(sql,
  `INSERT INTO competencia (nome_canonico, fora_do_catalogo) VALUES ($1, true)
   ON CONFLICT (nome_canonico) DO UPDATE SET nome_canonico = excluded.nome_canonico
   RETURNING id`, [nome]);

const garantirTopico = (sql: Sql, nome: string) => idDe(sql,
  `INSERT INTO topico_interesse (nome) VALUES ($1)
   ON CONFLICT (nome) DO UPDATE SET nome = excluded.nome RETURNING id`, [nome]);

const garantirIdioma = (sql: Sql, nome: string) => idDe(sql,
  `INSERT INTO idioma (nome) VALUES ($1)
   ON CONFLICT (nome) DO UPDATE SET nome = excluded.nome RETURNING id`, [nome]);

async function idDeArea(sql: Sql, nome?: string) {
  if (!nome?.trim()) return null;
  return idDe(sql, `INSERT INTO area (nome) VALUES ($1)
    ON CONFLICT (nome) DO UPDATE SET nome = excluded.nome RETURNING id`, [nome.trim()]);
}

async function idDeEscopo(sql: Sql, rotulo?: string) {
  if (!rotulo?.trim()) return null;
  return idDe(sql, `INSERT INTO escopo_demanda (rotulo) VALUES ($1)
    ON CONFLICT (rotulo) DO UPDATE SET rotulo = excluded.rotulo RETURNING id`, [rotulo.trim()]);
}

async function idDeCurso(sql: Sql, unidade: string, curso: string) {
  const linha = await sql.row<{ id: string }>(
    "SELECT id FROM curso WHERE unidade_codigo = $1 AND nome = $2", [unidade, curso]);
  return linha?.id ?? null;
}

const numeroOuNulo = (valor?: string) => {
  const n = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) && String(valor ?? "").trim() !== "" ? n : null;
};
const vazioOuNulo = (valor?: string) => (valor?.trim() ? valor : null);

export async function salvarConta(sql: Sql, conta: StoredAccount) {
  await sql.run(
    `INSERT INTO conta (id, email, nome, papel, senha_hash, versao_credencial, email_confirmado_em, criada_em)
     VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE($8::timestamptz, now()))
     ON CONFLICT (id) DO UPDATE SET
       email = excluded.email, nome = excluded.nome, papel = excluded.papel,
       senha_hash = excluded.senha_hash, versao_credencial = excluded.versao_credencial,
       email_confirmado_em = excluded.email_confirmado_em`,
    [conta.id, conta.email, conta.name, conta.role, conta.passwordHash,
     conta.credentialVersion ?? 0, conta.emailVerifiedAt ?? null, paraTimestamp(conta.createdAt) || null],
  );
}

/** Grava o perfil e repõe as coleções. O nome fica em `conta`, não aqui. */
export async function salvarEstudante(sql: Sql, estudante: Student, contaId: string) {
  await sql.run(
    `INSERT INTO estudante (id, conta_id, curso_id, matricula, semestre, cra, bio, github, linkedin,
       site, lattes, certificados, disponibilidade, em_projeto, foto, onboarding_em, onboarding_pulado)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::date,$17)
     ON CONFLICT (id) DO UPDATE SET
       conta_id = excluded.conta_id, curso_id = excluded.curso_id, matricula = excluded.matricula,
       semestre = excluded.semestre, cra = excluded.cra, bio = excluded.bio, github = excluded.github,
       linkedin = excluded.linkedin, site = excluded.site, lattes = excluded.lattes,
       certificados = excluded.certificados, disponibilidade = excluded.disponibilidade,
       em_projeto = excluded.em_projeto, foto = excluded.foto,
       onboarding_em = excluded.onboarding_em, onboarding_pulado = excluded.onboarding_pulado`,
    [estudante.id, contaId, await idDeCurso(sql, estudante.unit, estudante.course),
     vazioOuNulo(estudante.matricula), vazioOuNulo(estudante.semester), numeroOuNulo(estudante.gpa),
     vazioOuNulo(estudante.bio), vazioOuNulo(estudante.github), vazioOuNulo(estudante.linkedin),
     vazioOuNulo(estudante.site), vazioOuNulo(estudante.lattes), vazioOuNulo(estudante.certificados),
     vazioOuNulo(estudante.availability), !!estudante.inProject, vazioOuNulo(estudante.photo),
     vazioOuNulo(estudante.onboardedAt), !!estudante.onboardingSkipped],
  );

  await sql.run("DELETE FROM estudante_competencia WHERE estudante_id = $1", [estudante.id]);
  for (const nome of estudante.skills) {
    await sql.run(
      "INSERT INTO estudante_competencia (estudante_id, competencia_id, nivel) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
      [estudante.id, await garantirCompetencia(sql, nome), estudante.skillLevels?.[nome] ?? null],
    );
  }

  await sql.run("DELETE FROM estudante_idioma WHERE estudante_id = $1", [estudante.id]);
  for (const idioma of estudante.languages ?? []) {
    await sql.run(
      "INSERT INTO estudante_idioma (estudante_id, idioma_id, nivel) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
      [estudante.id, await garantirIdioma(sql, idioma.name), idioma.level],
    );
  }

  await sql.run("DELETE FROM estudante_topico WHERE estudante_id = $1", [estudante.id]);
  for (const topico of estudante.interests ?? []) {
    await sql.run(
      "INSERT INTO estudante_topico (estudante_id, topico_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [estudante.id, await garantirTopico(sql, topico)],
    );
  }
}

export async function salvarProjeto(sql: Sql, estudanteId: string, projeto: StudentProject) {
  await sql.run(
    `INSERT INTO projeto_estudante (id, estudante_id, titulo, descricao, situacao, ano, area_id, link)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (id) DO UPDATE SET
       titulo = excluded.titulo, descricao = excluded.descricao, situacao = excluded.situacao,
       ano = excluded.ano, area_id = excluded.area_id, link = excluded.link`,
    [projeto.id, estudanteId, projeto.title, projeto.description, projeto.status,
     projeto.year, await idDeArea(sql, projeto.area), vazioOuNulo(projeto.link)],
  );
  await sql.run("DELETE FROM projeto_competencia WHERE projeto_id = $1", [projeto.id]);
  for (const nome of projeto.stack ?? []) {
    await sql.run(
      "INSERT INTO projeto_competencia (projeto_id, competencia_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [projeto.id, await garantirCompetencia(sql, nome)],
    );
  }
}

export const apagarProjeto = (sql: Sql, id: string, estudanteId: string) =>
  sql.run("DELETE FROM projeto_estudante WHERE id = $1 AND estudante_id = $2", [id, estudanteId]);

export async function salvarSolicitante(sql: Sql, empresa: Company, contaId: string, id?: string) {
  await sql.run(
    `INSERT INTO solicitante (id, conta_id, nome, tipo_codigo, rotulo_exibicao, cidade, desde, site, descricao)
     VALUES (COALESCE($1, 'SOL-' || md5($3)), $2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (nome) DO UPDATE SET
       tipo_codigo = excluded.tipo_codigo, rotulo_exibicao = excluded.rotulo_exibicao,
       cidade = excluded.cidade, desde = excluded.desde, site = excluded.site,
       descricao = excluded.descricao`,
    [id ?? null, contaId, empresa.name, empresa.kind, vazioOuNulo(empresa.type),
     vazioOuNulo(empresa.city), vazioOuNulo(empresa.since), vazioOuNulo(empresa.site),
     vazioOuNulo(empresa.description)],
  );
}

export async function salvarDemanda(sql: Sql, demanda: Demand) {
  const solicitante = await sql.row<{ id: string }>("SELECT id FROM solicitante WHERE nome = $1", [demanda.company]);
  if (!solicitante) throw new Error(`Solicitante não encontrado: ${demanda.company}`);
  await sql.run(
    `INSERT INTO demanda (id, solicitante_id, titulo, descricao, area_id, escopo_id, prazo, status,
       prioridade, publico_alvo, nivel_academico, tamanho_equipe, orcamento, observacoes, enviada_em)
     VALUES ($1,$2,$3,$4,$5,$6,$7::date,$8,$9,$10,$11,$12,$13,$14, COALESCE($15::timestamptz, now()))
     ON CONFLICT (id) DO UPDATE SET
       titulo = excluded.titulo, descricao = excluded.descricao, area_id = excluded.area_id,
       escopo_id = excluded.escopo_id, prazo = excluded.prazo, status = excluded.status,
       prioridade = excluded.prioridade, publico_alvo = excluded.publico_alvo,
       nivel_academico = excluded.nivel_academico, tamanho_equipe = excluded.tamanho_equipe,
       orcamento = excluded.orcamento, observacoes = excluded.observacoes`,
    [demanda.id, solicitante.id, demanda.title, demanda.description,
     await idDeArea(sql, demanda.area), await idDeEscopo(sql, demanda.scope),
     paraISO(demanda.deadline) || null, demanda.status, demanda.priority, vazioOuNulo(demanda.audience),
     vazioOuNulo(demanda.academicLevel), vazioOuNulo(demanda.teamSize), vazioOuNulo(demanda.budget),
     vazioOuNulo(demanda.notes), paraISO(demanda.submitted) || null],
  );
  await sql.run("DELETE FROM demanda_competencia WHERE demanda_id = $1", [demanda.id]);
  for (const nome of demanda.skills ?? []) {
    await sql.run(
      "INSERT INTO demanda_competencia (demanda_id, competencia_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [demanda.id, await garantirCompetencia(sql, nome)],
    );
  }
}

export async function mudarStatusDaDemanda(
  sql: Sql, demandaId: string, status: string, porContaId?: string, observacao?: string,
) {
  await sql.run("UPDATE demanda SET status = $2 WHERE id = $1", [demandaId, status]);
  await sql.run(
    `INSERT INTO demanda_historico_status (demanda_id, status, alterado_por_conta_id, observacao)
     VALUES ($1,$2,$3,$4)`,
    [demandaId, status, porContaId ?? null, observacao ?? null],
  );
}

export const apagarDemanda = (sql: Sql, id: string) => sql.run("DELETE FROM demanda WHERE id = $1", [id]);

export async function salvarInteresse(sql: Sql, interesse: Interest, porContaId?: string) {
  await sql.run(
    `INSERT INTO interesse (id, demanda_id, estudante_id, origem, justificativa, status, criado_por_conta_id, criado_em)
     VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE($8::timestamptz, now()))
     ON CONFLICT (id) DO UPDATE SET status = excluded.status, justificativa = excluded.justificativa`,
    [interesse.id, interesse.demandId, interesse.studentId, interesse.origin,
     vazioOuNulo(interesse.justification), interesse.status, porContaId ?? null,
     paraTimestamp(interesse.createdAt) || null],
  );
}

/** O aceite de cada lado vira linha; o status do interesse é o estado corrente. */
export async function registrarResposta(
  sql: Sql, interesseId: string, lado: InterestSide, aceito: boolean, motivo?: string,
) {
  await sql.run(
    `INSERT INTO interesse_resposta (interesse_id, lado, aceito, motivo_recusa)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (interesse_id, lado) DO UPDATE SET
       aceito = excluded.aceito, motivo_recusa = excluded.motivo_recusa, respondido_em = now()`,
    [interesseId, lado, aceito, aceito ? null : (motivo ?? null)],
  );
}

export const mudarStatusDoInteresse = (sql: Sql, id: string, status: string) =>
  sql.run("UPDATE interesse SET status = $2 WHERE id = $1", [id, status]);

export async function criarMensagem(sql: Sql, interesseId: string, remetenteContaId: string, conteudo: string) {
  return idDe(sql,
    "INSERT INTO mensagem (interesse_id, remetente_conta_id, conteudo) VALUES ($1,$2,$3) RETURNING id",
    [interesseId, remetenteContaId, conteudo]);
}

export async function criarNotificacao(sql: Sql, dados: {
  destinatarioContaId: string; tipo: "SISTEMA" | "MENSAGEM";
  demandaId?: string; interesseId?: string; mensagemId?: string; conteudo?: string;
}) {
  await sql.run(
    `INSERT INTO notificacao (destinatario_conta_id, tipo, demanda_id, interesse_id, mensagem_id, conteudo)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [dados.destinatarioContaId, dados.tipo, dados.demandaId ?? null,
     dados.interesseId ?? null, dados.mensagemId ?? null, dados.conteudo ?? null],
  );
}

export const marcarNotificacaoLida = (sql: Sql, id: string, contaId: string) =>
  sql.run("UPDATE notificacao SET lida_em = now() WHERE id = $1 AND destinatario_conta_id = $2 AND lida_em IS NULL",
    [id, contaId]);

/** Substitui a varredura que reescrevia um documento por notificação não lida. */
export const marcarTodasLidas = (sql: Sql, contaId: string) =>
  sql.run("UPDATE notificacao SET lida_em = now() WHERE destinatario_conta_id = $1 AND lida_em IS NULL", [contaId]);
