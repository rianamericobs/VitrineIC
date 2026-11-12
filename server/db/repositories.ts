import type { Sql } from "./pool";
import type { Account, Demand, Interest, Student } from "@/types";
import type { Company } from "@/data/companies";
import type { StoredAccount } from "./types";

/**
 * Traduz o esquema 3FN para os tipos do domínio, que são o contrato HTTP.
 *
 * Cada entidade sai numa consulta só: as coleções (competências, idiomas,
 * tópicos, projetos) vêm agregadas em JSON por subconsulta lateral, em vez de
 * uma consulta por linha. Nenhuma função aqui lê uma tabela inteira sem
 * necessidade — era esse o problema do acesso anterior.
 */

export const SQL_ESTUDANTE = `
  SELECT
    e.id,
    co.nome                                   AS name,
    COALESCE(co.email, '')                    AS email,
    COALESCE(un.codigo, '')                   AS unit,
    COALESCE(cu.nome, '')                     AS course,
    e.matricula,
    COALESCE(e.semestre, '')                  AS semester,
    COALESCE(e.cra::text, '')                 AS gpa,
    COALESCE(e.bio, '')                       AS bio,
    COALESCE(e.github, '')                    AS github,
    COALESCE(e.disponibilidade, '')           AS availability,
    e.linkedin, e.site, e.lattes, e.foto      AS photo,
    e.certificados,
    e.em_projeto                              AS "inProject",
    to_char(e.onboarding_em, 'YYYY-MM-DD')    AS "onboardedAt",
    e.onboarding_pulado                       AS "onboardingSkipped",
    COALESCE(top.lista, '[]'::json)           AS interests,
    COALESCE(comp.lista, '[]'::json)          AS skills,
    COALESCE(comp.niveis, '{}'::json)         AS "skillLevels",
    COALESCE(idi.lista, '[]'::json)           AS languages,
    COALESCE(prj.lista, '[]'::json)           AS projects
  FROM estudante e
  JOIN conta co                   ON co.id = e.conta_id
  LEFT JOIN curso cu              ON cu.id = e.curso_id
  LEFT JOIN unidade_academica un  ON un.codigo = cu.unidade_codigo
  LEFT JOIN LATERAL (
    SELECT json_agg(t.nome ORDER BY t.nome) AS lista
    FROM estudante_topico et JOIN topico_interesse t ON t.id = et.topico_id
    WHERE et.estudante_id = e.id
  ) top ON true
  LEFT JOIN LATERAL (
    SELECT json_agg(c.nome_canonico ORDER BY c.nome_canonico) AS lista,
           json_object_agg(c.nome_canonico, ec.nivel) FILTER (WHERE ec.nivel IS NOT NULL) AS niveis
    FROM estudante_competencia ec JOIN competencia c ON c.id = ec.competencia_id
    WHERE ec.estudante_id = e.id
  ) comp ON true
  LEFT JOIN LATERAL (
    SELECT json_agg(json_build_object('name', i.nome, 'level', ei.nivel) ORDER BY i.nome) AS lista
    FROM estudante_idioma ei JOIN idioma i ON i.id = ei.idioma_id
    WHERE ei.estudante_id = e.id
  ) idi ON true
  LEFT JOIN LATERAL (
    SELECT json_agg(json_build_object(
             'id', p.id, 'title', p.titulo, 'description', p.descricao,
             'status', p.situacao, 'year', p.ano,
             'area', COALESCE(a.nome, ''), 'link', p.link,
             'stack', COALESCE(st.lista, '[]'::json)
           ) ORDER BY p.criado_em DESC) AS lista
    FROM projeto_estudante p
    LEFT JOIN area a ON a.id = p.area_id
    LEFT JOIN LATERAL (
      SELECT json_agg(c.nome_canonico ORDER BY c.nome_canonico) AS lista
      FROM projeto_competencia pc JOIN competencia c ON c.id = pc.competencia_id
      WHERE pc.projeto_id = p.id
    ) st ON true
    WHERE p.estudante_id = e.id
  ) prj ON true
`;

export const SQL_DEMANDA = `
  SELECT
    d.id, d.titulo AS title, s.nome AS company,
    COALESCE(a.nome, '')  AS area,
    COALESCE(es.rotulo, '') AS scope,
    to_char(d.prazo, 'YYYY-MM-DD') AS deadline,
    d.descricao AS description,
    to_char(d.enviada_em, 'YYYY-MM-DD"T"HH24:MI:SS.MSZ') AS submitted,
    d.status, d.prioridade AS priority,
    d.publico_alvo AS audience, d.nivel_academico AS "academicLevel",
    d.observacoes AS notes, d.tamanho_equipe AS "teamSize", d.orcamento AS budget,
    COALESCE(sk.lista, '[]'::json) AS skills
  FROM demanda d
  JOIN solicitante s        ON s.id = d.solicitante_id
  LEFT JOIN area a          ON a.id = d.area_id
  LEFT JOIN escopo_demanda es ON es.id = d.escopo_id
  LEFT JOIN LATERAL (
    SELECT json_agg(c.nome_canonico ORDER BY c.nome_canonico) AS lista
    FROM demanda_competencia dc JOIN competencia c ON c.id = dc.competencia_id
    WHERE dc.demanda_id = d.id
  ) sk ON true
`;

export const SQL_INTERESSE = `
  SELECT
    i.id, i.demanda_id AS "demandId", i.estudante_id AS "studentId",
    i.origem AS origin, i.justificativa AS justification, i.status,
    to_char(i.criado_em, 'YYYY-MM-DD"T"HH24:MI:SS.MSZ') AS "createdAt",
    (SELECT r.motivo_recusa FROM interesse_resposta r
      WHERE r.interesse_id = i.id AND NOT r.aceito AND r.motivo_recusa IS NOT NULL
      ORDER BY r.respondido_em DESC LIMIT 1) AS "refusalReason"
  FROM interesse i
`;

const SOLICITANTE = `
  SELECT
    s.nome AS name, s.tipo_codigo AS kind,
    COALESCE(s.rotulo_exibicao, t.rotulo) AS type,
    co.nome AS "contactName", COALESCE(co.email, '') AS "contactEmail",
    COALESCE(s.cidade, '') AS city, COALESCE(s.desde, '') AS since,
    COALESCE(s.site, '') AS site, COALESCE(s.descricao, '') AS description
  FROM solicitante s
  JOIN tipo_solicitante t ON t.codigo = s.tipo_codigo
  LEFT JOIN conta co      ON co.id = s.conta_id
`;

const CONTA = `
  SELECT
    c.id, c.papel AS role, c.email, c.nome AS name,
    COALESCE(e.id, s.nome, '') AS "profileId",
    to_char(c.criada_em, 'YYYY-MM-DD"T"HH24:MI:SS.MSZ') AS "createdAt",
    to_char(c.email_confirmado_em, 'YYYY-MM-DD"T"HH24:MI:SS.MSZ') AS "emailVerifiedAt",
    c.senha_hash AS "passwordHash", c.versao_credencial AS "credentialVersion"
  FROM conta c
  LEFT JOIN estudante e   ON e.conta_id = c.id
  LEFT JOIN solicitante s ON s.conta_id = c.id
`;

/** O driver devolve `null` onde o tipo do domínio espera campo ausente. */
export function limpar<T extends object>(linha: T): T {
  for (const [chave, valor] of Object.entries(linha)) {
    if (valor === null) delete (linha as Record<string, unknown>)[chave];
  }
  return linha;
}

export const estudantes = {
  todos: async (sql: Sql) => (await sql.rows<Student>(`${SQL_ESTUDANTE} ORDER BY e.id`)).map(limpar),
  porId: async (sql: Sql, id: string) =>
    (await sql.rows<Student>(`${SQL_ESTUDANTE} WHERE e.id = $1`, [id])).map(limpar)[0],
  /** Só quem aparece na vitrine: perfil com ao menos uma competência. */
  visiveis: async (sql: Sql) =>
    (await sql.rows<Student>(
      `${SQL_ESTUDANTE} WHERE EXISTS (SELECT 1 FROM estudante_competencia ec WHERE ec.estudante_id = e.id) ORDER BY e.id`,
    )).map(limpar),
};

export const solicitantes = {
  todos: (sql: Sql) => sql.rows<Company>(`${SOLICITANTE} ORDER BY s.nome`),
  porNome: async (sql: Sql, nome: string) => (await sql.rows<Company>(`${SOLICITANTE} WHERE s.nome = $1`, [nome]))[0],
};

export const demandas = {
  todas: async (sql: Sql) => (await sql.rows<Demand>(`${SQL_DEMANDA} ORDER BY d.enviada_em DESC`)).map(limpar),
  porId: async (sql: Sql, id: string) => (await sql.rows<Demand>(`${SQL_DEMANDA} WHERE d.id = $1`, [id])).map(limpar)[0],
};

export const interesses = {
  todos: async (sql: Sql) => (await sql.rows<Interest>(`${SQL_INTERESSE} ORDER BY i.criado_em DESC`)).map(limpar),
  porId: async (sql: Sql, id: string) =>
    (await sql.rows<Interest>(`${SQL_INTERESSE} WHERE i.id = $1`, [id])).map(limpar)[0],
  /** Substitui a varredura que procurava o par ativo em memória. */
  ativoDoPar: async (sql: Sql, demandaId: string, estudanteId: string) =>
    (await sql.rows<Interest>(
      `${SQL_INTERESSE} WHERE i.demanda_id = $1 AND i.estudante_id = $2
         AND i.status NOT IN ('recusado_estudante','recusado_solicitante')`,
      [demandaId, estudanteId],
    )).map(limpar)[0],
  existeAtivoNaDemanda: async (sql: Sql, demandaId: string) =>
    !!(await sql.row(
      `SELECT 1 FROM interesse WHERE demanda_id = $1
         AND status NOT IN ('recusado_estudante','recusado_solicitante') LIMIT 1`,
      [demandaId],
    )),
  existeNaDemanda: async (sql: Sql, demandaId: string) =>
    !!(await sql.row("SELECT 1 FROM interesse WHERE demanda_id = $1 LIMIT 1", [demandaId])),
};

export const contas = {
  porId: async (sql: Sql, id: string) => (await sql.rows<StoredAccount>(`${CONTA} WHERE c.id = $1`, [id])).map(limpar)[0],
  porEmail: async (sql: Sql, email: string) =>
    (await sql.rows<StoredAccount>(`${CONTA} WHERE c.email = $1`, [email])).map(limpar)[0],
  /** Buscas que antes varriam a tabela inteira para achar o dono de um perfil. */
  doEstudante: async (sql: Sql, estudanteId: string) =>
    (await sql.rows<StoredAccount>(`${CONTA} WHERE e.id = $1`, [estudanteId])).map(limpar)[0],
  doSolicitante: async (sql: Sql, nome: string) =>
    (await sql.rows<StoredAccount>(`${CONTA} WHERE s.nome = $1`, [nome])).map(limpar)[0],
  publica: ({ passwordHash: _h, credentialVersion: _v, ...conta }: StoredAccount): Account => conta,
};
