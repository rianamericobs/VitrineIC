import { randomUUID } from "node:crypto";
import { basename, extname } from "node:path";
import type { FastifyInstance } from "fastify";
import type { Database } from "./database";
import type { Config } from "./config";
import { requireAccount, requireVerifiedAccount } from "./security";
import { ensure } from "./errors";
import { snapshot } from "./views";

export function fileRoutes(app: FastifyInstance, db: Database, config: Config) {
  app.post<{ Params: { category: string } }>("/api/attachments/:category", async (request, reply) => {
    const account = requireVerifiedAccount(db, request, config, "student");
    const { category } = request.params;
    ensure(["tech", "language", "portfolio"].includes(category), 400, "Categoria inválida.");
    const file = await request.file();
    ensure(file, 400, "Selecione um arquivo.");
    const name = basename(file.filename.replaceAll("\\", "/")).replace(/[\x00-\x1f\x7f]/g, "").slice(0, 200);
    const extension = extname(name).toLowerCase();
    ensure((category === "portfolio" ? [".pdf", ".zip", ".docx"] : [".pdf"]).includes(extension), 400, "Formato de arquivo não permitido.");
    const content = await file.toBuffer();
    ensure(!file.file.truncated, 413, "O limite por arquivo é 20 MB.");
    const pdf = content.subarray(0, 5).toString() === "%PDF-";
    const zip = content[0] === 0x50 && content[1] === 0x4b && content[2] === 0x03 && content[3] === 0x04;
    ensure(extension === ".pdf" ? pdf : zip, 400, "O conteúdo não corresponde ao formato do arquivo.");
    db.transaction(() => {
      const usage = db.sql.prepare("SELECT count(*) AS count, coalesce(sum(length(content)),0) AS bytes FROM attachments WHERE student_id=?").get(account.profileId)!;
      ensure(Number(usage.count) < 20 && Number(usage.bytes) + content.length <= 100 * 1024 * 1024, 409, "Limite de 20 arquivos ou 100 MB por perfil.");
      db.sql.prepare("INSERT INTO attachments(id,student_id,name,category,mime,content) VALUES(?,?,?,?,?,?)")
        .run(randomUUID(), account.profileId, name, category, "application/octet-stream", content);
    });
    reply.code(201);
    return snapshot(db, config, account);
  });
  app.get<{ Params: { id: string } }>("/api/attachments/:id", async (request, reply) => {
    const account = requireAccount(db, request);
    const file = db.sql.prepare("SELECT * FROM attachments WHERE id=?").get(request.params.id);
    ensure(file, 404, "Arquivo não encontrado.");
    ensure(account.role === "curator" || (account.role === "student" && file.student_id === account.profileId), 403, "Arquivo privado.");
    return reply.header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(String(file.name))}`)
      .type("application/octet-stream").send(Buffer.from(file.content as Uint8Array));
  });
  app.delete<{ Params: { id: string } }>("/api/attachments/:id", async request => {
    const account = requireAccount(db, request, "student");
    const deleted = db.sql.prepare("DELETE FROM attachments WHERE id=? AND student_id=?").run(request.params.id, account.profileId);
    ensure(deleted.changes, 404, "Arquivo não encontrado.");
    return snapshot(db, config, account);
  });
}
