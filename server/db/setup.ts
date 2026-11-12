import { readConfig } from "../config";
import { Database } from "./pool";
import { migrate } from "./migrate";
import { syncCatalog } from "./sync-catalog";

/** `pnpm db:migrate` — aplica o esquema e recarrega os catálogos. */
const db = new Database(readConfig().databaseUrl);
try {
  const novas = await migrate(db);
  console.log(novas.length ? `Migrações aplicadas: ${novas.join(", ")}` : "Esquema já estava atualizado.");
  await db.transaction(syncCatalog);
  console.log("Catálogos sincronizados a partir de src/data.");
} finally {
  await db.close();
}
