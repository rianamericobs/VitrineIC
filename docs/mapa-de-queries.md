# Mapa de queries do VitrineIC

Onde cada consulta acontece, o que ela lê e quanto custa. Levantado sobre
`server/` na versão atual. Complementa `docs/modelo-dados-3fn.md`.

## O padrão que define tudo

`Database.all()` (`server/database.ts:80`) é a única forma de ler uma coleção:

```sql
SELECT data FROM <tabela> ORDER BY rowid DESC
```

Sem `WHERE`, sem `LIMIT`, seguido de `JSON.parse` em cada linha. Todo filtro do
sistema — por dono, por status, por papel — acontece em JavaScript, depois que
a tabela inteira já veio para a memória.

`Database.get()` lê por chave primária e é eficiente. `Database.put()` grava o
documento inteiro a cada alteração, mesmo quando muda um booleano.

## `snapshot()` — a consulta que importa

`server/views.ts:15` é o coração do sistema. Uma chamada lê:

| Linha | Leitura | Tipo |
|---|---|---|
| 16 | `students` | varredura total |
| 17 | `demands` | varredura total |
| 18 | `interests` | varredura total |
| 19 | `companies` | varredura total |
| 20 | `accounts` | varredura total, só se `requireVerifiedEmail` |
| 28 | `notifications` | varredura total, filtrada por `accountId` em JS |
| 52 | `attachments` | **SQL com `WHERE student_id=?`** — a única leitura seletiva |

Os indicadores de impacto (54–57) são calculados em JS sobre esses arrays.

**Toda rota de escrita devolve um `snapshot()` completo.** São 17 pontos de
chamada: cada login, cada patch de perfil, cada projeto criado, cada resposta a
interesse, cada notificação marcada como lida. Não existe resposta parcial.

E o cliente ainda faz *polling*: `src/components/app/ApiBoundary.tsx:14` chama
`/api/state` a cada 30 s com a aba visível, mais a cada `focus`.

## Custo medido

Banco de demonstração atual (5 estudantes, 8 demandas, 11 interesses):
**0,48 ms** por snapshot. Irrelevante.

Projeção com volume de um semestre real — 2.000 estudantes, 500 demandas,
5.000 interesses, 2.300 contas, 100.000 notificações:

| Consulta | Tempo |
|---|---|
| `snapshot()` como está hoje | **173,5 ms** |
| 50 notificações do dono, com índice | 0,21 ms |
| 1 estudante por id | 0,07 ms |
| Demandas aprovadas (varredura + filtro JS) | 1,20 ms |

O gargalo é `notifications`: cresce uma linha por evento por conta e é varrida
inteira para entregar as poucas de um usuário. Com 100 abas abertas em polling
de 30 s, só o *refresh* consome cerca de 58% de um núcleo.

## Inventário por arquivo

### `security.ts` — toda requisição autenticada
| Linha | Query | Índice |
|---|---|---|
| 31 | `SELECT account_id FROM sessions WHERE token_hash=? AND expires_at>?` | PK |
| 31→ | `db.get("accounts", id)` | PK |
| 44 | `DELETE FROM sessions WHERE token_hash=?` | PK |
| 50 | `DELETE FROM sessions WHERE expires_at<=?` | `sessions_expiry` |

Caminho saudável: duas leituras por chave, em todo request.

### `account-tokens.ts` — recuperação e confirmação
Todas por `token_hash` (PK) ou por `UNIQUE(account_id, purpose)`. Sem problema.

### `auth-routes.ts`
`SELECT ... FROM accounts WHERE email=?` (linhas 21, 38, 56) usa o índice único
de `email`. Depois, `snapshot()`.

### `account-routes.ts`
| Linha | Query | Observação |
|---|---|---|
| 20 | `SELECT data FROM accounts WHERE email=?` | índice único |
| 35, 72, 82 | `DELETE FROM sessions WHERE account_id=?` | **sem índice em `sessions.account_id`** |
| 36, 73 | `DELETE FROM account_tokens WHERE account_id=?` | coberto pelo UNIQUE |

### `domain-routes.ts` — onde as varreduras se acumulam
| Linha | Leitura | Problema |
|---|---|---|
| 99 | `db.all("interests")` | varre tudo para checar interesses de **uma** demanda |
| 101 | `db.all("accounts")` | varre tudo para achar o dono; `accounts.company_id` é único e não é usado |
| 112 | `db.all("interests")` | mesma varredura, de novo |
| 122 | `result(request)` | **ranking monta o snapshot inteiro e descarta tudo menos `students`** |
| 134 | `db.all("accounts")` | varre tudo para conferir um e-mail confirmado |
| 138 | `db.all("interests")` | varre tudo para achar o par; o índice parcial `interests_active_pair` existe exatamente para isso |

O ranking (118–123) é o pior ponto: faz o trabalho completo do snapshot, joga
fora demandas, empresas, interesses e notificações, e só então pontua os
estudantes em JS com `scoreStudent`.

### `inbox-routes.ts`
| Linha | Leitura | Problema |
|---|---|---|
| 21 | `db.all("notifications")` + um `put` por linha não lida | N reescritas de documento onde caberia **um** `UPDATE` |
| 35 | `db.all("accounts")` | varre tudo para achar o destinatário |

### `notifications.ts`
`notifyInterest` (linha 10) faz `db.all("accounts")` a cada evento de interesse,
para localizar duas contas que o índice já resolveria.

### `file-routes.ts`
| Linha | Query | Observação |
|---|---|---|
| 26 | `SELECT count(*), sum(length(content)) FROM attachments WHERE student_id=?` | **sem índice em `attachments.student_id`**; ainda soma o tamanho dos BLOBs |
| 36 | `SELECT * FROM attachments WHERE id=?` | PK; traz o BLOB, que é o objetivo |
| 44 | `DELETE FROM attachments WHERE id=? AND student_id=?` | PK |

### `app.ts`
`/api/impact` (linha 58) monta o snapshot completo e devolve só `.impact`. É
rota pública, sem autenticação — a mais barata de abusar.

## Índices: o que existe e o que é usado

Criados em `database.ts`: `demands_company`, `interests_active_pair`,
`interests_student`, `sessions_expiry`, `notifications_account`,
`account_tokens_expiry`.

**Nenhum dos índices de domínio é usado em consulta.** `notifications_account`,
`demands_company`, `interests_student` e `interests_active_pair` só servem para
impor integridade e unicidade, porque nenhuma leitura de domínio passa por SQL
com `WHERE`. O mesmo vale para as colunas relacionais que `put()` mantém
(`email`, `student_id`, `company_id`, `demand_id`, `status`): são gravadas e
nunca consultadas.

Faltando, e estes seriam usados de imediato:

```sql
CREATE INDEX sessions_account    ON sessions(account_id);
CREATE INDEX attachments_student ON attachments(student_id);
```

## Ordem de ataque

1. **`notifications` sai do snapshot.** Trocar a varredura por
   `WHERE account_id=? ORDER BY rowid DESC LIMIT n`, usando o índice que já
   existe. É o maior ganho isolado: 173 ms → poucos ms.
2. **Ranking para de chamar `snapshot()`.** Precisa de estudantes visíveis e de
   uma demanda, não do estado inteiro.
3. **Os dois índices acima.**
4. **`read-all` vira um `UPDATE`** em vez de N reescritas de documento.
5. **Buscas de conta por perfil** (`domain-routes.ts:101,134`,
   `inbox-routes.ts:35`, `notifications.ts:12`) viram SQL por `student_id` /
   `company_id`, que já são únicos.
6. **Resposta parcial.** Enquanto toda escrita devolver o estado completo, o
   custo do snapshot multiplica por cada ação do usuário.

Os itens 1 a 5 não dependem da migração para 3FN — valem no esquema de hoje.
O item 6 é o que a normalização destrava de verdade.
