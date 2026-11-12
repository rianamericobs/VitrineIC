import { Pool, type PoolClient, type QueryResultRow } from "pg";

/**
 * Acesso ao PostgreSQL. Tudo é assíncrono — o esquema anterior usava
 * `node:sqlite` síncrono, então cada leitura virou `await`.
 *
 * `Sql` é o que as consultas recebem: fora de transação é o pool, dentro é o
 * cliente reservado. As rotas não precisam saber a diferença.
 */
export interface Sql {
  rows<T extends QueryResultRow>(text: string, params?: unknown[]): Promise<T[]>;
  row<T extends QueryResultRow>(text: string, params?: unknown[]): Promise<T | undefined>;
  run(text: string, params?: unknown[]): Promise<number>;
}

function wrap(source: Pool | PoolClient): Sql {
  return {
    async rows<T extends QueryResultRow>(text: string, params: unknown[] = []) {
      return (await source.query<T>(text, params)).rows;
    },
    async row<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T | undefined> {
      return (await source.query<T>(text, params)).rows[0];
    },
    async run(text: string, params: unknown[] = []) {
      return (await source.query(text, params)).rowCount ?? 0;
    },
  };
}

export class Database {
  readonly pool: Pool;
  readonly sql: Sql;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    // Sem isto, um erro em cliente ocioso derruba o processo.
    this.pool.on("error", () => {});
    this.sql = wrap(this.pool);
  }

  /** Transação real: um cliente reservado, com COMMIT ou ROLLBACK garantidos. */
  async transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const value = await fn(wrap(client));
      await client.query("COMMIT");
      return value;
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { /* conexão já perdida */ }
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}
