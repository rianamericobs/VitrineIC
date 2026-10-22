# VitrineIC

Plataforma de projetos e demandas da universidade, criada no Instituto de
Computação para as disciplinas de Programação 3 e ACE 1.

O frontend React está conectado a uma API TypeScript com Fastify e SQLite.
Contas, sessões, perfis, projetos, demandas, interesses, notificações e anexos
são persistidos no servidor.

## Executar

Requer Node 22.13+ ou 24 LTS e pnpm 10.34.3.

```powershell
pnpm install
Copy-Item .env.example .env
pnpm dev
```

Abra **http://localhost:5173**. A API usa a porta 3001 e o banco é criado em
`var/vitrineic.sqlite`. O banco começa vazio.

Para carregar os exemplos, configure `DEMO_MODE=true` no `.env` e execute
`pnpm db:seed` antes de iniciar. Essa operação exige banco vazio.

| Perfil | E-mail de exemplo | Senha de exemplo |
|---|---|---|
| Estudante | estudante@ic.ufal.br | demo1234 |
| Solicitante | contato@techbr.com.br | demo1234 |
| Curadoria | curadoria@ic.ufal.br | demo1234 |

As contas de exemplo são exclusivas do desenvolvimento. Senhas cadastradas
são armazenadas com scrypt; a sessão usa cookie HttpOnly. Não há cadastro
público de curadoria. Consulte [criação de curadores e configuração](docs/backend.md).

## Fluxos

- **Público:** catálogo de projetos, estudantes com competências e indicadores
  agregados. E-mails de contato não são públicos.
- **Estudante:** cadastro institucional, onboarding, perfil, projetos,
  candidatura, resposta a convites, notificações e anexos privados.
- **Solicitante:** cadastro da organização, demandas, convites, resposta a
  candidaturas, equipe com contatos liberados e mensagens.
- **Curadoria:** triagem de demandas, ranking, sugestão com justificativa e
  acompanhamento de interesses.

Candidatura pressupõe o aceite do estudante; convite pressupõe o aceite do
solicitante. Sugestão da curadoria exige primeiro o estudante e depois o
solicitante. Os contatos só são enviados pela API após aceite duplo.
O algoritmo ordena os perfis; a decisão da curadoria continua humana.

Os projetos do portfólio e da vitrine compartilham a mesma base. Os indicadores
são derivados do banco. Notificações correspondem a operações reais e
mensagens entre as partes ficam disponíveis após a liberação do contato.

Recuperação de senha está disponível no login. **Conta e segurança** permite
confirmar o e-mail, trocar senha e sair de todas as sessões. Em desenvolvimento,
`MAIL_MODE=file` grava as mensagens em `var/mail`, sem envio externo.

## Comandos

| Comando | Finalidade |
|---|---|
| `pnpm dev` | API e Vite com atualização automática |
| `pnpm dev:api` / `pnpm dev:web` | Executar uma camada separadamente |
| `pnpm typecheck` | Tipos do frontend e backend |
| `pnpm test` | Testes de integração da API |
| `pnpm build` | Tipos e builds de produção |
| `pnpm start` | API e frontend compilados na mesma porta |
| `pnpm db:seed` | Carga explícita de exemplos em desenvolvimento |
| `pnpm db:backup` | Snapshot consistente de SQLite; exige `BACKUP_PATH` |
| `pnpm curator:create` | Criar curador usando variáveis de ambiente |

## Estrutura

| Diretório | Conteúdo |
|---|---|
| `src/components` | Telas React |
| `src/lib` | Cliente da API, cache, autenticação e regras compartilhadas |
| `src/types` | Tipos do domínio e respostas da API |
| `src/data` | Catálogos, identidade institucional e sementes fictícias |
| `server` | API, validações, autorização, banco e comandos administrativos |
| `server/tests` | Testes de integração |
| `docs/backend.md` | Configuração, endpoints, regras e operação |
| `context` | Contexto do produto; alguns documentos registram o protótipo anterior |

## Publicação

Frontend e backend são servidos juntos por um Web Service no Render.
O [guia do Render](docs/render.md) explica a publicação com o `render.yaml`
gratuito, criação da curadoria sem shell, e-mail via HTTPS e backups.

**O plano gratuito usa SQLite descartável:** contas, projetos, demandas e anexos
se perdem em deploys, reinícios e suspensão por inatividade. Essa configuração
é para testes, com e-mail desativado e sem confirmação de posse do endereço.
Para dados duráveis mantendo SQLite, será necessário serviço com disco
persistente; nenhum recurso pago foi ativado. O guia também descreve essa
configuração e as limitações de usar banco externo com a implementação atual.

Há também um Dockerfile e configuração anterior da Railway. Veja
[o guia de operação](docs/backend.md) para o contrato da API e segurança.

A navegação continua por estado React; links de acesso por e-mail usam fragmentos.
Identidade institucional externa e antivírus não fazem parte desta implementação.
Os dados antigos do localStorage não são importados; o armazenamento antigo,
que continha senhas em texto puro, é removido na inicialização.
