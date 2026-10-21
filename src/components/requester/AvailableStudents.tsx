import { useState } from "react";
import { SelectField } from "./ui";
import { useCurrentRequester } from "@/lib/auth";
import { isProfileVisible } from "@/lib/profile";
import { createInterest, findActiveInterest, useVitrine } from "@/lib/store";
import { Avatar } from "@/components/app/Avatar";
import { ArrowIcon } from "@/components/app/Icons";
import { InProjectBadge } from "@/components/app/InProjectBadge";
import { InterestStatusPill } from "@/components/app/InterestStatusPill";
import { Modal } from "@/components/app/Modal";
import { BackButton } from "@/components/public/BackButton";
import { Eyebrow } from "@/components/public/Eyebrow";
import { PageHead } from "@/components/public/PageHead";
import { PAGE } from "@/components/public/layout";

function StudentCard({ student, inProject, onClick }: { student: any; inProject: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="vt-card vt-card-interactive flex flex-col gap-4 p-5 text-left">
      <div className="flex w-full items-start gap-3">
        <Avatar name={student.name} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-medium leading-[1.25] tracking-[-0.01em] text-navy">{student.name}</p>
          <p className="mt-0.5 font-sans text-[13px] text-navy/55">
            {student.course} · {student.semester}
          </p>
        </div>
        {inProject && <InProjectBadge />}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {student.skills.slice(0, 3).map((s: string) => (
          <span key={s} className="vt-pill">
            {s}
          </span>
        ))}
        {student.skills.length > 3 && (
          <span className="self-center font-mono text-[10px] text-navy/45">+{student.skills.length - 3}</span>
        )}
      </div>
      <span className="mt-auto flex items-center gap-1.5 border-t border-navy/8 pt-4 font-sans text-[13px] text-navy/65">
        Ver perfil <ArrowIcon />
      </span>
    </button>
  );
}

/**
 * Vitrine de estudantes vista pelo solicitante. Daqui ele convida direto:
 * o convite vira um interesse que espera o aceite do estudante.
 */
export function AvailableStudents() {
  const { demands, interests, inProject, students } = useVitrine();
  const requester = useCurrentRequester();
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [selectedDemand, setSelectedDemand] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const myOpenDemands = demands.filter((d) => d.company === requester && d.status === "aprovada");
  const demand = myOpenDemands.find((d) => d.title === selectedDemand);
  const existing = demand && selectedStudent ? findActiveInterest(interests, demand.id, selectedStudent.id) : undefined;

  const closeOffer = () => {
    setShowOfferModal(false);
    setSelectedDemand("");
    setMessage("");
    setSent(false);
  };

  if (selectedStudent) {
    const skillNames: string[] = selectedStudent.skills.map((s: any) => (typeof s === "string" ? s : s.name));

    return (
      <main className={`${PAGE} pt-8 pb-20`}>
        <BackButton label="Voltar para estudantes disponíveis" onClick={() => setSelectedStudent(null)} />

        <div className="mt-10 grid items-start gap-6 lg:grid-cols-[340px_1fr]">
          <aside className="flex flex-col gap-6">
            <div className="vt-card flex flex-col p-7">
              <Avatar name={selectedStudent.name} size="xl" />
              <h1 className="mt-6 font-display text-[22px] font-medium tracking-[-0.01em] text-navy">
                {selectedStudent.name}
              </h1>
              <p className="mt-1 font-sans text-sm text-navy/60">
                {selectedStudent.course} · {selectedStudent.semester}
              </p>
              {inProject[selectedStudent.id] && (
                <div className="mt-3">
                  <InProjectBadge />
                </div>
              )}
              <button onClick={() => setShowOfferModal(true)} className="vt-btn vt-btn-primary mt-6 w-full">
                Convidar <ArrowIcon />
              </button>
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.08em] text-navy/55">
                Contato liberado quando o estudante aceitar
              </p>
            </div>

            <div className="vt-card flex flex-col gap-4 p-7">
              <Eyebrow>Competências técnicas</Eyebrow>
              <div className="flex flex-wrap gap-1.5">
                {skillNames.map((s) => (
                  <span key={s} className="vt-pill">
                    {s}
                  </span>
                ))}
              </div>
              <div className="mt-2">
                <Eyebrow>Idiomas</Eyebrow>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="vt-pill">Inglês (Avançado)</span>
              </div>
            </div>
          </aside>

          <div className="flex min-w-0 flex-col gap-6">
            <section className="vt-card p-7">
              <Eyebrow>Sobre</Eyebrow>
              <p className="mt-4 font-sans text-[15px] leading-[1.6] text-navy/75">
                {selectedStudent.bio || "Estudante altamente engajado e em busca de novos desafios em desenvolvimento de software e inteligência artificial."}
              </p>
              <p className="mt-4 font-mono text-[11px] text-navy/55">
                github.com/{selectedStudent.name.split(" ")[0].toLowerCase()}
              </p>
            </section>

            <section className="vt-card p-7">
              <Eyebrow>Projetos e experiências</Eyebrow>
              <div className="mt-2 flex flex-col divide-y divide-navy/8">
                {[
                  {
                    tag: "Em andamento",
                    title: "API RESTful para E-commerce",
                    text: "Construção de microsserviços usando Node.js e banco de dados PostgreSQL.",
                    red: true,
                  },
                  {
                    tag: "Concluído (2025)",
                    title: "App Mobile de Mobilidade Urbana",
                    text: "Desenvolvimento de aplicativo em React Native para otimizar rotas de ônibus fretados.",
                    red: false,
                  },
                ].map((p) => (
                  <div key={p.title} className="py-5">
                    <p className={`font-mono text-[10px] uppercase tracking-[0.08em] ${p.red ? "text-red" : "text-navy/55"}`}>
                      {p.tag}
                    </p>
                    <h3 className="mt-2 font-display text-lg font-medium text-navy">{p.title}</h3>
                    <p className="mt-1 font-sans text-sm leading-[1.6] text-navy/65">{p.text}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        {showOfferModal && (
          <Modal eyebrow="Convite" title={sent ? "Convite enviado." : "Convidar estudante."} onClose={closeOffer}>
            {sent ? (
              <>
                <p className="font-sans text-sm leading-[1.6] text-navy/65">
                  {selectedStudent.name} recebe o convite na área dele. O contato é liberado para os dois lados assim que
                  ele aceitar; você acompanha em Interessados.
                </p>
                <button onClick={closeOffer} className="vt-btn vt-btn-primary mt-6 w-full">
                  Fechar
                </button>
              </>
            ) : (
              <>
                <p className="mb-6 font-sans text-sm leading-[1.6] text-navy/65">
                  Escolha para qual das suas demandas abertas você quer convidar este estudante.
                </p>
                <SelectField
                  label="Demanda"
                  options={myOpenDemands.map((d) => d.title)}
                  value={selectedDemand}
                  onChange={setSelectedDemand}
                />
                <label className="mt-5 mb-2 block font-mono text-[10px] uppercase tracking-[0.08em] text-navy/65">
                  Mensagem (opcional)
                </label>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="O que chamou sua atenção no perfil dele..."
                  className="vt-input"
                />
                {existing ? (
                  <div className="mt-6 flex items-center gap-3">
                    <InterestStatusPill status={existing.status} viewer="solicitante" />
                    <span className="font-sans text-xs text-navy/55">Já existe um interesse com este estudante nesta demanda.</span>
                  </div>
                ) : (
                  <button
                    disabled={!demand}
                    onClick={async () => {
                      if (!demand) return;
                      if (!await createInterest(demand.id, selectedStudent.id, "convite", message)) return;
                      setSent(true);
                    }}
                    className="vt-btn vt-btn-primary mt-6 w-full"
                  >
                    Enviar convite <ArrowIcon />
                  </button>
                )}
              </>
            )}
          </Modal>
        )}
      </main>
    );
  }

  return (
    <main className={`${PAGE} pb-20`}>
      <PageHead
        eyebrow="Talentos"
        title="Estudantes disponíveis."
        lead="Consulte os perfis e convide quem combina com as suas demandas. O contato é liberado quando o estudante aceitar."
      />

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {students.filter(isProfileVisible).slice(0, 10).map((s) => (
          <StudentCard key={s.id} student={s} inProject={!!inProject[s.id]} onClick={() => setSelectedStudent(s)} />
        ))}
      </div>
    </main>
  );
}
