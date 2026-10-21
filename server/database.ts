import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Account, Demand, Interest, Student } from "@/types";
import type { Company } from "@/data/companies";
import { migrate } from "./migrations";

export interface StoredAccount extends Account { passwordHash: string; credentialVersion?: number }
export interface StoredNotification {
  id: string;
  accountId: string;
  type: string;
  from: string;
  project: string;
  time: string;
  unread: boolean;
  content: string;
  interestId?: string;
  senderId?: string;
}
interface Tables {
  students: Student;
  companies: Company;
  accounts: StoredAccount;
  demands: Demand;
  interests: Interest;
  notifications: StoredNotification;
}

/** Colunas relacionais garantem referências/uniqueness; JSON preserva o contrato do frontend. */
export class Database {
  readonly sql: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.sql = new DatabaseSync(path);
    this.sql.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS students (id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)));
      CREATE TABLE IF NOT EXISTS companies (id TEXT PRIMARY KEY COLLATE NOCASE, data TEXT NOT NULL CHECK(json_valid(data)));
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        student_id TEXT UNIQUE REFERENCES students(id), company_id TEXT UNIQUE REFERENCES companies(id),
        data TEXT NOT NULL CHECK(json_valid(data))
      );
      CREATE TABLE IF NOT EXISTS demands (
        id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
        data TEXT NOT NULL CHECK(json_valid(data))
      );
      CREATE INDEX IF NOT EXISTS demands_company ON demands(company_id);
      CREATE TABLE IF NOT EXISTS interests (
        id TEXT PRIMARY KEY, demand_id TEXT NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
        student_id TEXT NOT NULL REFERENCES students(id), status TEXT NOT NULL,
        data TEXT NOT NULL CHECK(json_valid(data))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS interests_active_pair ON interests(demand_id,student_id)
        WHERE status NOT IN ('recusado_estudante','recusado_solicitante');
      CREATE INDEX IF NOT EXISTS interests_student ON interests(student_id);
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        data TEXT NOT NULL CHECK(json_valid(data))
      );
      CREATE INDEX IF NOT EXISTS notifications_account ON notifications(account_id);
      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY, student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        name TEXT NOT NULL, category TEXT NOT NULL, mime TEXT NOT NULL, content BLOB NOT NULL
      );
      INSERT OR IGNORE INTO migrations(version) VALUES(1);
    `);
    try { migrate(this.sql); }
    catch (error) { this.sql.close(); throw error; }
  }

  all<K extends keyof Tables>(table: K): Tables[K][] {
    return this.sql.prepare(`SELECT data FROM ${table} ORDER BY rowid DESC`).all().map(row => JSON.parse(String(row.data)) as Tables[K]);
  }

  get<K extends keyof Tables>(table: K, id: string): Tables[K] | undefined {
    const row = this.sql.prepare(`SELECT data FROM ${table} WHERE id=?`).get(id);
    return row ? JSON.parse(String(row.data)) as Tables[K] : undefined;
  }

  put<K extends keyof Tables>(table: K, value: Tables[K]) {
    const id = table === "companies" ? (value as Company).name : (value as Exclude<Tables[K], Company>).id;
    const columns: Record<string, SQLInputValue> = { id, data: JSON.stringify(value) };
    if (table === "accounts") {
      const account = value as StoredAccount;
      columns.email = account.email;
      columns.student_id = account.role === "student" ? account.profileId : null;
      columns.company_id = account.role === "requester" ? account.profileId : null;
    }
    if (table === "demands") columns.company_id = (value as Demand).company;
    if (table === "interests") {
      const interest = value as Interest;
      columns.demand_id = interest.demandId;
      columns.student_id = interest.studentId;
      columns.status = interest.status;
    }
    if (table === "notifications") columns.account_id = (value as StoredNotification).accountId;
    const keys = Object.keys(columns);
    this.sql.prepare(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})
      ON CONFLICT(id) DO UPDATE SET ${keys.filter(k => k !== "id").map(k => `${k}=excluded.${k}`).join(",")}`)
      .run(...Object.values(columns));
  }

  transaction<T>(fn: () => T): T {
    this.sql.exec("BEGIN IMMEDIATE");
    try {
      const value = fn();
      this.sql.exec("COMMIT");
      return value;
    } catch (error) {
      this.sql.exec("ROLLBACK");
      throw error;
    }
  }

  close() { this.sql.close(); }
}
