import type { Sql } from "./db/pool";
import type { Interest } from "@/types";
import { contas, demandas } from "./db/repositories";
import { criarNotificacao } from "./db/mutations";
import { visibleToRequester } from "@/lib/interest";

/**
 * Notificação do sistema. O título da demanda e o nome de quem envia não são
 * copiados para cá: saem por junção na leitura, em `server/db/snapshot.ts`.
 */
export const notificar = (
  sql: Sql, contaId: string, assunto: string, conteudo: string, demandaId?: string, interesseId?: string,
) => criarNotificacao(sql, {
  destinatarioContaId: contaId, tipo: "SISTEMA",
  // Com demanda, o título sai por junção; sem ela, o aviso traz o próprio assunto.
  assunto: demandaId ? undefined : assunto,
  conteudo, demandaId, interesseId,
});

/** Avisa os dois lados de um interesse, respeitando o que cada um pode ver. */
export async function notificarInteresse(sql: Sql, interesse: Interest) {
  const demanda = (await demandas.porId(sql, interesse.demandId))!;
  const texto = interesse.status === "contato_liberado"
    ? "Os dois lados aceitaram. Os contatos estão disponíveis na tela de interesses."
    : interesse.status.startsWith("recusado_")
      ? "Este interesse foi encerrado."
      : "Você tem uma atualização de interesse. Consulte a tela de interesses para acompanhar ou responder.";

  const estudante = await contas.doEstudante(sql, interesse.studentId);
  if (estudante) await notificar(sql, estudante.id, demanda.title, texto, demanda.id, interesse.id);

  const solicitante = await contas.doSolicitante(sql, demanda.company);
  if (solicitante && visibleToRequester(interesse)) {
    await notificar(sql, solicitante.id, demanda.title, texto, demanda.id, interesse.id);
  }
}
