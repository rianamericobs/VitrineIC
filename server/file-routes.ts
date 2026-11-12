import { basename, extname } from "node:path";
import type { FastifyInstance } from "fastify";
import type { Database } from "./db/pool";
import type { Config } from "./config";
import { requireAccount, requireVerifiedAccount } from "./security";
import { ensure } from "./errors";
import { snapshot } from "./db/snapshot";

export function fileRoutes(app: FastifyInstance, db: Database, config: Config) {
  app.post<{ Params: { category: string } }>("/api/attachments/:category", async (request, reply) => {
    const account = await requireVerifiedAccount(db, request, config, "student");
    const { category } = request.params;
    ensure(["tech", "language", "portfolio"].includes(category), 400, "Categoria inválida.");
    const file = await request.file();
    ensure(file, 400, "Selecione um arquivo.");
    const name = basename(file.filename.replaceAll("\\", "/")).replace(/[\x00-\x1f\x7f]/g, "").slice(0, 200);
    const extension = extname(name).toLowerCase();
    ensure((category === "portfolio" ? [".pdf", ".zip", ".docx"] : [".pdf"]).includes(extension), 400,
      "Formato de arquivo não permitido.");
    const content = await file.toBuffer();
    ensure(!file.file.truncated, 413, "O limite por arquivo é 20 MB.");
    const pdf = content.subarray(0, 5).toString() === "%PDF-";
    const zip = content[0] === 0x50 && content[1] === 0x4b && content[2] === 0x03 && content[3] === 0x04;
    ensure(extension === ".pdf" ? pdf : zip, 400, "O conteúdo não corresponde ao formato do arquivo.");

    await db.transaction(async tx => {
      // Usa anexo_estudante_estudante; antes somava o tamanho dos BLOBs varrendo a tabela.
      const uso = (await tx.row<{ total: string; bytes: string }>(
        `SELECT count(*) AS total, COALESCE(sum(tamanho_bytes), 0) AS bytes
         FROM anexo_estudante WHERE estudante_id = $1`, [account.profileId]))!;
      ensure(Number(uso.total) < 20 && Number(uso.bytes) + content.length <= 100 * 1024 * 1024, 409,
        "Limite de 20 arquivos ou 100 MB por perfil.");
      await tx.run(
        `INSERT INTO anexo_estudante (estudante_id, nome, categoria, mime, conteudo, tamanho_bytes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [account.profileId, name, category, "application/octet-stream", content, content.length],
      );
    });
    reply.code(201);
    return snapshot(db.sql, config, account);
  });

  app.get<{ Params: { id: string } }>("/api/attachments/:id", async (request, reply) => {
    const account = await requireAccount(db, request);
    const arquivo = await db.sql.row<{ estudante_id: string; nome: string; conteudo: Buffer }>(
      "SELECT estudante_id, nome, conteudo FROM anexo_estudante WHERE id = $1", [request.params.id]);
    ensure(arquivo, 404, "Arquivo não encontrado.");
    ensure(account.role === "curator"
      || (account.role === "student" && arquivo.estudante_id === account.profileId), 403, "Arquivo privado.");
    return reply
      .header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(arquivo.nome)}`)
      .type("application/octet-stream").send(Buffer.from(arquivo.conteudo));
  });

  app.delete<{ Params: { id: string } }>("/api/attachments/:id", async request => {
    const account = await requireAccount(db, request, "student");
    const removidos = await db.sql.run(
      "DELETE FROM anexo_estudante WHERE id = $1 AND estudante_id = $2",
      [request.params.id, account.profileId]);
    ensure(removidos > 0, 404, "Arquivo não encontrado.");
    return snapshot(db.sql, config, account);
  });
}
