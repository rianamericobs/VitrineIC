import { randomUUID } from "node:crypto";
import type { Config } from "../config";
import { readConfig } from "../config";
import { Database } from "../db/pool";
import { migrate } from "../db/migrate";
import { syncCatalog } from "../db/sync-catalog";
import { salvarConta, salvarEstudante, salvarSolicitante } from "../db/mutations";
import { hashPassword } from "../security";
import type { StoredAccount } from "../db/types";
import type { Student } from "@/types";
import type { Company } from "@/data/companies";

/**
 * Apoio dos testes de integração.
 *
 * O SQLite em memória não tem equivalente no PostgreSQL, então os testes usam
 * um banco separado (`vitrineic_test`, criado por `pnpm db:init`) e limpam as
 * tabelas de domínio antes de cada caso. Os catálogos ficam: são carregados de
 * `src/data` e nenhum teste os altera.
 *
 * Os arquivos de teste rodam em série (`--test-concurrency=1`), porque todos
 * compartilham esse banco.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL
  ?? readConfig().databaseUrl.replace(/\/([^/?]+)(\?|$)/, "/vitrineic_test$2");

const TABELAS = [
  "notificacao", "mensagem", "interesse_resposta", "interesse",
  "demanda_historico_status", "demanda_competencia", "demanda",
  "anexo_estudante", "projeto_competencia", "projeto_estudante",
  "estudante_topico", "estudante_idioma", "estudante_competencia", "estudante",
  "solicitante", "token_conta", "sessao", "conta",
];

let preparado = false;

/** Esvazia o domínio e garante esquema e catálogos. Mantém o banco reutilizável. */
export async function prepararBanco(): Promise<Database> {
  const db = new Database(TEST_DATABASE_URL);
  if (!preparado) {
    await migrate(db);
    await db.transaction(syncCatalog);
    preparado = true;
  }
  await db.sql.run(`TRUNCATE ${TABELAS.join(", ")} RESTART IDENTITY CASCADE`);
  return db;
}

export function configDeTeste(overrides: Partial<Config> = {}): Partial<Config> {
  return { databaseUrl: TEST_DATABASE_URL, logger: false, ...overrides };
}

export async function criarConta(
  db: Database,
  dados: Partial<StoredAccount> & { senha?: string } = {},
): Promise<StoredAccount> {
  const conta: StoredAccount = {
    id: dados.id ?? `ACC-${randomUUID()}`,
    role: dados.role ?? "curator",
    email: dados.email ?? `conta-${randomUUID()}@exemplo.com`,
    name: dados.name ?? "Pessoa de Teste",
    profileId: dados.profileId ?? "",
    createdAt: dados.createdAt ?? new Date().toISOString(),
    emailVerifiedAt: dados.emailVerifiedAt,
    credentialVersion: dados.credentialVersion,
    passwordHash: dados.passwordHash ?? await hashPassword(dados.senha ?? "senha-de-teste-123"),
  };
  await db.transaction(tx => salvarConta(tx, conta));
  return conta;
}

export async function criarEstudante(
  db: Database, conta: StoredAccount, dados: Partial<Student> = {},
): Promise<Student> {
  const estudante: Student = {
    id: conta.profileId, name: conta.name, email: conta.email, initials: "",
    unit: "IC", course: "Ciência da Computação", semester: "", gpa: "", bio: "",
    interests: [], skills: [], skillLevels: {}, languages: [], projects: [],
    github: "", availability: "", ...dados,
  };
  await db.transaction(tx => salvarEstudante(tx, estudante, conta.id));
  return estudante;
}

export async function criarSolicitante(
  db: Database, conta: StoredAccount, dados: Partial<Company> = {},
): Promise<Company> {
  const empresa: Company = {
    name: conta.profileId, kind: "empresa", type: "Empresa", contactName: conta.name,
    contactEmail: conta.email, city: "Maceió", since: "2026", site: "", description: "",
    ...dados,
  };
  await db.transaction(tx => salvarSolicitante(tx, empresa, conta.id, `SOL-${randomUUID()}`));
  return empresa;
}
