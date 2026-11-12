import type { FastifyInstance } from "fastify";
import type { Database } from "./db/pool";
import type { Config } from "./config";
import { requireAccount } from "./security";
import { snapshot } from "./db/snapshot";
import { ensure } from "./errors";
import { messageSchema } from "./schemas";
import { contas, demandas, interesses } from "./db/repositories";
import { criarMensagem, criarNotificacao, marcarNotificacaoLida, marcarTodasLidas } from "./db/mutations";

export function inboxRoutes(app: FastifyInstance, db: Database, config: Config) {
  app.post<{ Params: { id: string } }>("/api/notifications/:id/read", async request => {
    const account = await requireAccount(db, request);
    const existe = await db.sql.row(
      "SELECT 1 FROM notificacao WHERE id = $1 AND destinatario_conta_id = $2",
      [request.params.id, account.id]);
    ensure(existe, 404, "Notificação não encontrada.");
    await marcarNotificacaoLida(db.sql, request.params.id, account.id);
    return snapshot(db.sql, config, account);
  });

  app.post("/api/notifications/read-all", async request => {
    const account = await requireAccount(db, request);
    await marcarTodasLidas(db.sql, account.id);
    return snapshot(db.sql, config, account);
  });

  app.post<{ Params: { id: string } }>("/api/notifications/:id/reply", async request => {
    const account = await requireAccount(db, request);
    const data = messageSchema.parse(request.body);
    await db.transaction(async tx => {
      const notificacao = await tx.row<{ interesse_id: string | null }>(
        "SELECT interesse_id FROM notificacao WHERE id = $1 AND destinatario_conta_id = $2",
        [request.params.id, account.id]);
      ensure(notificacao, 404, "Notificação não encontrada.");

      const interesse = notificacao.interesse_id
        ? await interesses.porId(tx, notificacao.interesse_id) : undefined;
      ensure(interesse && interesse.status === "contato_liberado", 409,
        "Mensagens ficam disponíveis após o aceite dos dois lados.");
      const demanda = (await demandas.porId(tx, interesse.demandId))!;
      ensure((account.role === "student" && account.profileId === interesse.studentId)
        || (account.role === "requester" && account.profileId === demanda.company),
        403, "Você não participa deste contato.");

      const destino = account.role === "student"
        ? await contas.doSolicitante(tx, demanda.company)
        : await contas.doEstudante(tx, interesse.studentId);
      ensure(destino, 409, "O destinatário ainda não tem conta na plataforma.");

      const mensagemId = await criarMensagem(tx, interesse.id, account.id, data.content);
      await criarNotificacao(tx, {
        destinatarioContaId: destino.id, tipo: "MENSAGEM",
        demandaId: demanda.id, interesseId: interesse.id, mensagemId,
      });
      await marcarNotificacaoLida(tx, request.params.id, account.id);
    });
    return snapshot(db.sql, config, account);
  });
}
