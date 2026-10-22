import { Database } from "./database";
import { readConfig } from "./config";
import { createCurator } from "./curator";

// Credenciais por variáveis de ambiente, nunca em argumentos visíveis na lista de processos.
const db = new Database(readConfig().databasePath);
try {
  await createCurator(db, process.env);
  console.log("Conta de curadoria criada.");
} finally { db.close(); }
