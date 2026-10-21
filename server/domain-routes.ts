import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Database } from "./database";
import type { Config } from "./config";
import { requireAccount, requireVerifiedAccount } from "./security";
import { ensure } from "./errors";
import { snapshot } from "./views";
import { companyPatchSchema, courseValid, demandSchema, interestSchema, projectSchema, responseSchema, statusSchema, studentPatchSchema } from "./schemas";
import { initialsOf } from "./auth-routes";
import { initialStatus, isRefused, nextStatus, turnOf, visibleToRequester } from "@/lib/interest";
import { isProfileVisible } from "@/lib/profile";
import { scoreStudent } from "@/lib/match";
import { REQUESTER_KIND_LABEL } from "@/data/companies";
import { notify, notifyInterest } from "./notifications";
import type { Demand, Interest } from "@/types";

export function domainRoutes(app: FastifyInstance, db: Database, config: Config) {
  const result = (request: FastifyRequest) => snapshot(db, config, requireAccount(db, request));

  app.patch<{ Params: { id: string } }>("/api/students/:id", async request => {
    const account = requireAccount(db, request, "student");
    ensure(account.profileId === request.params.id, 403, "Você só pode editar seu perfil.");
    const patch = studentPatchSchema.parse(request.body);
    db.transaction(() => {
      const student = db.get("students", account.profileId)!;
      const next = { ...student, ...patch, initials: initialsOf(patch.name ?? student.name) };
      ensure(courseValid(next), 400, "Curso inválido para a unidade.");
      db.put("students", next);
      if (patch.name) db.put("accounts", { ...account, name: patch.name });
    });
    return result(request);
  });

  app.patch("/api/company", async request => {
    const account = requireAccount(db, request, "requester");
    const patch = companyPatchSchema.parse(request.body);
    db.transaction(() => {
      const current = db.get("companies", account.profileId)!;
      db.put("companies", { ...current, ...patch, type: patch.kind ? REQUESTER_KIND_LABEL[patch.kind] : current.type });
      if (patch.contactName) db.put("accounts", { ...account, name: patch.contactName });
    });
    return result(request);
  });

  app.post("/api/projects", async (request, reply) => {
    const account = requireVerifiedAccount(db, request, config, "student");
    const data = projectSchema.parse(request.body);
    const project = { ...data, id: `PRJ-${randomUUID()}` };
    db.transaction(() => {
      const student = db.get("students", account.profileId)!;
      ensure(student.projects.length < 100, 409, "Limite de 100 projetos por perfil.");
      db.put("students", { ...student, projects: [project, ...student.projects] });
    });
    reply.code(201);
    return { state: result(request), project };
  });
  app.put<{ Params: { id: string } }>("/api/projects/:id", async request => {
    const account = requireVerifiedAccount(db, request, config, "student");
    const patch = projectSchema.parse(request.body);
    db.transaction(() => {
      const student = db.get("students", account.profileId)!;
      ensure(student.projects.some(p => p.id === request.params.id), 404, "Projeto não encontrado.");
      db.put("students", { ...student, projects: student.projects.map(p => p.id === request.params.id ? { ...patch, id: p.id } : p) });
    });
    return result(request);
  });
  app.delete<{ Params: { id: string } }>("/api/projects/:id", async request => {
    const account = requireAccount(db, request, "student");
    db.transaction(() => {
      const student = db.get("students", account.profileId)!;
      ensure(student.projects.some(p => p.id === request.params.id), 404, "Projeto não encontrado.");
      db.put("students", { ...student, projects: student.projects.filter(p => p.id !== request.params.id) });
    });
    return result(request);
  });

  app.post("/api/demands", async (request, reply) => {
    const account = requireVerifiedAccount(db, request, config, "requester");
    const data = demandSchema.parse(request.body);
    const demand: Demand = { ...data, id: `VIC-${new Date().getFullYear()}-${randomUUID()}`, company: account.profileId, submitted: new Date().toISOString(), status: "nova", priority: "normal" };
    db.transaction(() => {
      db.put("demands", demand);
      notify(db, account.id, demand.title, "Sua demanda foi recebida e está aguardando a curadoria.");
    });
    reply.code(201);
    return { state: result(request), demand };
  });

  app.patch<{ Params: { id: string } }>("/api/demands/:id/status", async request => {
    requireVerifiedAccount(db, request, config, "curator");
    const { status } = statusSchema.parse(request.body);
    db.transaction(() => {
      const demand = db.get("demands", request.params.id);
      ensure(demand, 404, "Demanda não encontrada.");
      ensure(demand.status !== "contato_liberado", 409, "Uma demanda com contato liberado não volta à triagem.");
      const transitions: Record<string, string[]> = { nova: ["em_analise", "aprovada", "rejeitada"], em_analise: ["nova", "aprovada", "rejeitada"], aprovada: ["em_analise", "rejeitada"], rejeitada: ["nova", "em_analise"] };
      if (demand.status === status) return;
      ensure(transitions[demand.status].includes(status), 409, "Transição de status inválida.");
      ensure(!db.all("interests").some(i => i.demandId === demand.id && !isRefused(i.status)), 409, "A demanda tem interesses ativos e não pode voltar à triagem.");
      db.put("demands", { ...demand, status });
      const owner = db.all("accounts").find(a => a.role === "requester" && a.profileId === demand.company);
      if (owner) notify(db, owner.id, demand.title, `O status da demanda mudou para ${status.replaceAll("_", " ")}.`);
    });
    return result(request);
  });
  app.delete<{ Params: { id: string } }>("/api/demands/:id", async request => {
    const account = requireAccount(db, request);
    db.transaction(() => {
      const demand = db.get("demands", request.params.id);
      ensure(demand, 404, "Demanda não encontrada.");
      ensure(account.role === "curator" || (account.role === "requester" && account.profileId === demand.company && demand.status === "nova"), 403, "Você não pode excluir esta demanda.");
      ensure(!db.all("interests").some(i => i.demandId === demand.id), 409, "Demandas com histórico de interesses não podem ser excluídas.");
      db.sql.prepare("DELETE FROM demands WHERE id=?").run(demand.id);
    });
    return result(request);
  });

  app.get<{ Params: { id: string } }>("/api/demands/:id/ranking", async request => {
    requireAccount(db, request, "curator");
    const demand = db.get("demands", request.params.id);
    ensure(demand, 404, "Demanda não encontrada.");
    return result(request).students.filter(isProfileVisible).map(student => ({ student, score: scoreStudent(student, demand) })).sort((a, b) => b.score - a.score);
  });

  app.post("/api/interests", async (request, reply) => {
    const account = requireVerifiedAccount(db, request, config);
    const data = interestSchema.parse(request.body);
    const interest = db.transaction(() => {
      const demand = db.get("demands", data.demandId);
      const student = db.get("students", data.studentId);
      ensure(demand && student, 404, "Demanda ou estudante não encontrado.");
      ensure(demand.status === "aprovada", 409, "Esta demanda não está aberta para novos interesses.");
      ensure(isProfileVisible(student), 409, "O estudante precisa cadastrar ao menos uma competência.");
      ensure(!config.requireVerifiedEmail || db.all("accounts").some(a => a.role === "student" && a.profileId === student.id && a.emailVerifiedAt), 409, "O estudante precisa confirmar o e-mail antes de receber interesses.");
      ensure((data.origin === "candidatura" && account.role === "student" && account.profileId === student.id)
        || (data.origin === "convite" && account.role === "requester" && account.profileId === demand.company)
        || (data.origin === "sugestao" && account.role === "curator"), 403, "Você não pode criar este interesse.");
      const existing = db.all("interests").find(i => i.demandId === demand.id && i.studentId === student.id && !isRefused(i.status));
      if (existing) {
        ensure(account.role !== "requester" || visibleToRequester(existing), 409, "Não foi possível criar outro interesse para este perfil.");
        return existing;
      }
      const created: Interest = { ...data, id: `INT-${randomUUID()}`, status: initialStatus(data.origin), createdAt: new Date().toISOString() };
      db.put("interests", created);
      notifyInterest(db, created);
      return created;
    });
    reply.code(201);
    return { state: result(request), interest };
  });

  app.post<{ Params: { id: string } }>("/api/interests/:id/respond", async request => {
    const account = requireVerifiedAccount(db, request, config);
    const data = responseSchema.parse(request.body);
    db.transaction(() => {
      const interest = db.get("interests", request.params.id);
      ensure(interest, 404, "Interesse não encontrado.");
      const demand = db.get("demands", interest.demandId)!;
      const side = account.role === "student" && account.profileId === interest.studentId ? "estudante"
        : account.role === "requester" && account.profileId === demand.company ? "solicitante" : null;
      ensure(side, 403, "Você não participa deste interesse.");
      ensure(turnOf(interest.status) === side, 409, "Este interesse não aguarda sua resposta.");
      ensure(demand.status === "aprovada" || demand.status === "contato_liberado", 409, "Demanda indisponível.");
      const status = nextStatus(interest.status, interest.origin, side, data.accept);
      const updated = { ...interest, status, refusalReason: data.accept ? undefined : data.refusalReason };
      db.put("interests", updated);
      if (status === "contato_liberado") db.put("demands", { ...demand, status: "contato_liberado" });
      notifyInterest(db, updated);
    });
    return result(request);
  });
}
