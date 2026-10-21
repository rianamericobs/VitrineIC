# Backend do VitrineIC

## Executar

Node **22.13+ ou 24 LTS** e pnpm **10.34.3**.

```powershell
pnpm install
Copy-Item .env.example .env
pnpm dev
```

O comando inicia a API em `http://127.0.0.1:3001` e o frontend em
`http://localhost:5173`. Abra **localhost**, conforme `APP_ORIGIN`.
O proxy do Vite encaminha `/api` ao servidor. O banco é criado automaticamente
em `var/vitrineic.sqlite`. Sem carga de exemplos, ele começa vazio.

```powershell
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

`pnpm start` serve API e `dist/` na mesma porta, 3001 por padrão. Para testar
esse modo localmente, configure `APP_ORIGIN=http://localhost:3001`.
`pnpm preview` serve somente o frontend; use `pnpm start` para testar o conjunto.

## Dados fictícios e curadoria

Para uma demonstração, configure **DEMO_MODE=true** no `.env`, com
`NODE_ENV=development`, e execute `pnpm db:seed` antes de `pnpm dev`.
O seed exige banco vazio e nunca apaga dados existentes. Ele usa as sementes
de `src/data`, armazenando as senhas como hashes.

| Perfil | Login | Senha de exemplo |
|---|---|---|
| Estudante | estudante@ic.ufal.br | demo1234 |
| Solicitante | contato@techbr.com.br | demo1234 |
| Curadoria | curadoria@ic.ufal.br | demo1234 |

Em produção, use banco vazio, sem seed e com `DEMO_MODE=false`.
O servidor recusa modo de demonstração e bancos com as contas padrão em produção.
Os botões de demonstração só aparecem quando o servidor habilita esse modo.
Não existe rota HTTP para restaurar ou apagar o banco.

Crie curadores administrativamente, sem cadastro público:

1. Configure temporariamente `CURATOR_EMAIL`, `CURATOR_NAME` e
   `CURATOR_PASSWORD` no `.env` local ou nos segredos do ambiente. Senha de 8 a
   128 caracteres; não use as credenciais de exemplo.
2. Execute `pnpm curator:create` no ambiente que acessa o banco desejado.
   Na imagem Docker de produção, use `node build/create-curator.mjs` com
   as mesmas variáveis e o volume do serviço montado.
3. Remova essas três variáveis após a criação. O comando não imprime a senha
   e não substitui uma conta existente.

## Arquitetura

- **Fastify + TypeScript**: API, cookies, limites de requisição e uploads.
- **SQLite (`node:sqlite`)**: arquivo persistente, WAL, chaves estrangeiras,
  índices e transações. Não exige instalar um servidor de banco separado.
- **Zod**: validação no servidor, campos desconhecidos rejeitados e limites de tamanho.
- **Nodemailer**: entrega por SMTP com TLS ou arquivos locais de desenvolvimento.
- **React**: `src/lib/store.ts` é cache das respostas. `auth.ts` usa a API;
  não há contas, senhas ou autorização em `localStorage`.
- **Sessão**: token aleatório de 256 bits em cookie HttpOnly, SameSite=Strict,
  Secure em produção. O banco guarda só SHA-256 do token; validade de sete dias.
- **Senha**: scrypt assíncrono, salt individual, N=32768, r=8, p=1.
- **CSRF**: origem configurada, cabeçalho não simples `X-Vitrine-Client: web`
  em mutações e rejeição de `Sec-Fetch-Site: cross-site`; nenhum CORS público.

As tabelas `students`, `companies`, `accounts`, `demands`, `interests`,
`sessions`, `notifications` e `attachments` são criadas na inicialização.
Colunas relacionais mantêm identidade, unicidade e referências; os demais
campos são armazenados em JSON validado. `migrations` registra as versões 1 e 2.
A versão 2 adiciona `account_tokens`. `server/migrations.ts` aplica cada evolução
uma única vez, em transação, preservando os dados existentes. Uma versão de
banco mais nova que o servidor é rejeitada; faça backup antes de atualizar.

Uma restrição única parcial impede dois interesses ativos para a mesma dupla
demanda/estudante. Alterações de status e notificações são gravadas na mesma
transação, inclusive a liberação de contato.

## Contrato HTTP

Todas as rotas têm prefixo `/api`. Envie `Content-Type: application/json`
para corpos JSON e `X-Vitrine-Client: web` em POST, PATCH, PUT e DELETE.
O cookie de sessão identifica a conta: IDs enviados pelo cliente não conferem
permissão. Datas novas usam ISO 8601. IDs novos são gerados no servidor.

| Método e rota | Acesso e finalidade |
|---|---|
| GET `/health` | Saúde da API e acesso ao banco |
| GET `/state` | Estado filtrado por visitante/conta; sem credenciais |
| GET `/impact` | Totais agregados, sem interesses ou contatos privados |
| POST `/auth/students` | Cadastro, perfil vazio e sessão; exige consentimento |
| POST `/auth/requesters` | Cadastro da organização e sessão |
| POST `/auth/login` | Login e rotação de sessão; `role` opcional |
| POST `/auth/logout` | Revoga a sessão atual e remove o cookie |
| GET `/auth/me` | Estado da conta autenticada; 401 quando expirada |
| POST `/auth/forgot-password` | Solicita instruções por e-mail; resposta genérica |
| POST `/auth/reset-password` | Redefine senha com token de uso único |
| POST `/auth/verification-email` | Conta logada solicita confirmação de endereço |
| POST `/auth/verify-email` | Confirma posse do e-mail por token |
| POST `/auth/change-password` | Troca a senha e revoga as sessões anteriores |
| POST `/auth/logout-all` | Encerra todas as sessões da conta |
| PATCH `/students/:id` | Estudante edita somente o próprio perfil |
| PATCH `/company` | Solicitante edita somente sua organização |
| POST `/projects` | Estudante publica projeto no próprio portfólio |
| PUT `/projects/:id` | Substitui dados de projeto próprio |
| DELETE `/projects/:id` | Exclui projeto próprio |
| POST `/demands` | Solicitante cria demanda em `nova` |
| PATCH `/demands/:id/status` | Curadoria executa transições de triagem |
| DELETE `/demands/:id` | Curadoria; ou dono enquanto `nova`; sem histórico de interesses |
| GET `/demands/:id/ranking` | Curadoria consulta ranking sem revelar e-mails |
| POST `/interests` | Candidatura, convite ou sugestão, conforme o papel |
| POST `/interests/:id/respond` | Parte envolvida responde no seu turno |
| POST `/notifications/:id/read` | Marca uma notificação própria como lida |
| POST `/notifications/read-all` | Marca as notificações próprias como lidas |
| POST `/notifications/:id/reply` | Mensagem à outra parte após contato liberado |
| POST `/attachments/:category` | Estudante envia um arquivo multipart |
| GET `/attachments/:id` | Dono ou curador baixa arquivo privado |
| DELETE `/attachments/:id` | Dono remove arquivo próprio |

Cadastro de estudante: `name`, `email`, `password`, `unit`, `course`,
`consent: true`. E-mail deve pertencer à instituição e curso deve existir em
`src/data/institution.ts` para a unidade escolhida. A posse do endereço é
confirmada separadamente pelo link enviado por e-mail.

Cadastro de solicitante: `organization`, `contactName`, `email`, `password`,
`city`, `kind`, `site`. `kind`: empresa, ong, orgao_publico ou professor.

Demanda: `title`, `description`, `area`, `scope`, `deadline` (AAAA-MM-DD),
`skills`; opcionais `audience`, `academicLevel`, `notes`, `teamSize`, `budget`.
Organização, status e protocolo são determinados no servidor.

Interesse: `demandId`, `studentId`, `origin`, `justification` opcional —
obrigatória para `sugestao`. Resposta: `accept: boolean`, `refusalReason`
opcional. O servidor determina quem está respondendo, sem confiar em `side`.

Projeto: `title`, `description`, `stack`, `status` (ideation/coding/review/done),
`year`, `area`, `link` opcional. A vitrine e “Meus projetos” usam a mesma lista.

Recuperação: `/auth/forgot-password` recebe `{ email }`, e
`/auth/reset-password` recebe `{ token, password }`. Confirmação:
`/auth/verification-email` não exige corpo, mas exige sessão;
`/auth/verify-email` recebe `{ token }`. Troca de senha autenticada recebe
`{ currentPassword, password }`. Tokens e senhas nunca devem ir na query string.

Mutações retornam o novo estado autorizado. Criação de demanda, projeto e
interesse retorna `{ state, demand | project | interest }`.
Erros retornam `{ error, fields? }`: 400 validação, 401 sessão ausente/expirada,
403 permissão/origem, 404 recurso inexistente, 409 conflito, 413 tamanho,
429 limite de requisições. Erros internos não expõem stack trace ao cliente.

## Regras preservadas

- Perfil sem competências fica fora da vitrine e não abre interesses.
- Somente demandas aprovadas recebem novos interesses.
- Candidatura: estudante já aceita ao se candidatar; solicitante responde.
- Convite: solicitante já aceita ao convidar; estudante responde.
- Sugestão: curador justifica; estudante aceita; depois solicitante responde.
- Sugestão pendente ou recusada pelo estudante não é enviada ao solicitante,
  nem por notificações ou pela resposta de uma tentativa de convite duplicado.
- Contatos são filtrados **na API**, inclusive em leituras públicas. A outra
  parte recebe o e-mail somente após aceite duplo. Curadoria não antecipa contatos.
- Motivo de recusa nunca é enviado ao estudante.
- Curador não pode forjar `contato_liberado`. Demandas com interesses ativos
  não voltam à triagem; com histórico de interesses não podem ser apagadas.
- O selo “em projeto” continua sendo declarado pelo estudante.
- Indicadores são derivados do banco, sem publicar registros privados para calculá-los.

## E-mail e segurança da conta

O cadastro continua abrindo uma sessão para o onboarding. A confirmação do
endereço é solicitada automaticamente quando o envio está habilitado. A conta
autenticada pode reenviar o link em **Conta e segurança**. No login, **Esqueci
minha senha** abre a recuperação. Os links recebidos abrem uma tela de confirmação
ou de nova senha antes de executar a ação; visitar o link sozinho não o consome.

Para testar sem enviar e-mail, o `.env.example` usa:

```dotenv
MAIL_MODE=file
MAIL_DIRECTORY=./var/mail
REQUIRE_VERIFIED_EMAIL=false
```

Cada mensagem é gravada como `.eml` em `var/mail`, para abertura em um leitor
de e-mails. Os links usam `APP_ORIGIN`. Esses arquivos contêm links de acesso:
nunca publique essa pasta. Ela está fora de `dist/`, do Git e da imagem Docker.
No modo local a confirmação é opcional; use `REQUIRE_VERIFIED_EMAIL=true`
para testar os bloqueios de publicação. Sem `MAIL_MODE`, o envio fica desabilitado
e as rotas que solicitam mensagens retornam 503.

Para envio real:

```dotenv
MAIL_MODE=smtp
MAIL_FROM=seu-remetente@seu-dominio
SMTP_HOST=smtp.seu-provedor
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu-usuario
SMTP_PASSWORD=seu-segredo
REQUIRE_VERIFIED_EMAIL=true
```

Use um remetente autorizado pelo provedor. Na porta 465, use `SMTP_SECURE=true`.
Na porta 587, o transporte exige STARTTLS. Não há opção de ignorar certificados
inválidos. Os segredos SMTP ficam somente no servidor. A integração não exige
acesso ao navegador, ao perfil do Chrome ou à caixa de e-mail pessoal.

Em produção, a confirmação é obrigatória por padrão e exige SMTP configurado.
O modo `file` é recusado em produção. Quando a exigência está ativa, estudantes
sem confirmação ficam fora do diretório e do catálogo, mesmo com competências.
Publicar projetos/demandas, enviar anexos, realizar a triagem e criar ou responder
interesses exige confirmação. Editar o próprio perfil e solicitar confirmação
continuam disponíveis. Dados antigos não são considerados confirmados automaticamente.

Os tokens têm 256 bits de aleatoriedade. Somente seu SHA-256 fica no banco;
links não são retornados pela API. Redefinição expira em **30 minutos** e
confirmação em **24 horas**. Reenvios respeitam intervalo de um minuto por conta
e finalidade, inclusive entre sessões. As rotas possuem limite de cinco
tentativas por IP em 15 minutos. Solicitar recuperação responde sempre com a
mesma mensagem para endereços cadastrados e desconhecidos.

Cada token só pode ser consumido uma vez. A transação repete a validação após
o cálculo assíncrono do hash de senha, impedindo dois resets simultâneos com o
mesmo link. A redefinição confirma a posse do endereço, encerra todas as sessões
da conta e invalida todos os links anteriores. Não abre uma sessão automaticamente.
Uma sessão de outra conta no mesmo navegador permanece válida.

A troca de senha autenticada exige a senha atual. Ela renova o cookie da sessão
em uso, encerra as demais sessões e invalida links emitidos anteriormente.
**Sair de todas as sessões** revoga também a sessão atual. Os formulários limpam
as senhas após sucesso ou mudança da conta autenticada.

Os links carregam o token em um fragmento (`#account/...`), que não é enviado
nas requisições HTTP. A tela o remove do endereço e mantém em memória até a
confirmação. Reabrir o link original do e-mail permite tentar novamente caso
ele ainda seja válido.

A entrega usa uma fila em memória, limitada a 100 mensagens, fora do ciclo
HTTP; o tempo de SMTP não diferencia a resposta para contas existentes. No
encerramento normal, o servidor aguarda as entregas pendentes. Falha de envio
invalida o token correspondente e registra um aviso sem conteúdo ou credenciais.
Não há retentativa automática nem fila persistente: após queda abrupta ou falha
do provedor, solicite outro link. A resposta genérica não garante a entrega.

## Anexos e sincronização

Categorias: `tech`, `language` e `portfolio`. Certificados aceitam PDF;
portfólio aceita PDF, DOCX e ZIP. Limite de **20 MB por arquivo**, 20 arquivos
e 100 MB por estudante. O servidor verifica extensão e assinatura básica,
não extrai ZIPs e força download como anexo. Arquivos são BLOBs no banco e
nunca ficam em uma pasta pública. Essa checagem **não é antivírus**.

Notificações são criadas pelas operações reais, e a leitura persiste no banco.
Mensagens internas só são permitidas entre as partes com contato liberado.
O frontend atualiza o estado após mutações, ao receber foco e a cada 30 segundos
enquanto visível. Não há WebSocket. Falhas mantêm o formulário aberto e exibem
mensagem; o frontend não simula uma gravação bem-sucedida.

O antigo `vitrineic:v1` é removido do navegador na inicialização, pois continha
senhas em texto puro. Dados do protótipo **não são importados automaticamente**;
as contas devem ser cadastradas novamente ou criadas pelo seed explícito.

## Produção / Railway

O serviço agora precisa de processo Node e **disco persistente**. Configure:

```dotenv
NODE_ENV=production
HOST=0.0.0.0
APP_ORIGIN=https://seu-dominio
DATABASE_PATH=/data/vitrineic.sqlite
DEMO_MODE=false
MAIL_MODE=smtp
MAIL_FROM=seu-remetente@seu-dominio
SMTP_HOST=smtp.seu-provedor
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu-usuario
SMTP_PASSWORD=seu-segredo
REQUIRE_VERIFIED_EMAIL=true
```

Na Railway, monte um volume em `/data`, defina as variáveis acima e use
`pnpm build` / `pnpm start` conforme `railway.json`. `PORT` é fornecido pela
plataforma. Crie o primeiro curador usando o banco desse ambiente. Não carregue
o banco de demonstração. O frontend e a API devem ficar na **mesma origem**.

SQLite atende esta implantação com uma instância e volume local. Para múltiplas
réplicas ou maior volume, migre a camada `server/database.ts` para PostgreSQL e
os anexos para armazenamento de objetos. O rate limit atual fica na memória de
cada processo; o servidor não confia em `X-Forwarded-For` enviado pelo cliente.
Atrás de proxy, configure também os limites de tráfego do provedor.

Faça backup consistente com o servidor parado (ou use a API de backup do SQLite).
Não copie apenas o arquivo principal enquanto houver escrita em modo WAL.
Guarde backups fora do volume de execução. HTTPS é necessário para o cookie
Secure; nenhum segredo deve usar prefixo `VITE_`.

## Verificação e limites

`pnpm test` executa quinze cenários de integração com múltiplas asserções: cadastros,
login, domínio institucional, autorização, privacidade, três origens de interesse,
aceite duplo, recusa, duplicação, mensagens, projetos, reinício do banco,
anexos, CSRF, limites de login, rotação/expiração e cookies de produção; confirmação
de endereço, recuperação, concorrência, revogação de sessões, uso único de tokens,
reenvio, falha de entrega, transporte local e migração do banco existente.

Não estão implementados integração com identidade institucional ou antivírus.
SMTP depende das credenciais e do remetente do provedor de hospedagem. O sistema segue
o fluxo atual do produto; cadastro de projeto publica no portfólio, enquanto a
curadoria aprova **demandas** e sugere conexões. Depoimentos e catálogos de cursos
de exemplo continuam sendo conteúdo editorial a revisar antes de uso público.
