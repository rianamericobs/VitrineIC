import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "./pool";

const directory = join(dirname(fileURLToPath(import.meta.url)), "migrations");

/**
 * Aplica os arquivos de `migrations/` em ordem de nome, cada um numa transação
 * própria, registrando o que já rodou. Um arquivo aplicado nunca roda de novo.
 */
export async function migrate(db: Database): Promise<string[]> {
  await db.sql.run(`
    CREATE TABLE IF NOT EXISTS schema_migration (
      versao      text PRIMARY KEY,
      aplicada_em timestamptz NOT NULL DEFAULT now()
    )
  `);

  const arquivos = (await readdir(directory)).filter(f => f.endsWith(".sql")).sort();
  const aplicadas = new Set((await db.sql.rows<{ versao: string }>("SELECT versao FROM schema_migration")).map(r => r.versao));
  const novas: string[] = [];

  for (const arquivo of arquivos) {
    if (aplicadas.has(arquivo)) continue;
    const sql = await readFile(join(directory, arquivo), "utf8");
    await db.transaction(async tx => {
      await tx.run(sql);
      await tx.run("INSERT INTO schema_migration(versao) VALUES($1)", [arquivo]);
    });
    novas.push(arquivo);
  }
  return novas;
}
