-- VitrineIC — esquema 3FN em PostgreSQL.
-- Modelo e decisões de normalização: docs/modelo-dados-3fn.md
-- Só estrutura. Os catálogos (unidades, cursos, competências, idiomas, níveis)
-- são carregados de src/data/ por server/db/sync-catalog.ts, que é a fonte única.

-- ───────────────────────── Catálogos de vocabulário ─────────────────────────

CREATE TABLE nivel_competencia (
  nivel  smallint PRIMARY KEY CHECK (nivel BETWEEN 1 AND 4),
  rotulo text NOT NULL UNIQUE
);

CREATE TABLE nivel_idioma (
  nivel  smallint PRIMARY KEY CHECK (nivel BETWEEN 1 AND 4),
  rotulo text NOT NULL UNIQUE
);

CREATE TABLE tipo_solicitante (
  codigo text PRIMARY KEY CHECK (codigo IN ('empresa', 'ong', 'orgao_publico', 'professor')),
  rotulo text NOT NULL
);

CREATE TABLE unidade_academica (
  codigo text PRIMARY KEY,
  nome   text NOT NULL UNIQUE
);

CREATE TABLE curso (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_codigo  text NOT NULL REFERENCES unidade_academica(codigo) ON UPDATE CASCADE,
  nome            text NOT NULL,
  UNIQUE (unidade_codigo, nome)
);

CREATE TABLE categoria_competencia (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE
);

CREATE TABLE competencia (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_canonico     text NOT NULL UNIQUE,
  categoria_id      uuid REFERENCES categoria_competencia(id),
  fora_do_catalogo  boolean NOT NULL DEFAULT false
);

-- O match compara texto canonizado: "ReactJS" e "react.js" chegam como "React".
CREATE TABLE competencia_alias (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia_id uuid NOT NULL REFERENCES competencia(id) ON DELETE CASCADE,
  alias          text NOT NULL UNIQUE
);
CREATE INDEX competencia_alias_competencia ON competencia_alias(competencia_id);

CREATE TABLE idioma (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE
);

CREATE TABLE area (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE
);

CREATE TABLE escopo_demanda (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rotulo     text NOT NULL UNIQUE,
  meses_max  integer
);

CREATE TABLE topico_interesse (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE
);

-- ───────────────────────── Identidade e acesso ─────────────────────────

CREATE TABLE conta (
  id                  text PRIMARY KEY,
  email               text NOT NULL UNIQUE CHECK (email = lower(email) AND length(email) <= 254),
  nome                text NOT NULL,
  papel               text NOT NULL CHECK (papel IN ('student', 'requester', 'curator')),
  senha_hash          text NOT NULL,
  versao_credencial   integer NOT NULL DEFAULT 0,
  email_confirmado_em timestamptz,
  criada_em           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessao (
  token_hash text PRIMARY KEY,
  conta_id   text NOT NULL REFERENCES conta(id) ON DELETE CASCADE,
  expira_em  timestamptz NOT NULL
);
-- Faltava no SQLite: logout-all e troca de senha apagavam por conta com varredura.
CREATE INDEX sessao_conta   ON sessao(conta_id);
CREATE INDEX sessao_expira  ON sessao(expira_em);

CREATE TABLE token_conta (
  token_hash        text PRIMARY KEY,
  conta_id          text NOT NULL REFERENCES conta(id) ON DELETE CASCADE,
  proposito         text NOT NULL CHECK (proposito IN ('reset_password', 'verify_email')),
  versao_credencial integer NOT NULL,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  expira_em         timestamptz NOT NULL,
  UNIQUE (conta_id, proposito)
);
CREATE INDEX token_conta_expira ON token_conta(expira_em);

-- ───────────────────────── Perfil do estudante ─────────────────────────

CREATE TABLE estudante (
  id                 text PRIMARY KEY,
  -- Perfil sem conta nao existe: nome e e-mail vivem em conta.
  conta_id           text NOT NULL UNIQUE REFERENCES conta(id) ON DELETE CASCADE,
  curso_id           uuid REFERENCES curso(id),
  matricula          text CHECK (matricula ~ '^[0-9]{0,30}$'),
  semestre           text,
  cra                numeric(4, 2) CHECK (cra IS NULL OR cra BETWEEN 0 AND 10),
  bio                text CHECK (length(bio) <= 280),
  github             text,
  linkedin           text,
  site               text,
  lattes             text,
  certificados       text,
  disponibilidade    text,
  em_projeto         boolean NOT NULL DEFAULT false,
  foto               text,
  onboarding_em      date,
  onboarding_pulado  boolean NOT NULL DEFAULT false
);
CREATE INDEX estudante_curso ON estudante(curso_id);

CREATE TABLE estudante_competencia (
  estudante_id   text NOT NULL REFERENCES estudante(id) ON DELETE CASCADE,
  competencia_id uuid NOT NULL REFERENCES competencia(id),
  nivel          smallint REFERENCES nivel_competencia(nivel),
  PRIMARY KEY (estudante_id, competencia_id)
);
CREATE INDEX estudante_competencia_competencia ON estudante_competencia(competencia_id);

CREATE TABLE estudante_idioma (
  estudante_id text NOT NULL REFERENCES estudante(id) ON DELETE CASCADE,
  idioma_id    uuid NOT NULL REFERENCES idioma(id),
  nivel        smallint NOT NULL REFERENCES nivel_idioma(nivel),
  PRIMARY KEY (estudante_id, idioma_id)
);

CREATE TABLE estudante_topico (
  estudante_id text NOT NULL REFERENCES estudante(id) ON DELETE CASCADE,
  topico_id    uuid NOT NULL REFERENCES topico_interesse(id),
  PRIMARY KEY (estudante_id, topico_id)
);

CREATE TABLE projeto_estudante (
  id           text PRIMARY KEY,
  estudante_id text NOT NULL REFERENCES estudante(id) ON DELETE CASCADE,
  titulo       text NOT NULL,
  descricao    text NOT NULL,
  situacao     text NOT NULL CHECK (situacao IN ('ideation', 'coding', 'review', 'done')),
  ano          char(4) NOT NULL CHECK (ano ~ '^[0-9]{4}$'),
  area_id      uuid REFERENCES area(id),
  link         text,
  criado_em    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX projeto_estudante_estudante ON projeto_estudante(estudante_id);

CREATE TABLE projeto_competencia (
  projeto_id     text NOT NULL REFERENCES projeto_estudante(id) ON DELETE CASCADE,
  competencia_id uuid NOT NULL REFERENCES competencia(id),
  PRIMARY KEY (projeto_id, competencia_id)
);

CREATE TABLE anexo_estudante (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estudante_id  text NOT NULL REFERENCES estudante(id) ON DELETE CASCADE,
  nome          text NOT NULL,
  categoria     text NOT NULL CHECK (categoria IN ('tech', 'language', 'portfolio')),
  mime          text NOT NULL,
  conteudo      bytea NOT NULL,
  tamanho_bytes integer NOT NULL,
  enviado_em    timestamptz NOT NULL DEFAULT now()
);
-- Faltava no SQLite: a checagem de cota varria a tabela somando BLOBs.
CREATE INDEX anexo_estudante_estudante ON anexo_estudante(estudante_id);

-- ───────────────────────── Solicitante ─────────────────────────

CREATE TABLE solicitante (
  id               text PRIMARY KEY,
  conta_id         text NOT NULL UNIQUE REFERENCES conta(id) ON DELETE CASCADE,
  nome             text NOT NULL UNIQUE,
  tipo_codigo      text NOT NULL REFERENCES tipo_solicitante(codigo),
  rotulo_exibicao  text,
  cidade           text,
  desde            char(4) CHECK (desde IS NULL OR desde ~ '^[0-9]{4}$'),
  site             text,
  descricao        text
);

-- ───────────────────────── Demanda ─────────────────────────

CREATE TABLE demanda (
  -- O id e o proprio protocolo mostrado ao solicitante: VIC-2026-0046.
  id              text PRIMARY KEY,
  solicitante_id  text NOT NULL REFERENCES solicitante(id),
  titulo          text NOT NULL,
  descricao       text NOT NULL,
  area_id         uuid REFERENCES area(id),
  escopo_id       uuid REFERENCES escopo_demanda(id),
  prazo           date NOT NULL,
  status          text NOT NULL DEFAULT 'nova'
                  CHECK (status IN ('nova', 'em_analise', 'aprovada', 'rejeitada', 'contato_liberado')),
  prioridade      text NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('alta', 'normal', 'baixa')),
  publico_alvo    text,
  nivel_academico text,
  tamanho_equipe  text,
  orcamento       text,
  observacoes     text,
  enviada_em      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX demanda_solicitante ON demanda(solicitante_id);
CREATE INDEX demanda_status      ON demanda(status);

CREATE TABLE demanda_competencia (
  demanda_id     text NOT NULL REFERENCES demanda(id) ON DELETE CASCADE,
  competencia_id uuid NOT NULL REFERENCES competencia(id),
  PRIMARY KEY (demanda_id, competencia_id)
);
CREATE INDEX demanda_competencia_competencia ON demanda_competencia(competencia_id);

CREATE TABLE demanda_historico_status (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demanda_id             text NOT NULL REFERENCES demanda(id) ON DELETE CASCADE,
  status                 text NOT NULL,
  alterado_por_conta_id  text REFERENCES conta(id) ON DELETE SET NULL,
  observacao             text,
  alterado_em            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX demanda_historico_demanda ON demanda_historico_status(demanda_id);

-- ───────────────────────── Match ─────────────────────────

CREATE TABLE interesse (
  id                   text PRIMARY KEY,
  demanda_id           text NOT NULL REFERENCES demanda(id) ON DELETE CASCADE,
  estudante_id         text NOT NULL REFERENCES estudante(id),
  origem               text NOT NULL CHECK (origem IN ('candidatura', 'convite', 'sugestao')),
  justificativa        text,
  status               text NOT NULL CHECK (status IN (
                         'aguardando_estudante', 'aguardando_solicitante', 'contato_liberado',
                         'recusado_estudante', 'recusado_solicitante')),
  criado_por_conta_id  text REFERENCES conta(id) ON DELETE SET NULL,
  criado_em            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interesse_sugestao_justificada
    CHECK (origem <> 'sugestao' OR (justificativa IS NOT NULL AND length(btrim(justificativa)) > 0))
);
-- Um interesse ativo por par; a recusa libera nova tentativa.
CREATE UNIQUE INDEX interesse_par_ativo ON interesse(demanda_id, estudante_id)
  WHERE status NOT IN ('recusado_estudante', 'recusado_solicitante');
CREATE INDEX interesse_estudante ON interesse(estudante_id);
CREATE INDEX interesse_demanda   ON interesse(demanda_id);
CREATE INDEX interesse_status    ON interesse(status);

CREATE TABLE interesse_resposta (
  interesse_id   text NOT NULL REFERENCES interesse(id) ON DELETE CASCADE,
  lado           text NOT NULL CHECK (lado IN ('estudante', 'solicitante')),
  aceito         boolean NOT NULL,
  motivo_recusa  text,
  respondido_em  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (interesse_id, lado),
  -- Aceite não carrega motivo de recusa; a recusa pode vir sem justificativa.
  CONSTRAINT interesse_resposta_motivo CHECK (NOT aceito OR motivo_recusa IS NULL)
);

-- ───────────────────────── Comunicação ─────────────────────────

CREATE TABLE mensagem (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interesse_id        text NOT NULL REFERENCES interesse(id) ON DELETE CASCADE,
  remetente_conta_id  text NOT NULL REFERENCES conta(id) ON DELETE CASCADE,
  conteudo            text NOT NULL CHECK (length(conteudo) BETWEEN 1 AND 5000),
  enviada_em          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mensagem_interesse ON mensagem(interesse_id);

CREATE TABLE notificacao (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destinatario_conta_id  text NOT NULL REFERENCES conta(id) ON DELETE CASCADE,
  tipo                   text NOT NULL CHECK (tipo IN ('SISTEMA', 'MENSAGEM')),
  demanda_id             text REFERENCES demanda(id) ON DELETE CASCADE,
  interesse_id           text REFERENCES interesse(id) ON DELETE CASCADE,
  mensagem_id            uuid REFERENCES mensagem(id) ON DELETE CASCADE,
  -- Assunto proprio do aviso de sistema, quando nao ha demanda associada.
  assunto                text,
  conteudo               text,
  criada_em              timestamptz NOT NULL DEFAULT now(),
  lida_em                timestamptz,
  CONSTRAINT notificacao_corpo CHECK (conteudo IS NOT NULL OR mensagem_id IS NOT NULL)
);
-- A consulta mais quente do sistema: caixa de uma conta, mais recentes primeiro.
CREATE INDEX notificacao_caixa ON notificacao(destinatario_conta_id, criada_em DESC);
CREATE INDEX notificacao_nao_lidas ON notificacao(destinatario_conta_id) WHERE lida_em IS NULL;

-- ───────────────────────── Impacto (só o não derivável) ─────────────────────────

CREATE TABLE depoimento (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  texto       text NOT NULL,
  autor       text NOT NULL,
  papel_autor text,
  periodo     text
);

CREATE TABLE meta_indicador (
  chave       text PRIMARY KEY,
  rotulo      text NOT NULL,
  valor_meta  numeric NOT NULL,
  periodo     text
);
