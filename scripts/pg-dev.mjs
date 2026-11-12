#!/usr/bin/env node
/**
 * Cluster PostgreSQL de desenvolvimento, exclusivo do projeto.
 *
 * Não encosta em nenhuma instância já instalada na máquina: cria a sua em
 * `var/pg16`, numa porta própria, acessível só pelo loopback. Assim dá para
 * trabalhar sem a senha do superusuário do sistema.
 *
 *   node scripts/pg-dev.mjs init    cria o cluster e o banco (uma vez)
 *   node scripts/pg-dev.mjs start   sobe o servidor
 *   node scripts/pg-dev.mjs stop    derruba o servidor
 *   node scripts/pg-dev.mjs status  diz se está no ar
 *
 * PG_BIN aponta para a pasta `bin` do PostgreSQL, se não for a padrão.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const PORT = process.env.PGDEV_PORT ?? "5433";
const USER = "vitrineic";
const PASSWORD = "vitrineic";
const DATA = resolve("var/pg16");
const LOG = resolve("var/pg16.log");

function binario(nome) {
  const candidatos = [
    process.env.PG_BIN,
    "C:/Program Files/PostgreSQL/16/bin",
    "C:/Program Files/PostgreSQL/17/bin",
    "/usr/lib/postgresql/16/bin",
    "/opt/homebrew/opt/postgresql@16/bin",
  ].filter(Boolean);
  const sufixo = process.platform === "win32" ? ".exe" : "";
  for (const pasta of candidatos) {
    const caminho = join(pasta, nome + sufixo);
    if (existsSync(caminho)) return caminho;
  }
  return nome + sufixo; // deixa o PATH resolver
}

function rodar(nome, args, opcoes = {}) {
  const r = spawnSync(binario(nome), args, { stdio: "inherit", ...opcoes });
  if (r.error) throw r.error;
  return r.status ?? 0;
}

function noAr() {
  return spawnSync(binario("pg_isready"), ["-h", "localhost", "-p", PORT], { stdio: "ignore" }).status === 0;
}

function init() {
  if (existsSync(DATA)) {
    console.log(`Cluster já existe em ${DATA}. Nada a fazer.`);
    return;
  }
  mkdirSync(resolve("var"), { recursive: true });
  const senha = join(tmpdir(), `vitrineic-initpw-${process.pid}`);
  writeFileSync(senha, PASSWORD);
  try {
    if (rodar("initdb", ["-D", DATA, "-U", USER, `--pwfile=${senha}`, "--encoding=UTF8", "--no-locale"]) !== 0) {
      throw new Error("initdb falhou.");
    }
  } finally {
    rmSync(senha, { force: true });
  }
  appendFileSync(join(DATA, "postgresql.conf"),
    `\n# VitrineIC: cluster isolado de desenvolvimento\nport = ${PORT}\nlisten_addresses = 'localhost'\n`);
  writeFileSync(join(DATA, "pg_hba.conf"),
    "# Cluster de desenvolvimento do VitrineIC - somente loopback, com senha.\n" +
    "host    all    all    127.0.0.1/32    scram-sha-256\n" +
    "host    all    all    ::1/128         scram-sha-256\n");
  start();
  const criado = spawnSync(binario("createdb"),
    ["-h", "localhost", "-p", PORT, "-U", USER, "-O", USER, "vitrineic"],
    { stdio: "inherit", env: { ...process.env, PGPASSWORD: PASSWORD } });
  if (criado.status !== 0) throw new Error("createdb falhou.");
  console.log(`\nBanco pronto: postgresql://${USER}:${PASSWORD}@localhost:${PORT}/vitrineic`);
  console.log("Agora rode: pnpm db:migrate");
}

/**
 * No Windows o servidor herda o console de quem o inicia, então um `pg_ctl`
 * em primeiro plano prende o terminal e morre junto com ele. `detached` com
 * stdio ignorado solta o processo de vez.
 */
function start() {
  if (noAr()) { console.log(`Já está no ar em localhost:${PORT}.`); return; }
  const filho = spawn(binario("pg_ctl"), ["-D", DATA, "-l", LOG, "-w", "start"], {
    detached: true, stdio: "ignore", windowsHide: true,
  });
  filho.unref();
  const dormir = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  for (let tentativa = 0; tentativa < 40; tentativa++) {
    dormir(300);
    if (noAr()) { console.log(`No ar em localhost:${PORT}.`); return; }
  }
  throw new Error(`Não subiu. Veja ${LOG}.`);
}

function stop() {
  if (!noAr()) { console.log("Já estava parado."); return; }
  rodar("pg_ctl", ["-D", DATA, "-m", "fast", "stop"]);
}

const comando = process.argv[2] ?? "status";
if (comando === "init") init();
else if (comando === "start") start();
else if (comando === "stop") stop();
else if (comando === "status") console.log(noAr() ? `No ar em localhost:${PORT}.` : "Parado.");
else {
  console.error(`Comando desconhecido: ${comando}. Use init, start, stop ou status.`);
  process.exit(1);
}
