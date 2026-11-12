import { Database } from "./db/pool";
import { readConfig } from "./config";
import { createCurator } from "./curator";

// Credenciais por variáveis de ambiente, nunca em argumentos visíveis na lista de processos.
const db = new Database(readConfig().databaseUrl);
try {
  await createCurator(db, process.env);
  console.log("Conta de curadoria criada.");
} finally { await db.close(); }
