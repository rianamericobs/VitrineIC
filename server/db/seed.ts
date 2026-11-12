import { randomBytes, randomUUID } from "node:crypto";
import { DEMO_ACCOUNTS } from "@/data/accounts";
import { STUDENTS } from "@/data/students";
import { COMPANIES } from "@/data/companies";
import { DEMANDS } from "@/data/demands";
import { INTERESTS } from "@/data/interests";
import { hashPassword } from "../security";
import type { Sql } from "./pool";
import type { StoredAccount } from "./types";
import { salvarConta, salvarDemanda, salvarEstudante, salvarInteresse, salvarProjeto, salvarSolicitante } from "./mutations";

/**
 * Carga de demonstração.
 *
 * Com nome e e-mail morando em `conta`, todo perfil da semente precisa de uma:
 * os estudantes e os solicitantes de `src/data` ganham conta a partir do
 * próprio e-mail. Só os três endereços de `DEMO_ACCOUNTS` recebem a senha
 * pública; os demais ficam com uma senha aleatória, que ninguém conhece, para
 * aparecerem na vitrine sem virarem porta de entrada.
 */
async function contaPara(
  email: string, nome: string, papel: StoredAccount["role"],
  profileId: string,
): Promise<StoredAccount> {
  const demo = DEMO_ACCOUNTS.find(a => a.email === email);
  return {
    id: demo?.id ?? `ACC-${randomUUID()}`,
    role: papel,
    email,
    name: demo?.name ?? nome,
    profileId,
    createdAt: demo?.createdAt ?? new Date().toISOString(),
    passwordHash: await hashPassword(demo?.password ?? randomBytes(32).toString("hex")),
  };
}

export async function seedDemo(sql: Sql) {
  const existe = await sql.row("SELECT 1 FROM conta LIMIT 1");
  if (existe) throw new Error("A carga de exemplos exige um banco vazio. Nenhum dado existente foi alterado.");

  for (const empresa of COMPANIES) {
    const conta = await contaPara(empresa.contactEmail, empresa.contactName, "requester", empresa.name);
    await salvarConta(sql, conta);
    await salvarSolicitante(sql, empresa, conta.id);
  }

  for (const estudante of STUDENTS) {
    const conta = await contaPara(estudante.email, estudante.name, "student", estudante.id);
    await salvarConta(sql, conta);
    await salvarEstudante(sql, estudante, conta.id);
    for (const projeto of estudante.projects ?? []) await salvarProjeto(sql, estudante.id, projeto);
  }

  for (const curador of DEMO_ACCOUNTS.filter(a => a.role === "curator")) {
    const { password, ...conta } = curador;
    await salvarConta(sql, { ...conta, passwordHash: await hashPassword(password) });
  }

  for (const demanda of DEMANDS) await salvarDemanda(sql, demanda);
  for (const interesse of INTERESTS) await salvarInteresse(sql, interesse);
}
