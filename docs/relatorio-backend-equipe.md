# VitrineIC — relatório técnico do backend e da preparação para publicação

- **Data:** 22 de outubro de 2026.
- **Destinatários:** Arthur, Davi e demais integrantes da equipe.
- **Repositório:** <https://github.com/rianamericobs/VitrineIC>.

Este documento consolida o backend que está implementado no projeto, sua
integração com o frontend e os ajustes posteriores para publicar as duas partes
juntas no Render. Não representa apenas as alterações da última preparação.
Os caminhos citados são relativos à raiz do repositório.

## 1. Resultado da implementação

O frontend React passou a consumir uma API real. Contas, sessões, perfis,
projetos, demandas, interesses, notificações, mensagens e anexos são gravados no
SQLite do servidor. O estado no navegador funciona como cache das respostas,
e não como fonte de autoridade para permissões ou credenciais.

O backend valida os dados, identifica a conta pela sessão e decide o que cada
usuário pode consultar ou alterar. Ocultar um botão na interface não concede
nem substitui uma regra de autorização.

O mesmo processo Node serve a API em `/api` e o frontend compilado em `dist/`.
Isso permite publicar frontend e backend em um único Web Service, com uma URL.
O projeto não precisa de GitHub Pages para essa implantação.

**Situação da publicação:** os arquivos estão preparados localmente. Não foi
feito push, criado serviço no Render, contratado plano, comprado domínio ou
configurado provedor de e-mail real nesta preparação.

**Restrição central:** a implementação utiliza SQLite em arquivo. No ambiente
Render Free preparado, o arquivo é temporário. O código ter persistência não
significa que a hospedagem gratuita preserve o banco entre suas instâncias.

## 2. Stack e organização

| Camada | Implementação atual |
|---|---|
| Interface | React 19, Vite e Tailwind CSS v4 |
| API | TypeScript com Fastify 5 |
| Banco | SQLite pela API nativa `node:sqlite` |
| Validação de entrada | Zod |
| Senhas e tokens | `node:crypto` |
| Sessões | Cookie HttpOnly e registros no SQLite |
| Arquivos | Multipart; conteúdo armazenado como BLOB no SQLite |
| E-mail | Arquivos locais, SMTP ou Resend via HTTPS |
| Build do servidor | esbuild; saídas ESM em `build/` |
| Testes | `node:test`, executado com tsx |
| Pacotes | pnpm 10.34.3 |
| Node no deploy preparado | 24.22.1, definido em `.node-version` |

### Mapa dos arquivos principais

| Arquivo | Responsabilidade |
|---|---|
| `server/index.ts` | Inicialização, endereço/porta, bootstrap e encerramento |
| `server/app.ts` | Montagem do Fastify, proteções HTTP, rotas e arquivos do frontend |
| `server/config.ts` | Leitura e validação das variáveis de ambiente |
| `server/database.ts` | Conexão, esquema inicial, consultas e transações |
| `server/migrations.ts` | Evoluções versionadas do esquema |
| `server/security.ts` | Hash de senha, sessões e exigências de autenticação |
| `server/auth-routes.ts` | Login, logout e cadastros |
| `server/account-routes.ts` | Confirmação, recuperação, troca de senha e revogação de sessões |
| `server/account-tokens.ts` | Emissão, finalidade, validade e consumo de tokens |
| `server/domain-routes.ts` | Perfis, projetos, demandas, ranking e interesses |
| `server/schemas.ts` | Contratos de entrada e limites dos campos |
| `server/views.ts` | Estado filtrado por conta e indicadores agregados |
| `server/notifications.ts` | Notificações derivadas dos eventos do sistema |
| `server/inbox-routes.ts` | Leitura de notificações e mensagens entre as partes |
| `server/file-routes.ts` | Upload, download e exclusão de anexos privados |
| `server/mail.ts` | Transportes de e-mail e fila de entrega |
| `server/curator.ts` | Criação de curadores e bootstrap opcional |
| `server/create-curator.ts` | Comando administrativo de criação de curadoria |
| `server/seed.ts` | Carga explícita de dados fictícios em desenvolvimento |
| `scripts/build-server.mjs` | Build do servidor e do comando de curadoria |
| `scripts/backup-database.mjs` | Backup consistente do SQLite |
| `render.yaml` | Configuração de um Web Service gratuito no Render |

## 3. Banco de dados

### 3.1. Persistência e integridade

O banco local padrão é `var/vitrineic.sqlite`. O caminho pode ser alterado por
`DATABASE_PATH`. A aplicação cria o diretório e o esquema ao abrir o banco.

A conexão habilita:

- `foreign_keys=ON`, para verificar as referências entre tabelas;
- `journal_mode=WAL`, para registrar alterações no write-ahead log;
- `busy_timeout=5000`, para aguardar bloqueios do SQLite por até cinco segundos.

Operações que precisam permanecer consistentes usam transações com
`BEGIN IMMEDIATE`, `COMMIT` e `ROLLBACK`. Por exemplo, uma mudança de interesse
e suas notificações devem ser confirmadas juntas.

O modelo combina colunas relacionais com documentos JSON. Identificadores,
referências e campos usados em restrições ficam em colunas próprias; vários
atributos de domínio permanecem na coluna `data`, com JSON válido.
Não é um modelo totalmente normalizado.

### 3.2. Tabelas existentes

| Tabela | Conteúdo e observações |
|---|---|
| `migrations` | Versões de esquema já aplicadas |
| `students` | Perfil do estudante em JSON, com chave `id` |
| `companies` | Organizações solicitantes; o nome identifica a organização no modelo atual |
| `accounts` | Conta, papel e hash de senha; e-mail único sem diferenciação de maiúsculas/minúsculas; referências ao perfil |
| `demands` | Demanda, organização responsável e demais atributos em JSON |
| `interests` | Relação demanda/estudante, status e dados do interesse |
| `sessions` | Hash do token, conta e expiração da sessão |
| `notifications` | Notificações e mensagens, vinculadas à conta destinatária |
| `attachments` | Nome, categoria, estudante e bytes do anexo em BLOB |
| `account_tokens` | Hash, finalidade, conta, versão de credenciais e validade de tokens de confirmação/recuperação |

**Projetos não têm tabela própria nesta versão:** ficam no perfil JSON do
estudante, em `projects`. Mensagens internas também não têm tabela separada;
utilizam os registros de notificações. Isso precisa ser considerado em qualquer
redesenho ou migração do banco.

Há índices para consultas por organização, estudante, conta e validade.
Uma restrição única parcial impede dois interesses ativos para a mesma dupla
demanda/estudante. Interesses recusados não entram nessa restrição.

### 3.3. Migrações

O esquema inicial corresponde à versão 1. A migração 2 adiciona
`account_tokens` e seu índice de expiração. Cada versão é aplicada uma vez,
em transação, ao inicializar a aplicação.

O servidor rejeita um banco com versão de esquema mais nova do que conhece.
Uma evolução futura deve acrescentar uma migração e preservar os dados
existentes; não deve exigir apagar o banco ou reutilizar o seed como migração.
Faça backup antes de alterações de esquema.

### 3.4. Pontos para revisão de Davi

- O vínculo do solicitante usa o nome da organização como identificador.
  Trocar para um ID estável exige ajustar referências, contratos e frontend.
- Projetos e vários atributos ficam em JSON. Uma normalização futura exige
  migração dos documentos existentes, além de novas tabelas.
- Anexos aumentam diretamente o tamanho do banco e dos backups.
- Acesso atual ao banco é síncrono e usa consultas que podem carregar coleções
  completas. Paginação e consultas mais específicas são evoluções para volume maior.
- SQLite com disco local atende uma única instância. PostgreSQL não pode ser
  habilitado apenas definindo `DATABASE_URL`: não há adaptador implementado.

## 4. Autenticação e segurança das contas

### 4.1. Cadastro e login

Há cadastro público de estudante e solicitante. Não há cadastro público de
curadoria. O servidor valida e-mail, senha, campos obrigatórios e regras
específicas de cada perfil.

O cadastro de estudante aceita os domínios institucionais previstos em
`src/data/institution.ts`, incluindo subdomínios da instituição, e valida a
combinação unidade/curso. Verificar o formato/domínio é diferente de confirmar
que a pessoa controla a caixa de e-mail.

Um cadastro válido cria a conta e o perfil na mesma transação, abre a sessão
e solicita confirmação quando o envio de e-mail está habilitado.
O estudante começa sem competências e completa o perfil pelo onboarding.

O login confere as credenciais no servidor e pode validar o papel esperado.
Também executa derivação de senha para contas inexistentes, evitando uma
diferença trivial de custo entre e-mail encontrado e não encontrado.

### 4.2. Senhas

- Senhas não são persistidas em texto puro.
- O algoritmo é scrypt assíncrono, com salt aleatório individual.
- Parâmetros atuais: `N=32768`, `r=8`, `p=1` e chave derivada de 64 bytes.
- A comparação utiliza `timingSafeEqual`.
- O hash de senha e a versão interna das credenciais não integram a resposta
  pública da conta.

### 4.3. Sessões

O token aleatório tem 32 bytes (256 bits). O navegador recebe o token no cookie
`vitrine_session`; o banco armazena somente seu SHA-256.

O cookie usa `HttpOnly`, `SameSite=Strict`, `Path=/` e `Secure` em produção.
A validade atual é de sete dias. O cookie não é um JWT e não precisa ser lido
pelo JavaScript da aplicação. Logout revoga a sessão correspondente no banco.

### 4.4. Confirmação e recuperação

Foram implementados:

- solicitação e confirmação de posse do e-mail;
- recuperação de senha com resposta genérica, sem revelar se o e-mail existe;
- redefinição por token de uso único;
- troca de senha autenticada, exigindo a senha atual;
- encerramento de todas as sessões da conta.

Tokens têm finalidade específica, 256 bits aleatórios e apenas o hash no banco.
Recuperação expira em 30 minutos; confirmação, em 24 horas. Há intervalo de
um minuto para reenvio por conta/finalidade e limites adicionais por IP.

A redefinição invalida tokens anteriores e sessões da conta; não realiza login
automático. A troca autenticada renova a sessão em uso e encerra as demais.
O consumo do token é revalidado em transação após o cálculo assíncrono do hash,
para impedir redefinições concorrentes com o mesmo link.

Links utilizam fragmentos `#account/...`, que não são enviados ao servidor
na requisição HTTP da página. A interface pede confirmação da ação antes de
consumir o token.

Quando `REQUIRE_VERIFIED_EMAIL=true`, operações como publicação, envio de
anexos e participação no fluxo de interesses exigem confirmação. O usuário
ainda pode entrar, editar seu perfil e solicitar o link de confirmação.

## 5. Proteções HTTP e permissões

Mutações em `/api` exigem `X-Vitrine-Client: web`. Quando há cabeçalho `Origin`,
ele deve corresponder à origem configurada. Requisições identificadas como
`Sec-Fetch-Site: cross-site` são rejeitadas. Não há liberação pública de CORS.

Também foram configurados limites de requisições, limites de corpo e upload,
cabeçalhos de segurança e tratamento de erros. Respostas da API usam
`Cache-Control: no-store`; cookies e autorização são ocultados dos logs HTTP.

O limite global atual é de 240 requisições por minuto. Login e cadastro usam
limite de 10 por minuto; rotas de segurança da conta têm limites mais restritos.
Os limites são mantidos em memória. O servidor não confia por padrão em
`X-Forwarded-For`; atrás de proxy, vários usuários podem compartilhar o mesmo
IP percebido. Essa configuração deve ser revisada antes de tráfego real maior.

A sessão determina o proprietário e o papel. Enviar um `studentId`, um papel
ou um identificador de organização no corpo não concede acesso àquela conta.

Os erros têm formato `{ error, fields? }`. São utilizados códigos como 400
(validação), 401 (sem sessão válida), 403 (sem permissão/origem), 404, 409
(conflito), 413 (tamanho), 429 (limite) e 503 (serviço indisponível).
Erros internos não expõem stack trace na resposta ao cliente.

## 6. Regras de negócio executadas no servidor

### 6.1. Perfis, projetos e demandas

- Estudante altera o próprio perfil e seus projetos.
- Solicitante altera sua organização e cria demandas vinculadas a ela.
- Nova demanda entra no estado `nova`, sujeita à triagem da curadoria.
- A curadoria executa as transições de status permitidas.
- Demandas precisam estar aprovadas para receber novos interesses.
- Não se pode apagar indiscriminadamente demandas com histórico de interesses.
- Perfil sem competências não aparece na vitrine e não pode se candidatar.
- Com confirmação obrigatória, a vitrine também exige a conta confirmada.
- O selo de participação em projeto continua sendo declarado pelo estudante.

As regras comuns de visibilidade e fluxo utilizam `src/lib/profile.ts` e
`src/lib/interest.ts`. O ranking utiliza o algoritmo de `src/lib/match.ts`.
O ranking apoia a curadoria; não substitui sua decisão.

### 6.2. Interesses e aceite duplo

| Origem | Aceite inicial | Resposta seguinte | Resultado após os aceites |
|---|---|---|---|
| Candidatura | Estudante, ao se candidatar | Solicitante | `contato_liberado` |
| Convite | Solicitante, ao convidar | Estudante | `contato_liberado` |
| Sugestão da curadoria | Nenhum aceite das partes é presumido | Estudante; depois solicitante | `contato_liberado` |

A sugestão exige justificativa. A API identifica de quem é o turno e rejeita
respostas de outra pessoa ou fora do momento permitido. Uma recusa encerra
o interesse com o status correspondente.

Uma sugestão aguardando resposta do estudante, ou recusada por ele, não é
apresentada ao solicitante. O motivo de recusa do solicitante não é devolvido
ao estudante. A curadoria não pode definir contato liberado arbitrariamente.

### 6.3. Privacidade das respostas

`server/views.ts` monta o estado autorizado para cada sessão. O visitante não
recebe todas as contas nem os interesses privados. Cada conta recebe seus
dados e os registros permitidos pelo papel e pela participação no fluxo.

E-mails de contato de outra parte só são liberados após os dois aceites.
Nem a curadoria recebe esses contatos antecipadamente na resposta do estado.
Matrícula, certificados e anexos também recebem tratamento específico de acesso.

## 7. Notificações, mensagens e anexos

Notificações passaram a decorrer de operações reais e são persistidas.
Marcar uma notificação como lida altera somente o registro da conta autenticada.

Mensagens internas só podem ser enviadas entre as partes de um interesse com
contato liberado. Não foi implementado um chat geral ou WebSocket.

Os anexos têm três categorias: `tech`, `language` e `portfolio`.
Certificados aceitam PDF; portfólio aceita PDF, DOCX e ZIP. Limites atuais:
20 MB por arquivo, 20 arquivos e 100 MB por estudante.

O backend limpa o nome, verifica extensão e assinatura básica, não extrai ZIP
e devolve o arquivo como download. O conteúdo fica no banco, fora de `dist/`.
O download exige o estudante proprietário ou um curador; a exclusão é do dono.
**A validação de assinatura não equivale a antivírus.**

## 8. E-mail

| `MAIL_MODE` | Comportamento |
|---|---|
| `disabled` | Sem envio; solicitação de links por e-mail indisponível |
| `file` | Gera `.eml` para desenvolvimento; recusado em produção |
| `smtp` | Nodemailer com TLS, credenciais e remetente configurados |
| `resend` | Requisição HTTPS ao serviço Resend com chave de API |

O modo Resend foi acrescentado na preparação para o Render. Ele usa o `fetch`
nativo, timeout de 15 segundos e rejeição de redirecionamentos. Não registra
o corpo devolvido pelo provedor, que poderia conter dados sensíveis.

A fila de entrega é assíncrona e limitada a 100 mensagens em memória.
O encerramento normal aguarda as entregas em andamento. Falha de envio invalida
o token correspondente. Não há fila durável nem retentativa automática.
Em falha ou queda abrupta, o usuário deve solicitar outro link.

E-mail real ainda depende de credenciais, remetente autorizado e configuração
do provedor. Não foi feita entrega real de e-mail durante os testes de transporte.

## 9. Contrato HTTP

Todas as rotas abaixo incluem o prefixo `/api`. Para JSON, enviar
`Content-Type: application/json`. Em POST, PATCH, PUT e DELETE, enviar também
`X-Vitrine-Client: web`. O navegador transmite o cookie da mesma origem.

| Método | Rota | Finalidade |
|---|---|---|
| GET | `/api/health` | Saúde da aplicação e consulta básica ao banco |
| GET | `/api/state` | Estado filtrado pela sessão |
| GET | `/api/impact` | Indicadores agregados |
| POST | `/api/auth/students` | Cadastro de estudante |
| POST | `/api/auth/requesters` | Cadastro de solicitante |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Encerrar sessão atual |
| GET | `/api/auth/me` | Consultar estado autenticado |
| POST | `/api/auth/forgot-password` | Solicitar recuperação |
| POST | `/api/auth/reset-password` | Redefinir com token |
| POST | `/api/auth/verification-email` | Solicitar confirmação |
| POST | `/api/auth/verify-email` | Consumir token de confirmação |
| POST | `/api/auth/change-password` | Trocar senha autenticada |
| POST | `/api/auth/logout-all` | Revogar todas as sessões |
| PATCH | `/api/students/:id` | Editar perfil próprio |
| PATCH | `/api/company` | Editar organização própria |
| POST | `/api/projects` | Adicionar projeto ao próprio perfil |
| PUT | `/api/projects/:id` | Atualizar projeto próprio |
| DELETE | `/api/projects/:id` | Excluir projeto próprio |
| POST | `/api/demands` | Criar demanda |
| PATCH | `/api/demands/:id/status` | Executar transição de triagem |
| DELETE | `/api/demands/:id` | Excluir conforme papel e histórico |
| GET | `/api/demands/:id/ranking` | Ranking para curadoria |
| POST | `/api/interests` | Criar candidatura, convite ou sugestão |
| POST | `/api/interests/:id/respond` | Aceitar ou recusar no turno correto |
| POST | `/api/notifications/:id/read` | Marcar uma notificação própria |
| POST | `/api/notifications/read-all` | Marcar notificações próprias |
| POST | `/api/notifications/:id/reply` | Enviar mensagem após contato liberado |
| POST | `/api/attachments/:category` | Enviar arquivo multipart |
| GET | `/api/attachments/:id` | Baixar anexo autorizado |
| DELETE | `/api/attachments/:id` | Excluir anexo próprio |

### Exemplos de corpos

Login:

```json
{ "email": "pessoa@example.com", "password": "senha-informada", "role": "requester" }
```

O `role` no login é opcional e apenas restringe o perfil esperado. Ele não
altera o papel da conta.

Resposta a interesse:

```json
{ "accept": true }
```

Recusa, quando aplicável:

```json
{ "accept": false, "refusalReason": "Justificativa" }
```

Troca autenticada de senha:

```json
{ "currentPassword": "senha-atual", "password": "nova-senha" }
```

Cadastros e demais payloads estão descritos em `docs/backend.md`, e a validação
executável está em `server/schemas.ts`. Campos desconhecidos são rejeitados nos
esquemas estritos. IDs, vínculos, datas e estados controlados pelo servidor não
devem ser inventados pelo frontend.

Várias mutações retornam o estado autorizado atualizado. A criação de demanda,
projeto ou interesse retorna `{ state, demand | project | interest }`, conforme
a operação. A interface deve usar o contrato de cada ação, e não presumir uma
resposta idêntica em todos os endpoints.

## 10. Integração com o frontend — referência para Arthur

| Arquivo | Uso |
|---|---|
| `src/lib/api.ts` | Requisições relativas a `/api`, cookie, cabeçalho de segurança, timeout e erros |
| `src/lib/auth.ts` | Login/cadastro/logout e leitura da sessão atual |
| `src/lib/store.ts` | Cache do estado, atualização e funções de mutação |
| `src/types/api.ts` | Tipos do estado recebido da API |
| `src/components/app/ApiBoundary.tsx` | Carregamento inicial, erros, sincronização e remoção do armazenamento antigo |
| `src/components/app/AccountSecurity.tsx` | Interface de segurança da conta |

O helper `api` recebe caminhos como `/auth/login`; ele próprio acrescenta
`/api`. Não passar `/api/auth/login` para esse helper, pois duplicaria o prefixo.
Para as ações existentes, preferir as funções de `auth.ts` e `store.ts`, que já
mantêm a interface sincronizada.

O cliente usa `credentials: same-origin`, o cabeçalho exigido e timeout de
30 segundos. Há suporte a FormData sem fixar o Content-Type de multipart.
Após mutações, a resposta atualiza o estado; também há atualização ao receber
foco e a cada 30 segundos enquanto a página está visível.

`ApiBoundary` mostra carregamento, erro e opção de tentar novamente; indica
sincronização e desabilita temporariamente os controles contidos no fieldset
durante operações pendentes. Falhas não devem ser tratadas como gravações
bem-sucedidas.

Orientações para manter a integração:

- Usar `useSession()` para a conta corrente; não fixar IDs no componente.
- Consultar estudantes e solicitantes no store, não somente nas sementes.
- Não reintroduzir armazenamento de contas/senhas no localStorage.
- Não exigir que o frontend receba dados privados para depois escondê-los.
- Ler `state.auth.emailEnabled` e `state.auth.verificationRequired` para as
  capacidades de segurança disponíveis no ambiente.
- Preservar a validação acessível dos formulários e os erros retornados pela API.
- Não adicionar URL absoluta de backend para o deploy conjunto sem necessidade.

A chave antiga `vitrineic:v1` é removida ao iniciar o frontend porque o protótipo
armazenava credenciais no navegador. Esses dados antigos não são importados
para o servidor. A navegação principal continua por estado React; não foi feita
migração geral para um roteador com URL por tela.

## 11. Configuração local, seed e curadoria

### Desenvolvimento

```powershell
pnpm install
Copy-Item .env.example .env
pnpm dev
```

Copiar o exemplo somente se ainda não houver `.env` a preservar. O frontend
abre em `http://localhost:5173`; a API usa a porta 3001. O proxy do Vite
encaminha `/api`. O banco começa vazio.

### Dados fictícios

Para usar exemplos, definir `NODE_ENV=development` e `DEMO_MODE=true`, depois
executar `pnpm db:seed`. O seed exige banco vazio e não é uma rotina de limpeza.
As contas e demais exemplos são fictícios e destinados ao desenvolvimento.

Produção recusa `DEMO_MODE=true` e banco contendo os IDs das contas padrão de
demonstração. Não existe endpoint público para restaurar/apagar o banco.

### Criação de curadoria

O comando `pnpm curator:create` lê `CURATOR_EMAIL`, `CURATOR_NAME` e
`CURATOR_PASSWORD`. Deve ser executado no ambiente que acessa o banco desejado.
Criar um curador no banco local não o cria no banco do Render.

Para ambiente sem Shell, foi acrescentado bootstrap opcional na inicialização:

```dotenv
BOOTSTRAP_CURATOR=true
CURATOR_EMAIL=curador@example.com
CURATOR_NAME=Curadoria
CURATOR_PASSWORD=defina-uma-senha-forte-exclusiva
```

Ele cria a conta antes de abrir a porta. Se já houver curador com o e-mail,
preserva os dados e a senha. Não promove estudante/solicitante nem redefine
credenciais existentes. Não marca o e-mail como confirmado automaticamente.

Com banco durável, remover os segredos de bootstrap após a criação. Com banco
descartável, mantê-los permite recriar a conta quando o arquivo for perdido,
inclusive com a senha inicial; uma troca de senha anterior também é perdida
se o banco inteiro desaparecer.

## 12. Preparação para frontend e backend juntos no Render

### Ajustes realizados nesta etapa

- `render.yaml` com apenas um Web Service Node e `plan: free`.
- Build completo do frontend e backend; inicialização por `node build/server.mjs`.
- Health check em `/api/health`.
- Node fixado em `.node-version`.
- Origem automática por `RENDER_EXTERNAL_URL`, com prioridade para `APP_ORIGIN`
  quando este for informado, por exemplo para domínio próprio.
- Escuta em `0.0.0.0` no Render e uso da porta fornecida pelo ambiente.
- Aviso de SQLite temporário nos logs quando o caminho usado é `/tmp/...`.
- Bootstrap da curadoria e transporte de e-mail por HTTPS.
- Comando de backup e inclusão do script na imagem Docker.
- Atualização de README, `.env.example`, guia do backend e guia específico do Render.

As proteções de produção continuam ativas, incluindo cookie Secure e proibição
das contas de demonstração. A exceção explícita do Blueprint gratuito é a
confirmação de e-mail desativada para teste sem provedor externo.

### Configuração gratuita preparada

| Variável | Valor no Blueprint |
|---|---|
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `DATABASE_PATH` | `/tmp/vitrineic/vitrineic.sqlite` |
| `DEMO_MODE` | `false` |
| `MAIL_MODE` | `disabled` |
| `REQUIRE_VERIFIED_EMAIL` | `false` |

Não há `VITE_API_URL`, banco gerenciado, disco pago ou seed automático.
`PORT` e a URL externa são fornecidos pelo Render.

### Limitações e decisão de persistência

Segundo as regras do Render consultadas em 22/10/2026, o serviço gratuito
suspende após 15 minutos sem tráfego e descarta arquivos locais em suspensão,
reinício e deploy. Assim, o SQLite desse ambiente é somente para teste.
O plano também não oferece disco persistente ou Shell e bloqueia as portas
SMTP comuns. As cotas de execução, tráfego e build devem ser acompanhadas.

Para preservar os dados mantendo este código SQLite, o caminho direto é
serviço compatível com disco persistente, montado por exemplo em `/var/data`,
com `DATABASE_PATH=/var/data/vitrineic.sqlite`. Apenas trocar o caminho não
cria um disco. Essa alternativa não foi contratada.

Outra opção é adaptar o backend para banco externo e armazenamento adequado
de anexos. Isso exige implementação e migração próprias. O Postgres gratuito
do Render expira após 30 dias e não é uma solução permanente para esse caso.

O e-mail por HTTPS depende de `MAIL_MODE=resend`, `MAIL_FROM` autorizado e
`RESEND_API_KEY`. Depois de configurado, ativar `REQUIRE_VERIFIED_EMAIL=true`
e atualizar também os valores correspondentes no Blueprint.

### Passos externos pendentes

1. Revisar, fazer commit e enviar os arquivos ao GitHub.
2. No Render, usar **New → Blueprint**, conectar o repositório e selecionar
   a branch `main` e o arquivo `render.yaml`.
3. Conferir que será criado somente um Web Service **Free**, sem extras pagos.
4. Executar o deploy e verificar a página e `/api/health` na URL HTTPS.
5. Configurar o bootstrap da curadoria no painel e criar contas próprias de teste.
6. Testar o fluxo nas três áreas, lembrando que os dados do gratuito são temporários.

O procedimento operacional completo está em `docs/render.md`.

## 13. Backup, restauração e limpeza

### Backup

Foi acrescentado `pnpm db:backup`. O script usa `VACUUM INTO` para criar um
snapshot consistente, incluindo alterações presentes em WAL e BLOBs de anexos.
Ele exige `DATABASE_PATH` e `BACKUP_PATH`, recusa destino existente e não
substitui o banco de origem.

Exemplo em PowerShell, com nome novo para cada backup:

```powershell
$env:DATABASE_PATH = './var/vitrineic.sqlite'
$env:BACKUP_PATH = './var/backups/vitrineic-2026-10-22.sqlite'
pnpm db:backup
Remove-Item Env:BACKUP_PATH
Remove-Item Env:DATABASE_PATH
```

Guardar uma cópia fora do servidor, por canal privado. Copiar somente o arquivo
principal enquanto há escrita em WAL pode produzir um backup incompleto.
O ambiente gratuito não oferece Shell para operar esse comando remotamente.

Para restaurar, parar o processo, preservar uma cópia do banco anterior e seus
arquivos auxiliares, colocar o snapshot no caminho configurado sem misturar
WAL/SHM antigos e reiniciar. Conferir saúde, login e anexos em ambiente de teste.

### Limpeza antes de publicar

**Não é necessário apagar arquivos para o deploy.** O `.gitignore` já exclui
dependências, builds, cache, `.env`, bancos, logs e `var/`.

| Item | Orientação |
|---|---|
| `node_modules/` | Dependências locais; não versionar; pode reinstalar se necessário |
| `dist/` e `build/` | Saídas geradas por `pnpm build`; não versionar |
| `.cache/render-verify/` | Cópia temporária criada na validação; pode apagar |
| `.cache/smoke-*` | Scripts e bancos sintéticos da checagem; podem ser apagados |
| `.cache/pnpm-store/` | Cache local das dependências; opcional remover, mas útil para instalação offline |
| `var/` | Pode conter o banco local, anexos e e-mails; preservar se os dados forem necessários |
| `.env` | Configuração privada; manter localmente e fora do Git |
| `pnpm-lock.yaml` | Preservar e versionar; utilizado no build com lockfile congelado |
| `.env.example` | Preservar e versionar; exemplo sem segredos reais |
| `render.yaml`, `.node-version` e `scripts/` | Preservar; necessários para a configuração preparada |
| `railway.json`, `.railwayignore` e `Dockerfile` | Alternativas de implantação; não precisam ser excluídas para usar o Render Node |

Não tratar arquivos `-wal` e `-shm` de um banco em uso como lixo independente.
A limpeza dos temporários não altera as limitações de persistência do Render.

## 14. Verificações realizadas

Na preparação de 22/10/2026 foram aprovados **19 testes**, a verificação de
tipos e o build completo de produção.

| Arquivo de testes | Cenários principais |
|---|---|
| `server/tests/api.test.ts` | Cadastro, autenticação, autorização, privacidade, interesses, projetos, persistência, CSRF e limites |
| `server/tests/accounts.test.ts` | Confirmação, recuperação, troca de senha, concorrência, revogação, reenvio, falha de entrega e migração |
| `server/tests/files.test.ts` | Anexos privados, formatos, isolamento de acesso e cookies de produção |
| `server/tests/mail.test.ts` | Transporte local e transporte HTTPS simulado, incluindo rejeição e falha de rede |
| `server/tests/deployment.test.ts` | Origem do Render, bootstrap sem redefinição de senha e snapshot com WAL/BLOBs |

Também foi feita checagem interna com os arquivos do frontend compilados:
HTML, JavaScript, health check, 404 da API, fallback de página, login da
curadoria, cookie Secure/HttpOnly, rejeição de outra origem e reabertura do banco.

A sessão bloqueou conexão HTTP local; a checagem funcional utilizou a injeção
de requisições do Fastify. O processo compilado iniciou, mas não foi realizada
uma validação pública da infraestrutura do Render ou de e-mail real.

Comandos para repetir as verificações:

```powershell
pnpm test
pnpm typecheck
pnpm build
```

`pnpm build` já inclui a verificação de tipos. `pnpm start` serve o conjunto
compilado e carrega o `.env` local; `pnpm preview` serve somente o frontend.

## 15. Limitações e próximos trabalhos da equipe

| Tema | Situação atual / trabalho futuro |
|---|---|
| Persistência no Render Free | Banco descartável; decidir infraestrutura durável antes de receber dados importantes |
| Entrega de e-mail | Transporte pronto; faltam credenciais e validação real do remetente/provedor |
| Identidade institucional | Domínio e confirmação de e-mail; sem SSO institucional |
| Antivírus | Não implementado |
| Fila de mensagens de e-mail | Em memória; sem recuperação durável e retentativa automática |
| Comunicação em tempo real | Polling; sem WebSocket |
| Escala | Uma instância SQLite; revisar modelo, consultas e limites para maior volume |
| Banco externo | Sem adaptador PostgreSQL ou migração para ele |
| Anexos em object storage | Não implementado; hoje são BLOBs |
| Operação | Falta configurar serviço real, acesso, monitoramento e rotina externa de backups |
| Dados editoriais | Sementes e métricas de exemplo são fictícias; revisar cursos e conteúdo antes de uso público |
| Navegação | Continua baseada em estado React; sem roteamento geral por URL |

Para Arthur, a principal referência de integração são os helpers de API,
autenticação e store, além dos contratos de resposta filtrados. Para Davi,
os pontos centrais são o esquema híbrido, as migrações, os vínculos do domínio,
as transações e a escolha da infraestrutura de persistência.

## 16. Referências

- Operação e contratos do projeto: `docs/backend.md`.
- Deploy, variáveis, curadoria e limitações: `docs/render.md`.
- Tipos do domínio: `src/types/index.ts` e `src/types/api.ts`.
- Fluxo de interesse: `src/lib/interest.ts`.
- [Render — Blueprints](https://render.com/docs/infrastructure-as-code).
- [Render — plano gratuito](https://render.com/docs/free).
- [Render — discos persistentes](https://render.com/docs/disks).
- [Resend — envio de e-mail por API](https://resend.com/docs/api-reference/emails/send-email).
