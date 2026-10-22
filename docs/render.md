# Frontend e backend juntos no Render

Preparação conferida em 22/10/2026. Nenhum serviço foi criado ou contratado.

O Fastify serve `dist/` e `/api` em um único Web Service. O frontend já usa URLs
relativas `/api`; não precisa de GitHub Pages, CORS nem `VITE_API_URL`.
O build gera `dist/` e `build/server.mjs`. O health check é `/api/health`.

## O que a configuração gratuita entrega

O `render.yaml` da raiz declara **somente um Web Service `plan: free`**, sem
disco, Postgres ou outro recurso. É um ambiente de testes com banco vazio,
autenticação real e **SQLite descartável** em `/tmp/vitrineic/vitrineic.sqlite`.
As contas de demonstração permanecem proibidas em produção.

**Não use esse ambiente para guardar dados importantes.** Contas cadastradas,
sessões, perfis, projetos, demandas, interesses, notificações, tokens e anexos
serão perdidos quando o sistema de arquivos for descartado. Os anexos também
estão no SQLite, como BLOBs. Recarregar a página não apaga o banco enquanto a
mesma instância continua em execução; reinícios, deploys e suspensão apagam.

Não existe persistência durável exclusivamente no Render gratuito para esta
implementação SQLite. Alterar apenas `DATABASE_PATH` ou adicionar `DATABASE_URL`
não resolve: o código atual não tem um adaptador PostgreSQL.

## Publicar a versão gratuita de testes

1. Envie estas alterações ao repositório GitHub. Não envie `.env`, `var/`,
   bancos, backups ou senhas. O repositório pode ser público; os segredos ficam
   no painel do Render. O envio ao GitHub não foi executado nesta preparação.
2. No Render, escolha **New → Blueprint**, conecte o repositório e a branch
   desejada. Use o arquivo `render.yaml` da raiz.
3. Confira no resumo que há somente um Web Service **Free**, sem discos ou
   bancos adicionais. Não selecione upgrade ou recursos pagos.
4. Faça o deploy. Abra a URL HTTPS atribuída pelo Render e confira
   `https://<seu-servico>.onrender.com/api/health`: deve retornar
   `{"status":"ok"}`. A página inicial deve abrir nessa mesma origem.
5. Cadastre contas próprias de teste e percorra os fluxos. Para a curadoria,
   siga o bootstrap abaixo. O banco começa vazio, sem projetos e demandas.

Se preferir **New → Web Service**, use os mesmos valores:

| Campo | Valor |
|---|---|
| Runtime | Node |
| Root Directory | Raiz do repositório (deixe vazio) |
| Instance Type | Free |
| Build Command | `corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm build` |
| Start Command | `node build/server.mjs` |
| Health Check Path | `/api/health` |
| Node | `24.22.1`, definido em `.node-version` |

Copie também as variáveis de `render.yaml` para **Environment**. O build precisa
das devDependencies (TypeScript, Vite, esbuild); por isso usa `--prod=false`.
`PORT` é fornecida pelo Render e não deve ser fixada no painel.

`APP_ORIGIN` é opcional nesse serviço: o backend usa `RENDER_EXTERNAL_URL`.
Para domínio próprio, defina `APP_ORIGIN=https://seu-dominio` sem caminho,
publique a mudança e acesse o site por esse domínio. Origem e links de e-mail
devem corresponder à URL utilizada. Fora do Render, `APP_ORIGIN` continua
obrigatório em produção. `HOST=0.0.0.0` permite o acesso pelo proxy do Render.

## Criar a primeira conta de curadoria sem terminal remoto

O plano gratuito não oferece Shell/SSH ou one-off jobs. Para inicializar o
curador no banco da instância, adicione no painel **Environment**:

```dotenv
BOOTSTRAP_CURATOR=true
CURATOR_EMAIL=seu-email-real@example.com
CURATOR_NAME=Curadoria
CURATOR_PASSWORD=uma-senha-forte-exclusiva-de-8-a-128-caracteres
```

Salve e faça o deploy. O processo cria a conta antes de abrir a porta, com hash
scrypt. A senha não é impressa. Não há rota HTTP administrativa e nenhuma conta
existente é promovida. Se já existir um curador com esse e-mail, o bootstrap
preserva a senha, inclusive após uma troca pela interface. Se o e-mail pertencer
a estudante/solicitante, o processo recusa a inicialização.

No **ambiente descartável**, manter essas variáveis permite recriar o curador
quando o banco for perdido. Isso também recria a senha inicial; uma senha
alterada pela interface se perde junto com o banco. Guarde os valores somente
nos segredos do serviço. Remover as variáveis provoca novo deploy e pode apagar
o banco temporário; não conte com a conta anterior após esse deploy.

Com **disco persistente**, remova `BOOTSTRAP_CURATOR` e as três variáveis
`CURATOR_*` após a primeira criação. A conta permanece no banco. O comando
`pnpm curator:create` continua disponível em ambientes com acesso ao banco.
Se exigir confirmação, o curador deve entrar e pedir o link em **Conta e
segurança**; bootstrap não marca o endereço como confirmado.

## E-mail no gratuito

O Blueprint começa com `MAIL_MODE=disabled` e `REQUIRE_VERIFIED_EMAIL=false`.
Isso permite testar o fluxo sem contratar/configurar envio. **Não comprova a
posse do e-mail institucional**: pessoas podem cadastrar endereços que não
controlam. Confirmação e recuperação por e-mail ficam indisponíveis (503).
Essa combinação é exclusivamente a configuração de testes proposta aqui.

Para habilitar confirmação e recuperação, há transporte **Resend via HTTPS**,
pois o Render Free bloqueia as portas SMTP `25`, `465` e `587`:

```dotenv
MAIL_MODE=resend
MAIL_FROM=remetente@dominio-autorizado.example
RESEND_API_KEY=chave-secreta-do-provedor
REQUIRE_VERIFIED_EMAIL=true
```

Configure as credenciais no painel e altere também `MAIL_MODE` e
`REQUIRE_VERIFIED_EMAIL` no `render.yaml`, para futuras sincronizações do
Blueprint preservarem a configuração. Nunca coloque `RESEND_API_KEY` no Git
ou em variável `VITE_*`. O remetente deve estar autorizado no provedor; contas
de teste do provedor podem restringir destinatários. Um subdomínio
`onrender.com` não autoriza, por si só, enviar e-mails usando esse domínio.
Consulte cotas e requisitos do provedor antes de habilitar. Nenhuma conta,
chave ou domínio de e-mail foi criado nesta preparação.

O transporte usa HTTPS com timeout e não expõe a resposta do provedor em logs.
SMTP e gravação local continuam disponíveis conforme `docs/backend.md`, mas
`MAIL_MODE=file` é recusado em produção. Falhas de envio invalidam o token;
solicite outro link. A fila continua em memória, sem retentativa persistente.

## Limitações do Render gratuito

Segundo a documentação oficial consultada na data acima:

| Limitação | Efeito neste projeto |
|---|---|
| Suspende após 15 minutos sem tráfego; retomada leva cerca de 1 minuto | Frontend e API ficam indisponíveis durante a partida. Uma requisição da API pode atingir o timeout de 30 s; aguarde a retomada e tente novamente. |
| Arquivos locais perdidos em deploy, reinício ou suspensão | Todo o SQLite e seus anexos são descartados. O Render pode reiniciar a instância a qualquer momento. |
| Sem disco persistente, Shell/SSH ou one-off jobs | Não há armazenamento durável nem operação remota de backup pela configuração gratuita. Use o bootstrap para a curadoria. |
| 750 horas gratuitas por workspace/mês, compartilhadas entre serviços | Ao esgotar, os serviços gratuitos são suspensos até o mês seguinte. |
| Franquias de tráfego e minutos de build | Podem gerar cobrança adicional quando houver forma de pagamento; sem ela, há suspensão de serviços ou bloqueio de novos builds, conforme a cota. Confira Billing/Usage e os limites de gasto aplicáveis. |
| SMTP 25/465/587 bloqueado | Use transporte de e-mail HTTPS. |
| Postgres gratuito: 1 GB, expira em 30 dias, sem backups | Não é uma solução permanente nem compatível automaticamente com o adaptador SQLite atual. |

O Render recomenda instâncias gratuitas para testes, projetos pessoais e
avaliação, e não para aplicações em produção. Não há mecanismo de keep-alive
adicionado ao projeto para contornar a suspensão. O polling existente do
frontend, enquanto a página está visível, pode manter o serviço ativo e consumir
horas. O rate limit segue em memória e não confia em `X-Forwarded-For` do
cliente; atrás do proxy, limites por IP podem agrupar usuários. Monitore 429 e
planeje proxy confiável/limites no provedor antes de tráfego real.

## Persistência para uso real (preparada, não contratada)

O caminho mais direto, mantendo frontend e backend juntos e o código SQLite,
é **uma instância paga com disco persistente**. Não há disco ou plano pago
declarado no Blueprint atual. Quando houver decisão de contratar:

1. Selecione um plano de computação compatível com disco, conferindo o preço
   vigente. Atualize também `plan` no `render.yaml` com o identificador escolhido.
2. Adicione o disco ao mesmo serviço, montado em `/var/data`. Para administrar
   o disco pelo Blueprint, acrescente ao serviço, somente nessa ocasião:

   ```yaml
   disk:
     name: vitrineic-data
     mountPath: /var/data
     sizeGB: 1
   ```

3. Altere `DATABASE_PATH` no painel e no Blueprint para
   `/var/data/vitrineic.sqlite`. **Definir esse caminho não cria um disco**;
   confirme a montagem em **Disks**. Mantenha uma única instância.
4. Configure envio real e `REQUIRE_VERIFIED_EMAIL=true`. Crie o curador com
   bootstrap e remova os segredos de bootstrap após criar a conta.
5. Valide a persistência criando um registro, reiniciando e fazendo um novo
   deploy. O registro e um anexo de teste devem continuar disponíveis.
6. Configure backups consistentes e armazene cópias fora do disco do serviço.

O disco só fica disponível **em runtime**, não durante build, pre-deploy ou
one-off jobs. Migrações já são executadas ao abrir o banco na inicialização.
Não rode seed ou criação de curador no build. Serviços com disco têm uma única
instância e breve indisponibilidade durante deploys. Comece com banco vazio:
não há migração automática do banco descartável, de dados locais ou do seed.

Para permanecer com computação gratuita e dados duráveis, será necessário um
banco externo e adaptação da camada de dados (e armazenamento de anexos).
Essa arquitetura é uma evolução separada; não foi criada uma integração
PostgreSQL neste preparo. Render Postgres gratuito não elimina a expiração.

## Backup e restauração de SQLite

`pnpm db:backup` cria um snapshot consistente com `VACUUM INTO`, incluindo
dados em WAL e anexos BLOB, sem copiar o arquivo principal em uso. Em um ambiente
com acesso ao banco, configure `DATABASE_PATH` para o banco de origem e
`BACKUP_PATH` para um arquivo novo. Exemplo local em PowerShell:

```powershell
$env:DATABASE_PATH = './var/vitrineic.sqlite'
$env:BACKUP_PATH = './var/backups/vitrineic-2026-10-22.sqlite'
pnpm db:backup
Remove-Item Env:BACKUP_PATH
Remove-Item Env:DATABASE_PATH
```

Em um Shell do serviço com disco, use:

```sh
DATABASE_PATH=/var/data/vitrineic.sqlite BACKUP_PATH=/var/data/backups/vitrineic-2026-10-22.sqlite node scripts/backup-database.mjs
```

Depois baixe e guarde o snapshot fora do serviço por um canal privado (Shell/SSH
e transferência de arquivos exigem plano compatível). O diretório de backups
no mesmo disco é apenas uma etapa temporária. Bancos e backups contêm dados
pessoais e hashes: não os publique, não os coloque no Git nem em `dist/`.

Para restaurar, pare o processo, preserve uma cópia do banco atual com seus
arquivos `-wal` e `-shm`, coloque o snapshot no `DATABASE_PATH` sem misturá-lo
com arquivos WAL/SHM antigos e reinicie. Confira `/api/health`, login e anexos.
Faça o procedimento num ambiente de teste antes de precisar recuperar dados.

## Verificação local e publicação pendente

```powershell
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
```

`pnpm start` carrega o `.env` local, enquanto o Start Command do Render usa
diretamente as variáveis do painel. Para validar produção localmente, use
`APP_ORIGIN=https://localhost`, `NODE_ENV=production`,
`MAIL_MODE=disabled`, `REQUIRE_VERIFIED_EMAIL=false` e um banco de testes;
confira HTML e `/api/health` na porta escolhida. Login por navegador precisa
de HTTPS para o cookie `Secure`; não reduza a segurança do cookie para testar.

Nesta preparação, os **19 testes passaram**, assim como a verificação de tipos
e o build completo. A checagem interna do servidor validou HTML e JavaScript
compilados, health check, 404 de API, fallback do frontend, login da curadoria,
cookie Secure/HttpOnly, rejeição de outra origem e reabertura do mesmo banco.
A sessão bloqueou conexão HTTP local; essa checagem usou a injeção de
requisições do Fastify. O processo compilado também iniciou antes desse bloqueio.

O teste local não valida a infraestrutura do Render ou entrega real de e-mail.
A etapa externa pendente é enviar o código ao GitHub e criar o Web Service
Free no painel, com os segredos próprios quando necessários.

## Referências oficiais

- [Render: Deploy for Free](https://render.com/docs/free)
- [Render: Blueprint YAML](https://render.com/docs/blueprint-spec)
- [Render: Persistent Disks](https://render.com/docs/disks)
- [Render: variáveis automáticas](https://render.com/docs/environment-variables)
- [Render: versão de Node](https://render.com/docs/node-version)
- [Resend: envio por API HTTPS](https://resend.com/docs/api-reference/emails/send-email)
