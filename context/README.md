# Contexto do VitrineIC

> Atualização de 21/10/2026: o backend foi implementado e integrado. A referência
> atual de execução, persistência, segurança e endpoints é [docs/backend.md](../docs/backend.md).
> As menções abaixo a ausência de backend ou simulação descrevem o protótipo anterior.

Contexto curado para agentes de IA e para quem entra no projeto. Cada arquivo
cobre um assunto e é curto de propósito: **leia só o que a tarefa exige**.

| Arquivo | Leia quando |
|---|---|
| [01-produto.md](01-produto.md) | precisar saber o que o VitrineIC é, para quem, e o que não pode ser cortado |
| [02-arquitetura.md](02-arquitetura.md) | for mexer em estrutura, roteamento, build ou criar arquivo novo |
| [03-dominio.md](03-dominio.md) | for mexer em demanda, estudante, status ou no algoritmo de match |
| [04-design-system.md](04-design-system.md) | for escrever ou ajustar UI |
| [05-convencoes.md](05-convencoes.md) | for escrever código |
| [06-estado-atual.md](06-estado-atual.md) | precisar saber o que já funciona de verdade e o que é fachada |
| [07-glossario.md](07-glossario.md) | encontrar um termo que não reconhece |

## Ordem sugerida

Tarefa de UI: 04 → 05 → o arquivo do componente.
Tarefa de domínio ou dados: 03 → 06.
Tarefa estrutural: 02 → 06 → `docs/analise-frontend.md`.

## Onde está o resto

- **`AGENTS.md`** (raiz) — mapa tarefa → arquivo. É o ponto de partida para
  achar código sem varrer `src/`.
- **`docs/analise-frontend.md`** — análise longa: 14 telas, fluxograma completo,
  modelo de dados, maturidade por fluxo. Consulte para profundidade; estes
  arquivos de contexto são o resumo operacional.
- **`docs/modelo-de-negocio.md`** e **`docs/perguntas-brainstorming.md`** —
  material original da equipe.
- **`README.md`** (raiz) — visão do projeto escrita pela equipe. Atenção: está
  desatualizado em relação ao código (ver 01-produto.md).

## As cinco coisas que mais causam erro aqui

1. **Todo dado é fictício.** Nomes, métricas e demandas são inventados. Nada em
   `src/data/` é real.
2. **Existem bases paralelas.** `data/demands.ts` (curadoria) e
   `data/requester-demands.ts` (solicitante) não se comunicam. O sistema encena
   a integração.
3. **Cada área tem seu próprio `ui.tsx` e `NavBar.tsx`**, parecidos mas não
   idênticos. Mudança em um não propaga.
4. **Não há persistência.** Recarregar a página zera tudo.
5. **O README da raiz diverge do código** quanto a quem é o solicitante:
   universidade (README) versus empresa (código).
