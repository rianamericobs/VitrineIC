import nodemailer from "nodemailer";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { MailConfig } from "./config";

export interface MailMessage { to: string; subject: string; text: string }
export interface Mailer { send(message: MailMessage): Promise<void> }

export function createMailer(config: MailConfig, request: typeof fetch = fetch): Mailer {
  if (config.mode === "disabled") return { async send() { throw new Error("Envio de e-mail desabilitado."); } };
  if (config.mode === "resend") {
    return { async send(message) {
      const response = await request("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...message, from: config.from, to: [message.to] }),
        signal: AbortSignal.timeout(15_000),
        redirect: "error",
      });
      // Não registre o corpo do provedor: pode conter destinatários e links de acesso.
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`Falha no envio de e-mail via HTTPS (${response.status}).`);
      }
      await response.body?.cancel();
    } };
  }
  if (config.mode === "file") {
    const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
    return { async send(message) {
      const result = await transport.sendMail({ ...message, from: config.from, disableFileAccess: true, disableUrlAccess: true });
      await mkdir(config.directory, { recursive: true, mode: 0o700 });
      await writeFile(resolve(config.directory, `${Date.now()}-${randomUUID()}.eml`), result.message as Buffer, { mode: 0o600, flag: "wx" });
    } };
  }
  const transport = nodemailer.createTransport({
    host: config.host, port: config.port, secure: config.secure, requireTLS: !config.secure,
    auth: config.user ? { user: config.user, pass: config.password } : undefined,
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
    logger: false, debug: false,
  });
  return { async send(message) {
    await transport.sendMail({ ...message, from: config.from, disableFileAccess: true, disableUrlAccess: true });
  } };
}

/** O HTTP não aguarda SMTP, evitando expor a existência da conta pelo tempo de envio. */
export class MailQueue {
  private tasks = new Set<Promise<void>>();
  constructor(private mailer: Mailer) {}
  enqueue(message: MailMessage, onFailure: () => void) {
    if (this.tasks.size >= 100) { try { onFailure(); } catch { /* Limite da fila. */ } return; }
    const task = new Promise<void>(resolve => setImmediate(resolve)).then(() => this.mailer.send(message)).catch(() => { try { onFailure(); } catch { /* A entrega nunca gera uma rejeição não tratada. */ } });
    this.tasks.add(task);
    void task.finally(() => this.tasks.delete(task));
  }
  async drain() { await Promise.all([...this.tasks]); }
}
