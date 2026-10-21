import { Database } from "./database";
import { readConfig } from "./config";
import { seedDemo } from "./seed-data";

const config = readConfig();
if (!config.demo || config.production) throw new Error("A carga exige DEMO_MODE=true em ambiente de desenvolvimento.");
const db = new Database(config.databasePath);
try { await seedDemo(db); console.log("Dados fictícios carregados. Senha das contas de exemplo: demo1234."); }
finally { db.close(); }
