import { useState } from "react";
import { ConfirmModal } from "./ConfirmModal";
import { InterestsOverview } from "./InterestsOverview";
import { MatchConfirmed } from "./MatchConfirmed";
import { Matchmaking } from "./Matchmaking";
import { MatchmakingHub } from "./MatchmakingHub";
import { NavBar, type CuratorTab } from "./NavBar";
import { Triage } from "./Triage";
import { createInterest, useVitrine } from "@/lib/store";
import type { Demand, Interest, Student } from "@/types";

export default function CuratorArea({ onBack }: { onBack: () => void }) {
  const { demands } = useVitrine();
  const [view, setView] = useState<CuratorTab | "matchmaking" | "confirm" | "confirmed">("triage");
  const [selectedDemandId, setSelectedDemandId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [suggestion, setSuggestion] = useState<Interest | null>(null);
  const selectedDemand = demands.find((d) => d.id === selectedDemandId) ?? null;

  const go = (v: typeof view) => {
    setView(v);
    window.scrollTo(0, 0);
  };

  const goToMatch = (d: Demand) => {
    setSelectedDemandId(d.id);
    go("matchmaking");
  };

  const goToConfirm = (s: Student) => {
    setSelectedStudent(s);
    setView("confirm");
  };

  /** A curadoria não fecha match: cria uma sugestão, que o estudante responde primeiro. */
  const doSuggest = async (justification: string) => {
    if (selectedDemand && selectedStudent) {
      const interest = await createInterest(selectedDemand.id, selectedStudent.id, "sugestao", justification);
      if (!interest) return;
      setSuggestion(interest);
    }
    go("confirmed");
  };

  return (
    <div className="min-h-screen bg-offwhite">
      <NavBar view={view} setView={go} onBack={onBack} demands={demands} />

      {view === "triage" && <Triage demands={demands} />}

      {view === "matchmaking_hub" && <MatchmakingHub demands={demands} onSelect={goToMatch} />}

      {view === "interests" && <InterestsOverview />}

      {(view === "matchmaking" || view === "confirm") && selectedDemand && (
        <Matchmaking demand={selectedDemand} onConfirm={goToConfirm} onBack={() => go("matchmaking_hub")} />
      )}

      {view === "confirmed" && selectedDemand && selectedStudent && suggestion && (
        <MatchConfirmed
          demand={selectedDemand}
          student={selectedStudent}
          suggestion={suggestion}
          onBack={() => go("matchmaking_hub")}
        />
      )}

      {view === "confirm" && selectedDemand && selectedStudent && (
        <ConfirmModal
          demand={selectedDemand}
          student={selectedStudent}
          onClose={() => setView("matchmaking")}
          onConfirm={doSuggest}
        />
      )}
    </div>
  );
}
