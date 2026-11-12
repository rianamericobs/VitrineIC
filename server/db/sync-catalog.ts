import type { Sql } from "./pool";
import { UNITS } from "@/data/institution";
import { ALL_SKILLS, LEVELS } from "@/data/skills";
import { LANGUAGES, LANGUAGE_LEVELS } from "@/data/languages";
import { REQUESTER_KIND_LABEL } from "@/data/companies";
import { AREA_OPTIONS, SCOPE_OPTIONS } from "@/data/demand-options";

/**
 * Carrega os catálogos a partir de `src/data/`, que continua sendo a fonte
 * única (unidades, cursos, competências, idiomas, níveis, áreas, escopos).
 *
 * É idempotente: roda na subida do servidor e em toda migração. Só insere e
 * atualiza rótulos — nunca apaga, porque um estudante pode ter declarado uma
 * competência fora do catálogo e as linhas são referenciadas por perfis.
 */
export async function syncCatalog(sql: Sql): Promise<void> {
  for (const [indice, rotulo] of LEVELS.entries()) {
    await sql.run(
      "INSERT INTO nivel_competencia(nivel, rotulo) VALUES($1, $2) ON CONFLICT (nivel) DO UPDATE SET rotulo = excluded.rotulo",
      [indice + 1, rotulo],
    );
  }
  for (const [indice, rotulo] of LANGUAGE_LEVELS.entries()) {
    await sql.run(
      "INSERT INTO nivel_idioma(nivel, rotulo) VALUES($1, $2) ON CONFLICT (nivel) DO UPDATE SET rotulo = excluded.rotulo",
      [indice + 1, rotulo],
    );
  }
  for (const [codigo, rotulo] of Object.entries(REQUESTER_KIND_LABEL)) {
    await sql.run(
      "INSERT INTO tipo_solicitante(codigo, rotulo) VALUES($1, $2) ON CONFLICT (codigo) DO UPDATE SET rotulo = excluded.rotulo",
      [codigo, rotulo],
    );
  }

  for (const unidade of UNITS) {
    await sql.run(
      "INSERT INTO unidade_academica(codigo, nome) VALUES($1, $2) ON CONFLICT (codigo) DO UPDATE SET nome = excluded.nome",
      [unidade.short, unidade.name],
    );
    for (const curso of unidade.courses) {
      await sql.run(
        "INSERT INTO curso(unidade_codigo, nome) VALUES($1, $2) ON CONFLICT (unidade_codigo, nome) DO NOTHING",
        [unidade.short, curso],
      );
    }
  }

  for (const categoria of new Set(ALL_SKILLS.map(s => s.cat))) {
    await sql.run("INSERT INTO categoria_competencia(nome) VALUES($1) ON CONFLICT (nome) DO NOTHING", [categoria]);
  }
  for (const skill of ALL_SKILLS) {
    const { id } = (await sql.row<{ id: string }>(
      `INSERT INTO competencia(nome_canonico, categoria_id, fora_do_catalogo)
       VALUES($1, (SELECT id FROM categoria_competencia WHERE nome = $2), false)
       ON CONFLICT (nome_canonico) DO UPDATE
         SET categoria_id = excluded.categoria_id, fora_do_catalogo = false
       RETURNING id`,
      [skill.name, skill.cat],
    ))!;
    for (const alias of skill.aliases ?? []) {
      await sql.run(
        "INSERT INTO competencia_alias(competencia_id, alias) VALUES($1, $2) ON CONFLICT (alias) DO NOTHING",
        [id, alias],
      );
    }
  }

  for (const idioma of LANGUAGES) {
    await sql.run("INSERT INTO idioma(nome) VALUES($1) ON CONFLICT (nome) DO NOTHING", [idioma]);
  }
  for (const area of AREA_OPTIONS) {
    await sql.run("INSERT INTO area(nome) VALUES($1) ON CONFLICT (nome) DO NOTHING", [area]);
  }
  for (const escopo of SCOPE_OPTIONS) {
    await sql.run(
      "INSERT INTO escopo_demanda(rotulo, meses_max) VALUES($1, $2) ON CONFLICT (rotulo) DO UPDATE SET meses_max = excluded.meses_max",
      [escopo.rotulo, escopo.mesesMax],
    );
  }
}
