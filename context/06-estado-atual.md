# Estado atual

> Atualização de 21/10/2026: o backend foi implementado e integrado. A referência
> atual de execução, persistência, segurança e endpoints é [docs/backend.md](../docs/backend.md).
> As menções abaixo a ausência de backend ou simulação descrevem o protótipo anterior.

Referência: commit `feat: Todas as telas` mais a remoção do Figma Make e a
reorganização de `src/`. Análise completa em `docs/analise-frontend.md`.

## Números

| | |
|---|---|
| Linhas em `src/` | ~6600 |
| Arquivos | 60 |
| Telas | 20 |
| Maior arquivo | `LandingPage.tsx (371 linhas)` |
| Bundle | ~349 kB (90 kB gzip) |

## Maturidade por fluxo

O que separa "tela pintada" de "funcionalidade":

| Fluxo | Estado |
|---|---|
| Triagem e sugestão (curadoria) | **Funcional** — muda estado e cria sugestões que as outras áreas veem |
| Cadastro de projeto (laboratório) | **Funcional** — a lista cresce de verdade |
| Interesses do estudante (candidatar, aceitar, recusar) | **Funcional** — store compartilhado entre as áreas |
| Catálogo público, perfis e impacto | **Funcional** — derivados de `data/students.ts` |
| Onboarding do estudante | **Funcional** — 4 passos gravam no `Student` a cada "Continuar"; dá para pular e voltar pelo painel |
| Nova demanda (wizard) | **Funcional** — grava a demanda como `nova` na triagem |
| Interessados do solicitante (aceitar, recusar, convidar) | **Funcional** — store compartilhado entre as áreas |
| Notificações | **Estático** |
| Autenticação | **Simulada (localStorage)** — login, cadastro de estudante e solicitante, sessão que sobrevive ao reload; curadoria só com conta da lista. Senha em texto puro |
| Nav pública (Projetos, Estudantes, Impacto) | **Funcional** — levam às páginas públicas |

**O fluxo de match funciona ponta a ponta nas três portas** (candidatura,
convite e sugestão), com aceite dos dois lados antes de liberar o contato. As
três áreas leem a mesma base de demandas e interesses (ver `03-dominio.md`).

Ao receber uma tarefa, confira nessa tabela o que já existe: pedir para "salvar
a demanda" pode significar implementar persistência do zero, não ajustar um
formulário.

## Aderência ao escopo

| Requisito | Estado |
|---|---|
| Vitrine de projetos | ✅ `student/Lab.tsx` |
| Mural de demandas | ✅ `requester/Dashboard.tsx` |
| Sugestão da curadoria | ✅ `curator/Matchmaking.tsx`, com justificativa obrigatória |
| Crivo humano | ✅ triagem + sugestão justificada + acompanhamento |
| Contato após o match | ✅ liberado com o aceite de estudante e solicitante |
| Vitrine pública (sem login) | ✅ catálogo, projeto e perfil público |
| Indicadores para a ACE1 | ✅ `public/Impact.tsx`, derivados da base |
| Avisos de demandas compatíveis | ⚠️ notificações abrem os convites, mas são fixas |
| Persistência | ⚠️ só no navegador (`lib/persist.ts`), sem backend |
| Autenticação | ⚠️ simulada no navegador, sem servidor |

**As três peças inegociáveis existem.** O crivo humano deixou de ser espaço
reservado no design e virou fila de triagem com estados, passo de seleção e
justificativa do curador.

## Prioridades

Em ordem de dependência:

1. **Backend de verdade** para contas e dados: hoje `lib/persist.ts` e
   `lib/auth.ts` são o ponto de troca, e a senha fica em texto puro.
2. **Unificar "Meus projetos"** do estudante com `student.projects`: a lista
   do laboratório ainda é local à área.
3. **Conferir os cursos das unidades fora do IC** em `data/institution.ts`.
4. **Extrair o compartilhado** (`NavBar`, `Label`, `Input`, `Rule`,
   `StatusBadge`) antes que as cópias divirjam mais.
5. **Evoluir o `scoreStudent`** aproveitando os níveis de proficiência já
   coletados e normalizando nomes de tecnologia.
6. **Roteamento por URL.**

## Perguntas ainda abertas

Do brainstorming da equipe (`docs/perguntas-brainstorming.md`), as que seguem
sem resposta e afetam implementação:

- O público é só do IC ou de outros institutos? Define o modelo de autenticação.
- Quem faz o crivo: equipe, professor, comitê de alunos? Define papéis e
  permissões.
- Que impacto a ACE1 precisa demonstrar: usuários, projetos, matches,
  depoimentos? Define que métricas instrumentar.

**Se uma tarefa depender de uma dessas respostas, pergunte em vez de arbitrar.**

## Riscos ao mexer no código

- **Não há testes.** A verificação é `pnpm typecheck`, `pnpm build` e percorrer
  o fluxo no navegador.
- **Não há persistência.** Reload zera tudo; teste fluxos inteiros sem
  recarregar.
- **Dados fictícios.** Não trate nenhum nome ou número como real.
- **Primitivas duplicadas.** Alterar uma não propaga para as áreas irmãs.
- **Um pull pode reintroduzir o Figma Make.** Se `.figma/` reaparecer, é
  regressão.
