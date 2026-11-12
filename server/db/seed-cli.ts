import { readConfig } from "../config";
import { Database } from "./pool";
import { seedDemo } from "./seed";

/** `pnpm db:seed` — carga de demonstração no PostgreSQL. */
const config = readConfig();
if (!config.demo || config.production) {
  throw new Error("A carga exige DEMO_MODE=true em ambiente de desenvolvimento.");
}
const db = new Database(config.databaseUrl);
try {
  await db.transaction(seedDemo);
  console.log("Dados fictícios carregados. Senha das contas de exemplo: demo1234.");
} finally {
  await db.close();
}
