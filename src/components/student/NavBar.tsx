import { AreaNav } from "@/components/app/AreaNav";
import { UpdatesMenu } from "@/components/app/UpdatesMenu";

/**
 * Barra da área do estudante, no modelo do Figma. A caixa de entrada sai das
 * abas e vira ícone ao lado do sino, que só traz avisos curtos.
 */
export function NavBar({
  view,
  setView,
  onBack,
  unreadCount = 0,
  awaitingMe = 0,
  name,
}: {
  view: string;
  setView: (v: string) => void;
  onBack: () => void;
  unreadCount?: number;
  /** Convites e sugestões esperando a resposta do estudante. */
  awaitingMe?: number;
  name: string;
}) {
  return (
    <AreaNav
      items={[
        { id: "opportunities", label: "Oportunidades" },
        { id: "interests", label: "Interesses", badge: awaitingMe },
        { id: "projects", label: "Meus projetos" },
        { id: "profile", label: "Perfil" },
      ]}
      active={view}
      onSelect={setView}
      avatar={name || "Estudante"}
      onInbox={() => setView("inbox")}
      inboxDot={unreadCount > 0}
      inboxActive={view === "inbox"}
      bell={<UpdatesMenu onOpen={setView} />}
      onExit={onBack}
    />
  );
}
