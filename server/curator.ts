import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Database } from "./db/pool";
import { contas } from "./db/repositories";
import { salvarConta } from "./db/mutations";
import { emailSchema, passwordSchema } from "./schemas";
import { hashPassword } from "./security";

export async function createCurator(db: Database, env: NodeJS.ProcessEnv, skipExisting = false) {
  const email = emailSchema.parse(env.CURATOR_EMAIL);
  const password = passwordSchema.parse(env.CURATOR_PASSWORD);
  const name = z.string().trim().min(1).max(120).parse(env.CURATOR_NAME ?? "Curadoria");
  const existente = await contas.porEmail(db.sql, email);
  if (existente) {
    if (skipExisting && existente.role === "curator") return false;
    throw new Error("Este e-mail já está cadastrado. Nenhuma conta foi alterada.");
  }
  const passwordHash = await hashPassword(password);
  await db.transaction(tx => salvarConta(tx, {
    id: `ACC-${randomUUID()}`, email, passwordHash, name,
    role: "curator", profileId: "", createdAt: new Date().toISOString(),
  }));
  return true;
}

/** Bootstrap opt-in para ambientes sem shell; nunca redefine senha ou promove contas. */
export async function bootstrapCurator(db: Database, env: NodeJS.ProcessEnv = process.env) {
  if (env.BOOTSTRAP_CURATOR !== "true") return false;
  return createCurator(db, env, true);
}
