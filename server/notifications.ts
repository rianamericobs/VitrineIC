import { randomUUID } from "node:crypto";
import type { Database } from "./database";
import type { Interest } from "@/types";
import { visibleToRequester } from "@/lib/interest";

export function notify(db: Database, accountId: string, project: string, content: string, interestId?: string, from = "VitrineIC", senderId?: string) {
  db.put("notifications", { id: randomUUID(), accountId, type: senderId ? "MENSAGEM" : "SISTEMA", from, project, content, interestId, senderId, time: new Date().toISOString(), unread: true });
}

export function notifyInterest(db: Database, interest: Interest) {
  const demand = db.get("demands", interest.demandId)!;
  const accounts = db.all("accounts");
  const student = accounts.find(a => a.role === "student" && a.profileId === interest.studentId);
  const requester = accounts.find(a => a.role === "requester" && a.profileId === demand.company);
  const text = interest.status === "contato_liberado" ? "Os dois lados aceitaram. Os contatos estão disponíveis na tela de interesses."
    : interest.status.startsWith("recusado_") ? "Este interesse foi encerrado."
    : "Você tem uma atualização de interesse. Consulte a tela de interesses para acompanhar ou responder.";
  if (student) notify(db, student.id, demand.title, text, interest.id);
  if (requester && visibleToRequester(interest)) notify(db, requester.id, demand.title, text, interest.id);
}
