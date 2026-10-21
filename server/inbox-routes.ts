import type { FastifyInstance } from "fastify";
import type { Database } from "./database";
import type { Config } from "./config";
import { requireAccount } from "./security";
import { snapshot } from "./views";
import { ensure } from "./errors";
import { messageSchema } from "./schemas";
import { notify } from "./notifications";

export function inboxRoutes(app: FastifyInstance, db: Database, config: Config) {
  app.post<{ Params: { id: string } }>("/api/notifications/:id/read", async request => {
    const account = requireAccount(db, request);
    const notification = db.get("notifications", request.params.id);
    ensure(notification && notification.accountId === account.id, 404, "Notificação não encontrada.");
    db.put("notifications", { ...notification, unread: false });
    return snapshot(db, config, account);
  });
  app.post("/api/notifications/read-all", async request => {
    const account = requireAccount(db, request);
    db.transaction(() => {
      for (const n of db.all("notifications").filter(n => n.accountId === account.id && n.unread)) db.put("notifications", { ...n, unread: false });
    });
    return snapshot(db, config, account);
  });
  app.post<{ Params: { id: string } }>("/api/notifications/:id/reply", async request => {
    const account = requireAccount(db, request);
    const data = messageSchema.parse(request.body);
    db.transaction(() => {
      const notification = db.get("notifications", request.params.id);
      ensure(notification && notification.accountId === account.id, 404, "Notificação não encontrada.");
      const interest = notification.interestId && db.get("interests", notification.interestId);
      ensure(interest && interest.status === "contato_liberado", 409, "Mensagens ficam disponíveis após o aceite dos dois lados.");
      const demand = db.get("demands", interest.demandId)!;
      ensure((account.role === "student" && account.profileId === interest.studentId) || (account.role === "requester" && account.profileId === demand.company), 403, "Você não participa deste contato.");
      const target = db.all("accounts").find(a => account.role === "student" ? a.role === "requester" && a.profileId === demand.company : a.role === "student" && a.profileId === interest.studentId);
      ensure(target, 409, "O destinatário ainda não tem conta na plataforma.");
      notify(db, target.id, demand.title, data.content, interest.id, account.name, account.id);
      db.put("notifications", { ...notification, unread: false });
    });
    return snapshot(db, config, account);
  });
}
