import type { DatabaseSync } from "node:sqlite";

/** O esquema original já registra a versão 1. Cada evolução é aplicada uma vez. */
const migrations = [{
  version: 2,
  sql: `
    CREATE TABLE account_tokens (
      token_hash TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL CHECK(purpose IN ('reset_password','verify_email')),
      credential_version INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      UNIQUE(account_id, purpose)
    );
    CREATE INDEX account_tokens_expiry ON account_tokens(expires_at);
  `,
}];

export function migrate(db: DatabaseSync) {
  const current = Number(db.prepare("SELECT max(version) AS version FROM migrations").get()!.version);
  if (current > migrations[migrations.length - 1].version) throw new Error("O banco usa uma versão de esquema mais nova que este servidor.");
  for (const migration of migrations) {
    db.exec("BEGIN IMMEDIATE");
    try {
      if (!db.prepare("SELECT version FROM migrations WHERE version=?").get(migration.version)) {
        db.exec(migration.sql);
        db.prepare("INSERT INTO migrations(version) VALUES(?)").run(migration.version);
      }
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  }
}
