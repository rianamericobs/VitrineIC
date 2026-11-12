/**
 * Vocabulário das demandas: áreas e escopos.
 *
 * Vivia dentro de `NewDemandWizard.tsx`. Saiu de lá porque o servidor carrega
 * estes valores nos catálogos `area` e `escopo_demanda` (ver
 * `server/db/sync-catalog.ts`) e não pode importar um componente React.
 */

export const AREA_OPTIONS = [
  "Inteligência Artificial / ML",
  "Engenharia de Software",
  "Sistemas Web / Mobile",
  "Redes & Segurança",
  "Banco de Dados / Dados",
  "Computação em Nuvem",
  "Robótica / Embarcados",
  "Bioinformática",
  "Outra área",
];

/** O número é o teto em meses, usado para ordenar o catálogo. */
export const SCOPE_OPTIONS: { rotulo: string; mesesMax: number | null }[] = [
  { rotulo: "Pequeno (< 3 meses)", mesesMax: 3 },
  { rotulo: "Médio (3–6 meses)", mesesMax: 6 },
  { rotulo: "Grande (6–12 meses)", mesesMax: 12 },
];

export const SCOPE_LABELS = SCOPE_OPTIONS.map(s => s.rotulo);
