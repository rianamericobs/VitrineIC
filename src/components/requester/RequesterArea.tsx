import { useState } from "react";
import { MyDemands } from "./MyDemands";
import { MatchScreen } from "./MatchScreen";
import { NavBar } from "./NavBar";
import { NewDemandWizard } from "./NewDemandWizard";
import { SuccessScreen } from "./SuccessScreen";
import { Profile } from "./Profile";
import { AvailableStudents } from "./AvailableStudents";
import { Team } from "./Team";
import { Inbox } from "./Inbox";
import { useCurrentRequester } from "@/lib/auth";
import { useVitrine } from "@/lib/store";

export default function RequesterArea({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<"dashboard" | "new" | "success" | "matches" | "profile" | "available_students" | "team" | "inbox">("available_students");
  const [protocol, setProtocol] = useState("");
  const [matchDemand, setMatchDemand] = useState<string | null>(null);
  const { demands, interests, notifications } = useVitrine();
  const requester = useCurrentRequester();

  const myIds = new Set(demands.filter((d) => d.company === requester).map((d) => d.id));
  const awaitingMe = interests.filter((i) => myIds.has(i.demandId) && i.status === "aguardando_solicitante").length;

  const handleSetView = (v: string) => {
    if (v === "matches") setMatchDemand(null);
    setView(v as typeof view);
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen bg-offwhite">
      <NavBar
        view={view}
        setView={handleSetView}
        onBack={onBack}
        unreadCount={notifications.filter((m) => m.unread).length}
        awaitingMe={awaitingMe}
      />

      {view === "available_students" && (
        <AvailableStudents />
      )}

      {view === "dashboard" && (
        <MyDemands
          onNew={() => handleSetView("new")}
          onViewMatch={(id) => {
            setMatchDemand(id);
            setView("matches");
            window.scrollTo(0, 0);
          }}
        />
      )}

      {view === "new" && (
        <NewDemandWizard
          onCancel={() => handleSetView("dashboard")}
          onSuccess={(p) => {
            setProtocol(p);
            handleSetView("success");
          }}
        />
      )}

      {view === "success" && (
        <SuccessScreen
          protocol={protocol}
          onDashboard={() => handleSetView("dashboard")}
        />
      )}

      {view === "matches" && (
        <MatchScreen
          key={matchDemand ?? "todas"}
          demandId={matchDemand}
          onBack={matchDemand ? () => handleSetView("dashboard") : undefined}
        />
      )}

      {view === "team" && <Team onInvite={() => handleSetView("available_students")} />}

      {view === "inbox" && <Inbox />}

      {view === "profile" && <Profile />}
    </div>
  );
}
