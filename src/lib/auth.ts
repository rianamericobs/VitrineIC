import { DEMO_EMAIL, DEMO_PASSWORD } from "@/data/accounts";
import { api } from "./api";
import { mutate, replaceState, runAction, useVitrine, type VitrineState } from "./store";
import type { Account, RequesterKind, Role } from "@/types";

export type AuthResult = { ok: true; account: Account } | { ok: false; error: string };
export const SIGN_IN_ERROR = "E-mail ou senha incorretos.";
export const DUPLICATE_EMAIL_ERROR = "Já existe uma conta com este e-mail.";
async function authenticate(path: string, body: unknown): Promise<AuthResult> {
  const result = await runAction(async (): Promise<AuthResult> => {
    try {
      const state = await api<VitrineState>(path, { method: "POST", body });
      replaceState(state);
      return { ok: true, account: state.accounts[0] };
    } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Não foi possível entrar." }; }
  });
  return result ?? { ok: false, error: "Não foi possível entrar." };
}
export const signIn = (email: string, password: string, role?: Role) => authenticate("/auth/login", { email, password, role });
export const signInDemo = (role: Role) => signIn(DEMO_EMAIL[role], DEMO_PASSWORD, role);
export const signOut = () => mutate("/auth/logout", "POST");
export const signOutAll = () => mutate("/auth/logout-all", "POST");
export const changePassword = (currentPassword: string, password: string) => mutate("/auth/change-password", "POST", { currentPassword, password });

export function requestPasswordReset(email: string) {
  return runAction(() => api<{ message: string }>("/auth/forgot-password", { method: "POST", body: { email } }));
}
export function requestVerificationEmail() {
  return runAction(() => api<{ message: string }>("/auth/verification-email", { method: "POST" }));
}
export function completeAccountLink(action: "reset-password" | "verify-email", token: string, password?: string) {
  return runAction(async () => {
    const result = await api<{ message: string; state: VitrineState }>(`/auth/${action}`, { method: "POST", body: { token, ...(password === undefined ? {} : { password }) } });
    replaceState(result.state);
    return result.message;
  });
}
export interface StudentSignUp { name: string; email: string; unit: string; course: string; password: string; consent: boolean }
export function signUpStudent({ name, email, unit, course, password, consent }: StudentSignUp) {
  return authenticate("/auth/students", { name, email, unit, course, password, consent });
}
export interface RequesterSignUp { kind: RequesterKind; organization: string; city: string; contactName: string; site: string; email: string; password: string }
export function signUpRequester({ kind, organization, city, contactName, site, email, password }: RequesterSignUp) {
  return authenticate("/auth/requesters", { kind, organization, city, contactName, site, email, password });
}
export function sessionOf(state: VitrineState) {
  const account = state.session && state.accounts.find(a => a.id === state.session!.accountId);
  if (!account) return null;
  return {
    account,
    student: account.role === "student" ? state.students.find(s => s.id === account.profileId) : undefined,
    company: account.role === "requester" ? state.companies.find(c => c.name === account.profileId) : undefined,
  };
}
export const useSession = () => sessionOf(useVitrine());
export const useCurrentRequester = () => useSession()?.company?.name ?? "";
