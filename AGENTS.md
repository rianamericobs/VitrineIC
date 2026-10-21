# VitrineIC

React + Vite + Tailwind CSS v4. Vitrine de projetos e demandas do Instituto de
Computação.

## Servidor de desenvolvimento

```bash
pnpm install
pnpm dev
```

Sobe em `http://localhost:5173` com hot reload.
Outros scripts: `pnpm build` (typecheck + build), `pnpm preview`, `pnpm typecheck`.

## Onde mexer

Cada componente tem seu arquivo. **Abra só o que a tarefa pede** — não leia
`src/` inteiro nem varra as pastas de área.

### Área pública

| Tarefa | Arquivo |
|---|---|
| Landing: nav, hero, stats, destaques, CTA, rodapé | `src/components/landing/LandingPage.tsx` |
| Modal de acesso e abas | `src/components/landing/AuthModal.tsx` |
| Formulários de login | `src/components/landing/SignInForm.tsx` (usado por `StudentForm.tsx`, `CompanyForm.tsx`) |
| Cadastro de estudante e de solicitante | `src/components/landing/StudentSignUp.tsx`, `RequesterSignUp.tsx` |
| Campo, seleção, divisor, faixa de erro | `src/components/landing/ui.tsx` |
| Roteamento entre áreas (pela sessão) | `src/App.tsx` |

### Páginas públicas — `src/components/public/`

| Tarefa | Arquivo |
|---|---|
| Casca e navegação pública | `PublicArea.tsx`, `PublicNav.tsx` |
| Catálogo de projetos (vitrine pública) | `ProjectsCatalog.tsx` |
| Página de um projeto | `ProjectDetail.tsx` |
| Diretório de estudantes | `StudentsDirectory.tsx` |
| Perfil público do estudante | `PublicProfile.tsx` |
| Indicadores da ACE1 | `Impact.tsx` |
| Tipos das rotas públicas | `routes.ts` |

### Área do estudante — `src/components/student/`

| Tarefa | Arquivo |
|---|---|
| Shell e troca de telas | `StudentArea.tsx` |
| Onboarding (fluxo) | `Onboarding.tsx`, `StepIndicator.tsx` |
| Onboarding: perfil / skills / idiomas / portfólio | `Step1.tsx` a `Step4.tsx` |
| Seleção de competências (busca + catálogo) | `SkillPicker.tsx` |
| Seletor de nível de proficiência | `LevelPicker.tsx` |
| Dashboard e notificações | `Dashboard.tsx` |
| Oportunidades (demandas abertas e candidatura) | `Opportunities.tsx` |
| Interesses: candidaturas, convites e sugestões | `Interests.tsx` |
| Meus projetos e selo "em projeto" | `Projects.tsx` |
| Laboratório (vitrine de projetos) | `Lab.tsx`, `StatusBadge.tsx` |
| Barra de navegação da área | `NavBar.tsx` |
| Label, Input, Rule, Tag | `ui.tsx` |

### Área do solicitante — `src/components/requester/`

| Tarefa | Arquivo |
|---|---|
| Shell e troca de telas | `RequesterArea.tsx` |
| Mural de demandas | `Dashboard.tsx` |
| Wizard de nova demanda (4 passos) | `NewDemandWizard.tsx` |
| Tela de sucesso e protocolo | `SuccessScreen.tsx` |
| Interessados (aceitar/recusar) | `MatchScreen.tsx` |
| Vitrine de estudantes e convite | `AvailableStudents.tsx` |
| Status das demandas | `StatusBadge.tsx` |
| Barra de navegação da área | `NavBar.tsx` |
| Label, Input, SelectField, Rule | `ui.tsx` |

### Área da curadoria — `src/components/curator/`

| Tarefa | Arquivo |
|---|---|
| Shell e troca de telas | `CuratorArea.tsx` |
| Login da curadoria (sem cadastro aberto) | `CuratorSignIn.tsx` |
| Triagem (kanban) | `Triage.tsx` |
| Matchmaking e ranking | `Matchmaking.tsx` |
| Sugestão com justificativa | `ConfirmModal.tsx` |
| Sugestão enviada | `MatchConfirmed.tsx` |
| Acompanhamento de todos os interesses | `InterestsOverview.tsx` |
| Status e colunas do kanban | `StatusBadge.tsx` |
| Barra de navegação da área | `NavBar.tsx` |
| Label, Mono, Rule, SkillTag | `ui.tsx` |

### Transversais

| Tarefa | Arquivo |
|---|---|
| Algoritmo de match | `src/lib/match.ts` |
| Regras do fluxo de interesse | `src/lib/interest.ts` |
| Estado compartilhado (estudantes, solicitantes, contas, sessão, demandas, interesses) | `src/lib/store.ts` |
| Cliente de login, cadastro, sessão e segurança da conta | `src/lib/auth.ts` |
| Contas de demonstração | `src/data/accounts.ts` |
| Cliente HTTP e inicialização da API | `src/lib/api.ts`, `src/components/app/ApiBoundary.tsx` |
| Regra "perfil aparece na vitrine" e rascunho do perfil | `src/lib/profile.ts` |
| Regras de validação de formulário | `src/lib/validate.ts`, `src/components/app/FieldError.tsx` |
| Base de demandas e de interesses | `src/data/demands.ts`, `src/data/interests.ts` |
| Base de estudantes e projetos | `src/data/students.ts` |
| Insumos do painel de impacto | `src/data/impact.ts` |
| Universidade, domínios e cursos | `src/data/institution.ts` |
| Tipos do domínio | `src/types/index.ts` |
| Cores | `src/styles/tokens.ts` e `src/index.css` |
| Conteúdo exibido (fictício) | `src/data/` |

### Backend

| Tarefa | Arquivo |
|---|---|
| Inicialização da API e configuração | `server/app.ts`, `server/index.ts`, `server/config.ts` |
| Banco e migrações | `server/database.ts`, `server/migrations.ts` |
| Login, cadastro e sessões | `server/auth-routes.ts`, `server/security.ts` |
| Recuperação, confirmação e troca de senha | `server/account-routes.ts`, `server/account-tokens.ts` |
| E-mail SMTP e captura local | `server/mail.ts` |
| Perfis, projetos, demandas e interesses | `server/domain-routes.ts`, `server/schemas.ts` |
| Dados filtrados por conta e indicadores | `server/views.ts` |
| Mensagens, notificações e anexos | `server/inbox-routes.ts`, `server/notifications.ts`, `server/file-routes.ts` |
| Contas de demonstração e criação de curadores | `server/seed.ts`, `server/create-curator.ts` |
| Testes de integração | `server/tests/` |
| Configuração e contrato HTTP | `docs/backend.md` |

## Contexto

`context/` reúne o contexto do projeto em arquivos curtos e temáticos. Comece
por `context/README.md`, que diz qual ler para cada tipo de tarefa:

| Arquivo | Assunto |
|---|---|
| `context/01-produto.md` | o que é o VitrineIC, usuários, escopo inegociável |
| `context/02-arquitetura.md` | stack, navegação, estrutura, dívida estrutural |
| `context/03-dominio.md` | entidades, status, algoritmo de match, dados |
| `context/04-design-system.md` | cores, tipografia, padrões visuais |
| `context/05-convencoes.md` | convenções de código |
| `context/06-estado-atual.md` | o que funciona de verdade e o que é fachada |
| `context/07-glossario.md` | termos do produto e siglas acadêmicas |

Análise longa do front-end — 14 telas, fluxograma, modelo de dados — em
`docs/analise-frontend.md`. Material original da equipe também em `docs/`.

## Convenções

- Alias `@` aponta para `src/`. Importe `@/components/...`, nunca `../../`
- Um componente por arquivo. Export nomeado entre componentes; export default
  só nas telas raiz (`LandingPage`, `StudentArea`, `RequesterArea`, `CuratorArea`)
- Aspas duplas em strings com apóstrofo (`"We're here to help"`)
- Estado fica no componente mais baixo possível; `App.tsx` só roteia

## Estilo

Tailwind CSS v4 via `@tailwindcss/vite`. `src/index.css` importa o Tailwind e
declara os tokens no bloco `@theme`. Não há config de Tailwind nem PostCSS.

Os mesmos tokens existem como constantes em `src/styles/tokens.ts` para os
estilos aplicados via `style={{}}`, que é como o código herdado do protótipo
funciona. **Em código novo, prefira as utilities** (`text-navy`, `font-serif`).

Identidade (inspirada no rulebase.co): azul-marinho `#0b2545` (constante `NAVY`),
vermelho `#c1121f` (constante `RED`), creme `#f3f1ec` (`OFFWHITE`); Inter Tight
(títulos), Geist (corpo), Geist Mono (rótulos em caixa alta). Superfícies escuras
texturizadas com a classe `.vt-stone`. Detalhes em `context/04-design-system.md`.

## Cuidados

- Tudo em `src/data/` é **fictício** — métricas, pessoas e demandas inventadas.
- Demandas e interesses têm **base única** (`data/demands.ts`,
  `data/interests.ts`) e um só vocabulário de status. As telas leem pelo
  `useVitrine` de `src/lib/store.ts` e alteram pelas funções dele; não crie
  outra base. O fluxo de match (candidatura, convite, sugestão, aceite duplo)
  está em `context/03-dominio.md`.
- Cada área tem seu próprio `ui.tsx` e `NavBar.tsx`, com implementações
  parecidas mas não idênticas. Ao mexer em uma, verifique as irmãs.
- O site atende **todos os institutos da UFAL** (o projeto é do IC). E-mail de
  estudante aceita qualquer `*.ufal.br`; unidades e cursos de cada uma vivem em
  `UNITS`, em `src/data/institution.ts` (os cursos fora do IC são exemplo).
  Não escreva "UFAL" nem nome de curso direto no componente.
- `src/data/students.ts` e `src/data/companies.ts` são só a **semente**. As
  telas leem estudantes e solicitantes do store (`useVitrine().students`,
  `findStudent`, `findCompany`), senão contas recém-criadas não aparecem.
- Perfil sem nenhuma competência **não aparece na vitrine** (diretório,
  catálogo, matchmaking, estudantes disponíveis) e não pode se candidatar. A
  regra é `isProfileVisible`, em `src/lib/profile.ts`; não a repita.
- Usuário logado vem de `useSession()` (`src/lib/auth.ts`). Não há mais ids
  fixos de estudante ou solicitante.
- Formulários seguem `useValidation` (`src/lib/validate.ts`): erro aparece ao
  enviar, some conforme a pessoa corrige, `aria-invalid` + mensagem ligada por
  `aria-describedby`, foco no primeiro campo inválido.
- Os números do painel de impacto são **derivados** das bases em tempo de
  render. Não digite indicadores em `data/impact.ts` — só o que não dá para
  derivar (depoimentos, metas) mora lá.
- **Persistência**: contas e mudanças ficam no SQLite do servidor. Senhas são
  hashes scrypt; sessões usam cookie HttpOnly. A chave antiga `vitrineic:v1`
  é removida na inicialização. Contas de exemplo, somente via seed em desenvolvimento
  (senha `demo1234`): `estudante@ic.ufal.br`, `contato@techbr.com.br`,
  `curadoria@ic.ufal.br`. Não há rota pública de restauração do banco.
- O backend valida permissões e filtra contatos; não confie em filtros do frontend.
- E-mail usa SMTP configurável ou arquivos locais de desenvolvimento. Em produção,
  a confirmação de posse é exigida por padrão; veja `docs/backend.md`.
- A navegação principal continua por estado; links de confirmação/recuperação
  usam fragmentos. `pnpm test`, `pnpm typecheck` e `pnpm build` verificam o projeto.
