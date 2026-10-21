import { randomUUID } from "node:crypto";
import { Database } from "./database";
import { readConfig } from "./config";
import { emailSchema, passwordSchema } from "./schemas";
import { hashPassword } from "./security";

// Credenciais por variáveis de ambiente, nunca em argumentos visíveis na lista de processos.
const email = emailSchema.parse(process.env.CURATOR_EMAIL);
const password = passwordSchema.parse(process.env.CURATOR_PASSWORD);
const name = process.env.CURATOR_NAME?.trim() || "Curadoria";
const db = new Database(readConfig().databasePath);
try {
  const passwordHash = await hashPassword(password);
  db.transaction(() => {
    if (db.sql.prepare("SELECT id FROM accounts WHERE email=?").get(email)) throw new Error("Este e-mail já está cadastrado.");
    db.put("accounts", { id: randomUUID(), email, passwordHash, name, role: "curator", profileId: "", createdAt: new Date().toISOString() });
  });
  console.log("Conta de curadoria criada.");
} finally { db.close(); }
