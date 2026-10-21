import { useState } from "react";
import { markRead, markAllRead, replyNotification } from "@/lib/store";
import type { Notification } from "@/types/api";
import { FilterPill } from "./FilterPill";
import { ArrowIcon } from "./Icons";
import { NotificationRow } from "./NotificationRow";
import { StatusPill } from "./StatusPill";
import { BackButton } from "@/components/public/BackButton";
import { PageHead } from "@/components/public/PageHead";
import { PAGE } from "@/components/public/layout";
import { SLATE } from "@/styles/tokens";

export type InboxMessage = Notification;

/**
 * Caixa de entrada das áreas logadas: mensagens no card do Figma, filtro
 * "todas / não lidas", abertura da mensagem e caixa de resposta.
 * Os avisos curtos ficam no sino (`UpdatesMenu`).
 * `typeColors` dá a cor da pílula de cada tipo.
 */
export function Inbox({
  initial,
  typeColors,
}: {
  initial: InboxMessage[];
  typeColors: Record<string, string>;
}) {
  const notifs = initial;
  const [sent, setSent] = useState(false);
  const [filter, setFilter] = useState<"todas" | "nao-lidas">("todas");
  const [selected, setSelected] = useState<InboxMessage | null>(null);
  const [reply, setReply] = useState("");

  const unreadCount = notifs.filter((n) => n.unread).length;

  const openNotif = async (index: number) => {
    const original = notifs[index];
    if (!await markRead(original.id)) return;
    setSent(false);
    setSelected(original);
  };

  const pill = (type: string) => <StatusPill color={typeColors[type] ?? SLATE}>{type.toLowerCase()}</StatusPill>;

  if (selected) {
    return (
      <main className={`${PAGE} pt-8 pb-20`}>
        <BackButton
          label="Voltar para a caixa de entrada"
          onClick={() => {
            setSelected(null);
            setReply("");
          }}
        />

        <article className="vt-card mt-10 p-6 md:p-10">
          <div className="flex flex-col gap-3 border-b border-navy/8 pb-8">
            {pill(selected.type)}
            <h1 className="font-display text-[28px] font-medium leading-[1.15] tracking-[-0.025em] text-navy md:text-[36px]">
              {selected.project}
            </h1>
            <p className="font-sans text-sm text-navy/60">
              Enviado por <span className="text-navy">{selected.from}</span> · {selected.time}
            </p>
          </div>

          <p className="py-8 font-sans text-[15px] leading-[1.65] whitespace-pre-wrap text-navy/85">{selected.content}</p>

          {selected.canReply && <div className="border-t border-navy/8 pt-6">
            <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.08em] text-navy/65">
              Responder mensagem
            </label>
            <textarea
              rows={4}
              className="vt-input"
              placeholder="Escreva sua resposta..."
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
            <div className="mt-4 flex justify-end">
              {sent && <p role="status" className="mr-4 text-sm text-moss">Resposta enviada.</p>}
              <button disabled={!reply.trim()} onClick={async () => { if (await replyNotification(selected.id, reply)) { setReply(""); setSent(true); } }} className="vt-btn vt-btn-primary">
                Enviar resposta <ArrowIcon />
              </button>
            </div>
          </div>}
        </article>
      </main>
    );
  }

  const filtered = notifs
    .map((n, index) => ({ n, index }))
    .filter(({ n }) => filter === "todas" || n.unread);

  return (
    <main className={`${PAGE} pb-20`}>
      <PageHead
        eyebrow="Mensagens"
        title="Caixa de entrada."
        aside={
          <button
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="self-start font-sans text-[13px] text-navy/65 underline underline-offset-4 transition-colors hover:text-navy md:self-auto"
          >
            Marcar todas como lidas
          </button>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <FilterPill active={filter === "todas"} onClick={() => setFilter("todas")}>
          Todas
        </FilterPill>
        <FilterPill active={filter === "nao-lidas"} onClick={() => setFilter("nao-lidas")}>
          Não lidas · {unreadCount}
        </FilterPill>
      </div>

      <div className="vt-card divide-y divide-navy/8 overflow-hidden">
        {filtered.length === 0 ? (
          <p className="px-6 py-14 text-center font-sans text-sm text-navy/55">Nenhuma mensagem encontrada.</p>
        ) : (
          filtered.map(({ n, index }) => (
            <NotificationRow
              key={index}
              title={n.project}
              pill={pill(n.type)}
              description={`${n.from} · ${n.content}`}
              time={n.time}
              unread={n.unread}
              onClick={() => openNotif(index)}
            />
          ))
        )}
      </div>
    </main>
  );
}
