import { DEMO_ACCOUNTS } from "@/data/accounts";
import { STUDENTS } from "@/data/students";
import { COMPANIES } from "@/data/companies";
import { DEMANDS } from "@/data/demands";
import { INTERESTS } from "@/data/interests";
import type { Database } from "./database";
import { hashPassword } from "./security";

export async function seedDemo(db: Database) {
  if (db.all("accounts").length || db.all("students").length || db.all("companies").length) throw new Error("A carga de exemplos exige um banco vazio. Nenhum dado existente foi alterado.");
  const accounts = await Promise.all(DEMO_ACCOUNTS.map(async ({ password, ...account }) => ({ ...account, passwordHash: await hashPassword(password) })));
  db.transaction(() => {
    for (const student of STUDENTS) {
      const account = accounts.find(a => a.role === "student" && a.profileId === student.id);
      db.put("students", { ...student, ...(account ? { email: account.email } : {}) });
    }
    for (const company of COMPANIES) db.put("companies", company);
    for (const account of accounts) db.put("accounts", account);
    for (const demand of DEMANDS) db.put("demands", demand);
    for (const interest of INTERESTS) db.put("interests", interest);
  });
}
