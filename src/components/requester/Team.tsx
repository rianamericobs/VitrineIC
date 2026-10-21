import { Avatar } from "@/components/app/Avatar";
import { PlusIcon } from "@/components/app/Icons";
import { PageHead } from "@/components/public/PageHead";
import { PAGE } from "@/components/public/layout";
import { useVitrine } from "@/lib/store";
import { useCurrentRequester } from "@/lib/auth";

export function Team({ onInvite }: { onInvite: () => void }) {
  const { interests, demands, students } = useVitrine();
  const requester = useCurrentRequester();
  const teamMembers = interests.filter(i => i.status === "contato_liberado").flatMap(i => {
    const demand = demands.find(d => d.id === i.demandId && d.company === requester);
    const student = students.find(s => s.id === i.studentId);
    return demand && student ? [{ id: i.id, name: student.name, email: student.email, project: demand.title, role: student.inProject ? "Em projeto" : "Contato liberado" }] : [];
  });

  return (
    <main className={`${PAGE} pb-20`}>
      <PageHead
        eyebrow="Organização"
        title="Equipe."
        lead="Estudantes com contato liberado nas suas demandas."
        aside={
          <button onClick={onInvite} className="vt-btn vt-btn-primary self-start md:self-auto">
            <PlusIcon /> Convidar membro
          </button>
        }
      />

      {teamMembers.length === 0 ? (
        <p className="vt-card px-6 py-14 text-center font-sans text-sm text-navy/55">Sua equipe está vazia.</p>
      ) : (
        <ul className="vt-card divide-y divide-navy/8 overflow-hidden">
          {teamMembers.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center gap-4 px-5 py-4 md:px-6">
              <Avatar name={member.name} />
              <div className="min-w-0 flex-1">
                <p className="font-sans text-[15px] text-navy">{member.name}</p>
                <p className="truncate font-sans text-[13px] text-navy/55">{member.email}</p>
              </div>
              <p className="hidden font-sans text-[13px] text-navy/60 md:block">{member.project}</p>
              <span className="vt-pill">{member.role}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
