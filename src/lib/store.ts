/** Cache da API. O banco e as decisões de autorização ficam no servidor. */
import { useSyncExternalStore } from "react";
import { api } from "./api";
import type { Company } from "@/data/companies";
import type { Demand, DemandStatus, Interest, InterestOrigin, InterestSide, Student, StudentProject } from "@/types";
import type { VitrineState } from "@/types/api";
export type { VitrineState } from "@/types/api";

let state: VitrineState = {
  students: [], companies: [], accounts: [], session: null, demands: [], interests: [], inProject: {}, notifications: [], attachments: [], demo: false,
  auth: { emailEnabled: false, verificationRequired: false },
  impact: { released: 0, projects: 0, demands: 0, students: 0, byArea: [], byCourse: [] },
};
let connection = { ready: false, pending: 0, error: "" };
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const emit = () => listeners.forEach(l => l());
export const useVitrine = () => useSyncExternalStore(subscribe, () => state);
export const useConnection = () => useSyncExternalStore(subscribe, () => connection);
export const getState = () => state;
export function replaceState(next: VitrineState) { state = next; emit(); }
export function clearError() { connection = { ...connection, error: "" }; emit(); }

let queue: Promise<unknown> = Promise.resolve();
/** Serializa respostas para impedir que uma leitura antiga sobrescreva uma alteração. */
export function runAction<T>(action: () => Promise<T>): Promise<T | undefined> {
  connection = { ...connection, pending: connection.pending + 1, error: "" };
  emit();
  const task = queue.then(action).catch((error: unknown) => {
    connection = { ...connection, error: error instanceof Error ? error.message : "Não foi possível salvar. Tente novamente." };
    return undefined;
  }).finally(() => { connection = { ...connection, pending: connection.pending - 1 }; emit(); });
  queue = task;
  return task;
}
export function refreshState() {
  return runAction(async () => {
    replaceState(await api<VitrineState>("/state"));
    connection = { ...connection, ready: true };
  });
}
export async function mutate(path: string, method: string, body?: unknown) {
  return runAction(async () => { replaceState(await api<VitrineState>(path, { method, body })); return true; });
}
export const findStudent = (id: string) => state.students.find(s => s.id === id);
export function allProjects(students: Student[] = state.students) {
  return students.flatMap(student => student.projects.map(project => ({ ...project, student })));
}
export type ProjectWithStudent = ReturnType<typeof allProjects>[number];
export const findProject = (id: string) => allProjects().find(p => p.id === id);
export const studentEmail = (student: Student) => student.email;
export const updateStudent = (id: string, patch: Partial<Student>) => mutate(`/students/${encodeURIComponent(id)}`, "PATCH", patch);
export const findCompany = (name: string) => state.companies.find(c => c.name === name);
export const companyEmail = (name: string) => findCompany(name)?.contactEmail ?? "";
export const updateCompany = (_name: string, patch: Partial<Company>) => {
  const { type: _type, ...data } = patch;
  return mutate("/company", "PATCH", data);
};
export function addDemand(demand: Omit<Demand, "id" | "company" | "status" | "priority" | "submitted">) {
  return runAction(async () => {
    const result = await api<{ state: VitrineState; demand: Demand }>("/demands", { method: "POST", body: demand });
    replaceState(result.state);
    return result.demand;
  });
}
export const setDemandStatus = (id: string, status: DemandStatus) => mutate(`/demands/${encodeURIComponent(id)}/status`, "PATCH", { status });
export const removeDemand = (id: string) => mutate(`/demands/${encodeURIComponent(id)}`, "DELETE");
export function findActiveInterest(interests: Interest[], demandId: string, studentId: string) {
  return interests.find(i => i.demandId === demandId && i.studentId === studentId && i.status !== "recusado_estudante" && i.status !== "recusado_solicitante");
}
export function createInterest(demandId: string, studentId: string, origin: InterestOrigin, justification?: string) {
  return runAction(async () => {
    const result = await api<{ state: VitrineState; interest: Interest }>("/interests", { method: "POST", body: { demandId, studentId, origin, justification } });
    replaceState(result.state);
    return result.interest;
  });
}
export const respondInterest = (id: string, _side: InterestSide, accept: boolean, refusalReason?: string) => mutate(`/interests/${encodeURIComponent(id)}/respond`, "POST", { accept, refusalReason });
export const setInProject = (id: string, value: boolean) => updateStudent(id, { inProject: value });
export function addProject(project: Omit<StudentProject, "id">) {
  return runAction(async () => {
    const result = await api<{ state: VitrineState; project: StudentProject }>("/projects", { method: "POST", body: project });
    replaceState(result.state);
    return result.project;
  });
}
export const markRead = (id: string) => mutate(`/notifications/${encodeURIComponent(id)}/read`, "POST");
export const markAllRead = () => mutate("/notifications/read-all", "POST");
export const replyNotification = (id: string, content: string) => mutate(`/notifications/${encodeURIComponent(id)}/reply`, "POST", { content });
export const deleteAttachment = (id: string) => mutate(`/attachments/${encodeURIComponent(id)}`, "DELETE");
export function uploadAttachment(category: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  return mutate(`/attachments/${category}`, "POST", form);
}
