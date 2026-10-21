import { Inbox as InboxView } from "@/components/app/Inbox";
import { useVitrine } from "@/lib/store";
import { MOSS, SLATE } from "@/styles/tokens";

export function Inbox() {
  const { notifications } = useVitrine();
  return <InboxView initial={notifications} typeColors={{ MENSAGEM: MOSS, SISTEMA: SLATE }} />;
}
