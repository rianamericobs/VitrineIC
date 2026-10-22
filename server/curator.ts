import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Database } from "./database";
import { emailSchema, passwordSchema } from "./schemas";
import { hashPassword } from "./security";

export async function createCurator(db: Database, env: NodeJS.ProcessEnv, skipExisting = false) {
  const email = emailSchema.parse(env.CURATOR_EMAIL);
  const password = passwordSchema.parse(env.CURATOR_PASSWORD);
  const name = z.string().trim().min(1).max(120).parse(env.CURATOR_NAME ?? "Curadoria");
  const row = db.sql.prepare("SELECT id FROM accounts WHERE email=?").get(email);
  const existing = row ? db.get("accounts", String(row.id)) : undefined;
  if (existing) {
    if (skipExisting && existing.role === "curator") return false;
    throw new Error("Este e-mail já está cadastrado. Nenhuma conta foi alterada.");
  }
  const passwordHash = await hashPassword(password);
  db.transaction(() => {
    db.put("accounts", { id: randomUUID(), email, passwordHash, name, role: "curator", profileId: "", createdAt: new Date().toISOString() });
  });
  return true;
}

/** Bootstrap opt-in para ambientes sem shell; nunca redefine senha ou promove contas. */
export async function bootstrapCurator(db: Database, env: NodeJS.ProcessEnv = process.env) {
  if (env.BOOTSTRAP_CURATOR !== "true") return false;
  return createCurator(db, env, true);
}
