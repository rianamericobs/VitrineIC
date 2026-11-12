/**
 * Datas do domínio.
 *
 * O banco guarda `date` (ISO, AAAA-MM-DD). A tela mostra em português. Antes
 * da migração para PostgreSQL os dois formatos conviviam no mesmo campo: a
 * semente de `src/data` trazia "15 dez 2026" e o que a API criava vinha em
 * ISO, então o prazo aparecia de um jeito ou de outro conforme a origem.
 */

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "15 dez 2026" e "2026-12-15" viram "2026-12-15". Devolve "" se não der. */
export function paraISO(valor: string): string {
  const texto = valor?.trim() ?? "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;

  const data = new Date(texto);
  if (!Number.isNaN(data.getTime()) && /^\d{4}-\d{2}-\d{2}T/.test(texto)) {
    return texto.slice(0, 10);
  }

  const partes = texto.toLowerCase().match(/^(\d{1,2})\s+([a-zç]{3,})\.?\s+(\d{4})$/);
  if (!partes) return "";
  const mes = MESES.indexOf(partes[2].slice(0, 3));
  if (mes < 0) return "";
  return `${partes[3]}-${String(mes + 1).padStart(2, "0")}-${partes[1].padStart(2, "0")}`;
}

const UNIDADES: Record<string, number> = { min: 60_000, h: 3_600_000, d: 86_400_000 };

/**
 * Timestamp a partir do que a semente traz. Aceita ISO e os rótulos relativos
 * ("há 2h", "há 1d"), que eram guardados no lugar da data. Devolve "" se não
 * der para interpretar — aí quem grava deixa o banco usar `now()`.
 */
export function paraTimestamp(valor?: string, agora: Date = new Date()): string {
  const texto = valor?.trim() ?? "";
  if (!texto) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) {
    const data = new Date(texto.length === 10 ? `${texto}T00:00:00Z` : texto);
    return Number.isNaN(data.getTime()) ? "" : data.toISOString();
  }
  const relativo = texto.toLowerCase().match(/^h[áa]\s+(\d+)\s*(min|h|d)$/);
  if (!relativo) return "";
  return new Date(agora.getTime() - Number(relativo[1]) * UNIDADES[relativo[2]]).toISOString();
}

/** "2026-12-15" vira "15 dez 2026". Texto que não for data volta inalterado. */
export function paraExibicao(valor?: string): string {
  const texto = valor?.trim() ?? "";
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!iso) return texto;
  return `${Number(iso[3])} ${MESES[Number(iso[2]) - 1]} ${iso[1]}`;
}
