/**
 * Score de compatibilidade entre estudante e demanda.
 *
 * Percentual das skills da demanda cobertas pelo estudante, por igualdade de
 * string sem diferenciar maiúsculas. Ver docs/analise-frontend.md, seção 5.
 */

import type { Demand, Student } from "@/types";

export function scoreStudent(student: Student, demand: Demand): number {
  const required = [...new Set(demand.skills.map(s => s.toLowerCase()))];
  if (!required.length) return 0;
  const available = new Set(student.skills.map(s => s.toLowerCase()));
  return Math.round((required.filter(s => available.has(s)).length / required.length) * 100);
}
