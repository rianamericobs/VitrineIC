import { buildApp } from "./app";
import { bootstrapCurator } from "./curator";

const { app, db } = await buildApp();
try {
  if (process.env.RENDER === "true" && process.env.DATABASE_PATH?.startsWith("/tmp/")) {
    app.log.warn("SQLite temporário: dados serão perdidos em reinícios, deploys e suspensão do Render. Use somente para testes.");
  }
  if (await bootstrapCurator(db)) app.log.info("Conta inicial de curadoria criada. Remova as variáveis de bootstrap quando houver disco persistente.");
  await app.listen({ port: Number(process.env.PORT ?? 3001), host: process.env.HOST ?? (process.env.RENDER === "true" ? "0.0.0.0" : "127.0.0.1") });
} catch (error) {
  await app.close();
  throw error;
}
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => { void app.close().then(() => process.exit(0)); });
}
