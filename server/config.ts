import { z } from "zod";
import { INSTITUTION } from "@/data/institution";

export interface MailConfig {
  mode: "disabled" | "file" | "smtp";
  directory: string;
  from: string;
  host?: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
}

export interface Config {
  databasePath: string;
  origin: string;
  production: boolean;
  demo: boolean;
  logger: boolean;
  requireVerifiedEmail: boolean;
  mail: MailConfig;
}

export function readConfig(): Config {
  const production = process.env.NODE_ENV === "production";
  const origin = process.env.APP_ORIGIN ?? "http://localhost:5173";
  if (production && (!process.env.APP_ORIGIN || !origin.startsWith("https://"))) {
    throw new Error("Configure APP_ORIGIN com a URL HTTPS pública em produção.");
  }
  if (production && process.env.DEMO_MODE === "true") throw new Error("DEMO_MODE não é permitido em produção.");
  const mode = z.enum(["disabled", "file", "smtp"]).parse(process.env.MAIL_MODE ?? "disabled");
  const requireVerifiedEmail = process.env.REQUIRE_VERIFIED_EMAIL === undefined ? production : z.enum(["true", "false"]).parse(process.env.REQUIRE_VERIFIED_EMAIL) === "true";
  if (production && mode === "file") throw new Error("MAIL_MODE=file é exclusivo de desenvolvimento.");
  if (requireVerifiedEmail && mode === "disabled") throw new Error("Configure o envio de e-mail antes de exigir a confirmação do endereço.");
  if (mode === "smtp" && (!process.env.SMTP_HOST || !process.env.MAIL_FROM)) throw new Error("Configure SMTP_HOST e MAIL_FROM para enviar e-mails.");
  if (mode === "smtp" && Boolean(process.env.SMTP_USER) !== Boolean(process.env.SMTP_PASSWORD)) throw new Error("Configure SMTP_USER e SMTP_PASSWORD juntos.");
  const port = z.coerce.number().int().min(1).max(65535).parse(process.env.SMTP_PORT ?? 587);
  return {
    databasePath: process.env.DATABASE_PATH ?? "./var/vitrineic.sqlite",
    origin: new URL(origin).origin,
    production,
    demo: !production && process.env.DEMO_MODE === "true",
    logger: true,
    requireVerifiedEmail,
    mail: {
      mode, directory: process.env.MAIL_DIRECTORY ?? "./var/mail",
      from: z.string().email().parse(process.env.MAIL_FROM ?? INSTITUTION.contactEmail),
      host: process.env.SMTP_HOST, port,
      secure: process.env.SMTP_SECURE === undefined ? port === 465 : z.enum(["true", "false"]).parse(process.env.SMTP_SECURE) === "true",
      user: process.env.SMTP_USER, password: process.env.SMTP_PASSWORD,
    },
  };
}
