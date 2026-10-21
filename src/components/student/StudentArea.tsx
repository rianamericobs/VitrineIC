import { useState } from "react";
import { Opportunities } from "./Opportunities";
import { Interests } from "./Interests";
import { Projects, toMyProject } from "./Projects";
import { Profile } from "./Profile";
import { NavBar } from "./NavBar";
import { Inbox } from "./Inbox";
import { Onboarding } from "./Onboarding";
import { ArrowIcon } from "@/components/app/Icons";
import { PAGE } from "@/components/public/layout";
import { useSession } from "@/lib/auth";
import { isProfileVisible } from "@/lib/profile";
import { useVitrine } from "@/lib/store";

export default function StudentArea({ onBack }: { onBack: () => void }) {
  const session = useSession();
  const student = session?.student;
  const [resumeOnboarding, setResumeOnboarding] = useState(false);
  const [view, setView] = useState("opportunities");
  const projects = student?.projects.map(toMyProject) ?? [];
  const { interests, notifications } = useVitrine();

  if (!student) return null;

  // O onboarding abre logo depois do cadastro e some quando o estudante conclui
  // ou pula; o aviso do painel permite voltar a ele.
  if (resumeOnboarding || (!student.onboardedAt && !student.onboardingSkipped)) {
    return (
      <Onboarding
        student={student}
        onDone={() => {
          setResumeOnboarding(false);
          setView("opportunities");
          window.scrollTo(0, 0);
        }}
      />
    );
  }

  const unreadCount = notifications.filter((n) => n.unread).length;
  const awaitingMe = interests.filter(
    (i) => i.studentId === student.id && i.status === "aguardando_estudante",
  ).length;

  return (
    <div className="min-h-screen bg-offwhite">
      <NavBar
        view={view}
        setView={setView}
        onBack={onBack}
        unreadCount={unreadCount}
        awaitingMe={awaitingMe}
        name={session.account.name}
      />

      {!isProfileVisible(student) && (
        <div className={`${PAGE} pt-6`}>
          <div className="flex flex-col gap-4 rounded-2xl border border-ochre/30 bg-ochre/8 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-display text-lg font-medium tracking-[-0.01em] text-navy">
                Complete seu perfil para aparecer na vitrine
              </p>
              <p className="mt-1 font-sans text-sm text-navy/65">
                Sem nenhuma competência, você não aparece no diretório, não recebe convites e não pode se candidatar.
              </p>
            </div>
            <button onClick={() => setResumeOnboarding(true)} className="vt-btn vt-btn-primary shrink-0 self-start md:self-auto">
              Continuar onboarding <ArrowIcon />
            </button>
          </div>
        </div>
      )}

      {view === "opportunities" && (
        <Opportunities student={student} onGoToInterests={() => setView("interests")} />
      )}

      {view === "interests" && <Interests studentId={student.id} />}

      {view === "projects" && (
        <Projects projects={projects} studentId={student.id} />
      )}

      {view === "inbox" && <Inbox />}

      {view === "profile" && <Profile student={student} email={session.account.email} projects={projects} />}
    </div>
  );
}
