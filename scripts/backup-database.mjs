import { DatabaseSync } from "node:sqlite";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

if (!process.env.DATABASE_PATH || !process.env.BACKUP_PATH) {
  throw new Error("Configure DATABASE_PATH e BACKUP_PATH. O destino deve ser um arquivo novo.");
}
const source = resolve(process.env.DATABASE_PATH);
const destination = resolve(process.env.BACKUP_PATH);
if (source === destination) throw new Error("O backup não pode substituir o banco de origem.");
if (existsSync(destination)) throw new Error("O destino já existe. Escolha um arquivo novo para o backup.");
mkdirSync(dirname(destination), { recursive: true });
const db = new DatabaseSync(source, { readOnly: true });
try {
  db.exec("PRAGMA busy_timeout=5000;");
  // Snapshot consistente, incluindo WAL e BLOBs; SQLite recusa destino já preenchido.
  db.prepare("VACUUM INTO ?").run(destination);
  chmodSync(destination, 0o600);
  console.log("Backup consistente concluído. Guarde uma cópia fora do servidor.");
} finally { db.close(); }
