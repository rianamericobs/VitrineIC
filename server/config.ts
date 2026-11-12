import { z } from "zod";
import { INSTITUTION } from "@/data/institution";

export interface MailConfig {
  mode: "disabled" | "file" | "smtp" | "resend";
  directory: string;
  from: string;
  host?: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  apiKey?: string;
}

export interface Config {
  /** Conexão PostgreSQL. */
  databaseUrl: string;
  origin: string;
  production: boolean;
  demo: boolean;
  logger: boolean;
  requireVerifiedEmail: boolean;
  mail: MailConfig;
}

/**
 * Conexão PostgreSQL. Em desenvolvimento há um padrão local; em produção a URL
 * é obrigatória, para nunca cair num banco de conveniência sem querer.
 */
function readDatabaseUrl(env: NodeJS.ProcessEnv, production: boolean): string {
  const url = env.DATABASE_URL?.trim();
  if (!url) {
    if (production) throw new Error("Configure DATABASE_URL com a conexão PostgreSQL em produção.");
    // Cluster de desenvolvimento do próprio projeto; ver scripts/pg-dev.mjs.
    return "postgresql://vitrineic:vitrineic@localhost:5433/vitrineic";
  }
  const parsed = new URL(url);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("DATABASE_URL precisa ser uma conexão postgres:// ou postgresql://.");
  }
  return url;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const production = env.NODE_ENV === "production";
  const publicOrigin = env.APP_ORIGIN || (env.RENDER === "true" ? env.RENDER_EXTERNAL_URL : undefined);
  const origin = publicOrigin ?? "http://localhost:5173";
  if (production && (!publicOrigin || !origin.startsWith("https://"))) {
    throw new Error("Configure APP_ORIGIN com a URL HTTPS pública em produção.");
  }
  if (production && env.DEMO_MODE === "true") throw new Error("DEMO_MODE não é permitido em produção.");
  const mode = z.enum(["disabled", "file", "smtp", "resend"]).parse(env.MAIL_MODE ?? "disabled");
  const requireVerifiedEmail = env.REQUIRE_VERIFIED_EMAIL === undefined ? production : z.enum(["true", "false"]).parse(env.REQUIRE_VERIFIED_EMAIL) === "true";
  if (production && mode === "file") throw new Error("MAIL_MODE=file é exclusivo de desenvolvimento.");
  if (requireVerifiedEmail && mode === "disabled") throw new Error("Configure o envio de e-mail antes de exigir a confirmação do endereço.");
  if (mode === "smtp" && (!env.SMTP_HOST || !env.MAIL_FROM)) throw new Error("Configure SMTP_HOST e MAIL_FROM para enviar e-mails.");
  if (mode === "smtp" && Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASSWORD)) throw new Error("Configure SMTP_USER e SMTP_PASSWORD juntos.");
  if (mode === "resend" && (!env.RESEND_API_KEY || !env.MAIL_FROM)) throw new Error("Configure RESEND_API_KEY e MAIL_FROM para enviar e-mails via HTTPS.");
  const port = z.coerce.number().int().min(1).max(65535).parse(env.SMTP_PORT ?? 587);
  return {
    databaseUrl: readDatabaseUrl(env, production),
    origin: new URL(origin).origin,
    production,
    demo: !production && env.DEMO_MODE === "true",
    logger: true,
    requireVerifiedEmail,
    mail: {
      mode, directory: env.MAIL_DIRECTORY ?? "./var/mail",
      from: z.string().email().parse(env.MAIL_FROM ?? INSTITUTION.contactEmail),
      host: env.SMTP_HOST, port,
      secure: env.SMTP_SECURE === undefined ? port === 465 : z.enum(["true", "false"]).parse(env.SMTP_SECURE) === "true",
      user: env.SMTP_USER, password: env.SMTP_PASSWORD,
      apiKey: env.RESEND_API_KEY,
    },
  };
}
