# VitrineIC — verificação local e pendências de validação no Render

Data: 22/10/2026. Referência inicial: commit `d11bdac`, com a correção do comando
de build do Render. As alterações descritas nesta revisão ainda precisam ser
incluídas no próximo commit e enviadas ao GitHub.

## Resultado

A suíte existente, a verificação de tipos e o build completo passaram.
A checagem interna do servidor com o frontend compilado também passou.
Não foi identificado bloqueio de compilação ou falha nos cenários executados.

Isso comprova os cenários abaixo no ambiente local disponível. Não equivale
a afirmar que todas as telas foram percorridas em navegador, que o serviço
publicado está saudável ou que não existem vulnerabilidades desconhecidas.

## Escopo e evidências

| Verificação | Resultado |
|---|---|
| `pnpm test` | 19 testes aprovados; zero falhas |
| `pnpm build` | Aprovado, incluindo TypeScript do frontend e backend, Vite e esbuild |
| Sintaxe dos executáveis compilados e backup | `node --check` sem erros |
| Imports relativos e alias `@/` | 542 referências verificadas em 139 arquivos; nenhuma ausente |
| Maiúsculas/minúsculas nos imports locais | Nenhuma divergência identificada que afetaria a resolução no Linux |
| Marcadores de conflito em código | Nenhum identificado |
| Artefatos de produção | `dist/index.html`, `build/server.mjs` e `build/create-curator.mjs` presentes |
| HTML e JavaScript servidos pelo Fastify | Respostas válidas na checagem interna |
| `/api/health` | Resposta `status: ok` |
| Rota desconhecida da API | 404 |
| Fallback de navegação do frontend | Página HTML servida |
| Bootstrap da curadoria em produção | Criação inicial e preservação da conta ao reabrir o banco |
| Login da curadoria em produção | Aprovado na checagem interna |
| Cookie de sessão em produção | Atributos Secure e HttpOnly presentes |
| Requisição com origem diferente | Rejeitada com 403 |
| Reabertura do mesmo arquivo SQLite | Dados preservados localmente |
| Arquivos privados no Git | Na consulta por `.env*`, bancos, `var/`, dependências e builds, somente `.env.example` está versionado |
| Regras de exclusão do Git | Cache, `.env`, `var/`, dependências e builds ignorados |
| Blueprint do Render | Node, um serviço Free, build sem `corepack enable`, start e health check coerentes |

A revisão cobriu configuração, scripts, fronteira HTTP, inicialização,
persistência, autorização, contrato do estado e cliente da API. Os arquivos
de código foram percorridos para conferir imports e marcadores de conflito;
essa contagem não representa auditoria manual de cada linha.

## Funcionalidades cobertas pelos 19 testes

- Cadastro de estudante/solicitante, login e logout.
- Domínio institucional, unidade/curso, campos inválidos e autorização por papel.
- Privacidade de contatos, matrícula e interesses.
- Candidatura, convite e sugestão com aceite duplo e recusa.
- Mensagens permitidas somente após liberação do contato.
- Perfil, projetos e sessões após reabertura do banco local.
- Proteções CSRF, limites de login e cookies de produção.
- Confirmação de e-mail, recuperação e troca de senha.
- Revogação de sessões, validade e consumo único dos tokens.
- Concorrência de redefinição, reenvio e tratamento de falha de entrega.
- Migração de banco existente.
- Anexos privados, formatos, upload, download e exclusão.
- Transporte de e-mail local e HTTPS simulado.
- Origem automática do Render e substituição por domínio próprio.
- Bootstrap que não promove outras contas nem redefine senha existente.
- Snapshot SQLite com WAL e BLOBs, sem substituir origem ou backup existente.

## Correções realizadas nesta revisão

### 1. Arquivo público de imagem

`public/logo.jpg` continha apenas um apontador Git LFS de 130 bytes, e não os
bytes de uma imagem. A imagem original estava disponível no cache LFS local.

O arquivo original foi restaurado após conferir seu SHA-256. O JPEG tem
50.853 bytes. Foi acrescentada uma exceção específica em `.gitattributes`
para manter esse arquivo pequeno diretamente no Git. Ao incluir a imagem e
essa regra no próximo commit, o deploy não dependerá de resolver o LFS para
esse arquivo. O build do frontend foi repetido e `dist/logo.jpg` contém o JPEG.

A busca no código atual não encontrou referência a `logo.jpg`; portanto,
esse problema não foi identificado como causa da falha anterior no Render.
Ele foi corrigido por ser um arquivo público que poderia ser servido incorretamente.

### 2. Contexto de build Docker

O `.dockerignore` passou a excluir `.cache/`, `.vite/`, `*.sqlite*` e `*.log`.
Isso evita enviar caches, bancos e logs locais no contexto de um build Docker.
O serviço Render configurado usa runtime Node, não depende dessa imagem.
Não foi executado um build Docker nesta revisão.

### 3. Guia de publicação

O `docs/render.md` foi atualizado para refletir que o serviço já foi criado,
registrar a correção de `corepack enable` e listar as evidências necessárias
para validar a publicação. O comando atual continua sendo:

```sh
pnpm install --frozen-lockfile --prod=false && pnpm build
```

## Avisos e limites encontrados

| Ponto | Efeito e encaminhamento |
|---|---|
| Bundle JavaScript de aproximadamente 677 kB, ou 175 kB gzip | Aviso do Vite, sem falha no build. Divisão de código pode melhorar o carregamento inicial; não foi feita refatoração de navegação nesta revisão. |
| Acesso do navegador ao servidor local | A tentativa retornou timeout. Não foi possível percorrer visualmente as telas nesse navegador. A checagem funcional do servidor usou `app.inject`. |
| Auditoria de dependências | `pnpm audit --prod --json` não concluiu por `ENOTFOUND registry.npmjs.org`. Não há resultado de auditoria de vulnerabilidades para afirmar ausência de alertas. Repetir em uma rede com acesso ao registro npm. |
| E-mail real | Não foi enviado e-mail externo. Testes usam transporte local ou simulação de HTTPS; entrega exige credenciais e remetente configurados. |
| Infraestrutura Render | A URL pública ainda não foi informada para esta verificação. O estado Live e os logs atuais não foram conferidos diretamente. |
| SQLite no Render Free | O banco é descartável na configuração adotada; a persistência local entre aberturas não comprova durabilidade na hospedagem. |
| Confirmação de e-mail no Blueprint Free | Desativada explicitamente para testes sem provedor de envio; não comprova posse do endereço cadastrado. |
| Rate limit atrás do proxy | Mantido em memória, com `trustProxy: false`; usuários podem compartilhar o IP percebido. Requer acompanhamento antes de tráfego maior. |
| Documentos históricos de contexto | Alguns descrevem o protótipo anterior. Para operação atual, priorizar `docs/backend.md` e `docs/render.md`. |

## O que ainda precisa ser validado no serviço publicado

1. Último commit e configuração sincronizados no Render; deploy concluído.
2. Página pública, CSS/JS, fontes e comportamento visual em desktop e celular.
3. `/api/health` e `/api/state` na mesma origem HTTPS do frontend.
4. Cadastro, login, logout e manutenção da sessão após recarregar a página.
5. Onboarding, competências e aparecimento do estudante na vitrine.
6. Projeto, demanda, triagem, candidatura/convite/sugestão e aceite duplo.
7. Privacidade de contatos antes do aceite e liberação após os dois aceites.
8. Upload/download de um anexo sintético e notificações/mensagens.
9. Segurança da conta e entrega de confirmação/recuperação, caso o envio esteja habilitado.
10. Comportamento esperado do armazenamento escolhido. No Free atual, não se
    deve prometer preservação dos dados após troca de instância ou suspensão.

Essas operações devem utilizar dados e contas descartáveis de teste. Não
executar testes de carga nem apagar banco ou dados reais como parte da conferência.

## Informações para enviar

- URL pública HTTPS do site.
- Status do deploy, commit e logs recentes de build/inicialização.
- Build Command, Start Command e Health Check Path.
- Valores não secretos de `NODE_ENV`, `HOST`, `DATABASE_PATH`, `DEMO_MODE`,
  `MAIL_MODE`, `REQUIRE_VERIFIED_EMAIL` e `APP_ORIGIN`, quando definido.
- Caso haja erro: tela/ação, mensagem e Console/Network sanitizados.

Ocultar senhas, chaves, cookies e tokens. Não enviar o `.env` completo.
Contas privadas, se precisarem de validação acompanhada, devem ser de teste.

## Próximo commit

As alterações desta revisão estão em `.dockerignore`, `.gitattributes`,
`public/logo.jpg`, `docs/render.md` e neste relatório. Os scripts temporários
de verificação permanecem fora do Git, conforme `.gitignore`.

Depois de revisar:

```powershell
git add .dockerignore .gitattributes public/logo.jpg docs/render.md docs/verificacao-projeto.md
git commit -m "fix: ajuste arquivos de publicacao e registre verificacao"
git push origin main
```

Nenhum push, deploy ou contratação foi realizado automaticamente nesta revisão.
