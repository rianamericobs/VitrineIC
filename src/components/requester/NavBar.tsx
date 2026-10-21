import { AreaNav } from "@/components/app/AreaNav";
import { UpdatesMenu } from "@/components/app/UpdatesMenu";
import { useSession } from "@/lib/auth";

/**
 * Barra da área do solicitante, no modelo do Figma. "Nova demanda" só abre
 * pelo botão em Minhas demandas, e a caixa de entrada é o ícone ao lado do sino.
 */
export function NavBar({
  view,
  setView,
  onBack,
  unreadCount = 0,
  awaitingMe = 0,
}: {
  view: string;
  setView: (v: string) => void;
  onBack: () => void;
  unreadCount?: number;
  /** Candidaturas e sugestões esperando a resposta do solicitante. */
  awaitingMe?: number;
}) {
  const session = useSession();

  return (
    <AreaNav
      items={[
        { id: "available_students", label: "Estudantes disponíveis" },
        { id: "dashboard", label: "Minhas demandas" },
        { id: "matches", label: "Interessados", badge: awaitingMe },
        { id: "team", label: "Equipe" },
        { id: "profile", label: "Meu perfil" },
      ]}
      active={view === "new" || view === "success" ? "dashboard" : view}
      onSelect={setView}
      avatar={session?.account.name ?? "Solicitante"}
      onInbox={() => setView("inbox")}
      inboxDot={unreadCount > 0}
      inboxActive={view === "inbox"}
      bell={<UpdatesMenu onOpen={setView} />}
      onExit={onBack}
    />
  );
}
