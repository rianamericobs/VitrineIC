# Arquitetura

> Atualização de 21/10/2026: o backend foi implementado e integrado. A referência
> atual de execução, persistência, segurança e endpoints é [docs/backend.md](../docs/backend.md).
> As menções abaixo a ausência de backend ou simulação descrevem o protótipo anterior.

## Stack

| Camada | Escolha |
|---|---|
| UI | React 19 (`react`, `react-dom` — nenhuma lib de UI) |
| Build | Vite 8 |
| Linguagem | TypeScript 5.7+, `strict: true` |
| Estilo | Tailwind CSS v4 via `@tailwindcss/vite`, sem config file |
| Pacotes | pnpm 10.34.3, Node 22 (`.mise.toml`) |
| Roteador | **nenhum** |
| Estado global | **nenhum** — só `useState` local |
| Backend / API | **nenhum** — sem `fetch`, sem env var |
| Testes | **nenhum** |

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # tsc --noEmit && vite build
pnpm typecheck
```

O projeto foi gerado no Figma Make e essa dependência foi removida. Se
reaparecerem `.figma/`, plugins no `vite.config.ts` ou o nome `figma-make-app`,
é regressão — provavelmente um pull por cima da remoção.

## Navegação

**Não há roteador.** A navegação é estado, em dois níveis.

**Nível 1 — `src/App.tsx`**, a área ativa:

```tsx
type Area = "landing" | "student" | "requester" | "curator";
const [area, setArea] = useState<Area>("landing");
```

**Nível 2 — dentro de cada área**, um `view` controla a tela:

| Área | Valores de `view` |
|---|---|
| `StudentArea` | `dashboard`, `lab`, `profile` (+ flag `onboarded`) |
| `RequesterArea` | `dashboard`, `new`, `success`, `matches` |
| `CuratorArea` | `triage`, `matchmaking`, `confirm`, `confirmed` |

### Consequências que afetam qualquer tarefa

- **Não existe URL por tela.** Nada é compartilhável por link e o botão voltar
  do navegador não funciona dentro da aplicação.
- **Nada sobrevive ao reload.** O estudante refaz o onboarding, matches
  confirmados somem. Ao testar um fluxo, percorra-o inteiro sem recarregar.
- O acesso à curadoria é um botão `Admin` na nav pública, sem autenticação.

## Estrutura de pastas

```
src/
├── main.tsx                    entrypoint; monta App em #root
├── App.tsx                     roteamento entre áreas + modal de acesso
├── index.css                   Tailwind + tokens @theme + CSS global
├── components/
│   ├── landing/                LandingPage, AuthModal, StudentForm,
│   │                           CompanyForm, ui
│   ├── student/                StudentArea, Onboarding, Step1-3,
│   │                           StepIndicator, ProficiencyBars, Dashboard,
│   │                           Lab, StatusBadge, NavBar, ui
│   ├── requester/              RequesterArea, Dashboard, NewDemandWizard,
│   │                           SuccessScreen, MatchScreen, StatusBadge,
│   │                           NavBar, ui
│   └── curator/                CuratorArea, Triage, Matchmaking,
│                               ConfirmModal, MatchConfirmed, StatusBadge,
│                               NavBar, ui
├── data/                       conteúdo fictício, um arquivo por coleção
├── types/index.ts              Demand, DemandStatus, StatusKey
├── styles/tokens.ts            NAVY, RED, OFFWHITE
└── lib/match.ts                scoreStudent
```

Cada área é uma pasta com o mesmo formato: um shell (`XArea.tsx`) que troca as
telas, um arquivo por tela, um `NavBar.tsx` e um `ui.tsx` de primitivas.

Para achar o arquivo de uma tarefa, use a tabela em **`AGENTS.md`** em vez de
varrer `src/`.

## Dívida estrutural conhecida

**Ilhas com primitivas duplicadas.** Cada área reimplementa `Label`, `Rule`,
`NavBar` e `StatusBadge`. São versões *parecidas, não idênticas* — o `Label` do
solicitante tem uma prop `light` que os outros não têm. Mudança em uma não
propaga; ao alterar uma primitiva, verifique as irmãs.

**Bases de dados paralelas.** Ver `03-dominio.md`. É a prioridade estrutural
número um.

**Tokens em dois lugares.** As cores existem no `@theme` de `index.css` (que
gera as utilities do Tailwind) e como constantes em `styles/tokens.ts` (usadas
nos `style={{}}`). O código herdado do protótipo usa as constantes; as utilities
estão praticamente sem uso.
