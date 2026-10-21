import type { Database, StoredAccount } from "./database";
import type { Config } from "./config";
import type { VitrineState } from "@/types/api";
import { isProfileVisible } from "@/lib/profile";
import { visibleToRequester } from "@/lib/interest";
import { publicAccount } from "./security";

const countBy = <T>(values: T[], key: (v: T) => string): [string, number][] => {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(key(value), (counts.get(key(value)) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
};

/** Toda resposta é filtrada no servidor, inclusive contatos e motivos de recusa. */
export function snapshot(db: Database, config: Config, account?: StoredAccount): VitrineState {
  const students = db.all("students");
  const demands = db.all("demands");
  const interests = db.all("interests");
  const companies = db.all("companies");
  const verifiedStudents = new Set(config.requireVerifiedEmail ? db.all("accounts").filter(a => a.role === "student" && a.emailVerifiedAt).map(a => a.profileId) : students.map(s => s.id));
  const curator = account?.role === "curator";
  const ownDemands = new Set(demands.filter(d => account?.role === "requester" && d.company === account.profileId).map(d => d.id));
  const ownInterests = interests.filter(i => curator || (account?.role === "student" && i.studentId === account.profileId) || (ownDemands.has(i.demandId) && visibleToRequester(i)));
  const contactedStudents = new Set(ownInterests.filter(i => i.status === "contato_liberado").map(i => i.studentId));
  const contactedCompanies = new Set(demands.filter(d => ownInterests.some(i => i.demandId === d.id && i.status === "contato_liberado")).map(d => d.company));
  const publicStudents = students.filter(s => isProfileVisible(s) && verifiedStudents.has(s.id));
  const visibleStudents = students.filter(s => publicStudents.includes(s) || (account?.role === "student" && s.id === account.profileId) || ownInterests.some(i => i.studentId === s.id));
  const notifications = account ? db.all("notifications").filter(n => n.accountId === account.id).map(n => {
    const { accountId: _owner, senderId: _sender, ...notification } = n;
    const interest = interests.find(i => i.id === n.interestId);
    return { ...notification, canReply: !!interest && interest.status === "contato_liberado" && !curator };
  }) : [];
  return {
    accounts: account ? [publicAccount(account)] : [],
    session: account ? { accountId: account.id } : null,
    students: visibleStudents.map(s => {
      const own = account?.role === "student" && account.profileId === s.id;
      // Nem a curadoria recebe e-mail antes dos dois aceites.
      const contact = own || (account?.role === "requester" && contactedStudents.has(s.id));
      const { matricula, certificados, ...student } = s;
      return { ...student, email: contact ? s.email : "", ...(own ? { matricula, certificados } : {}) };
    }),
    companies: companies.map(c => ({ ...c, contactEmail: (account?.role === "requester" && account.profileId === c.name) || (account?.role === "student" && contactedCompanies.has(c.name)) ? c.contactEmail : "" })),
    demands: demands.filter(d => curator || ownDemands.has(d.id) || d.status === "aprovada" || d.status === "contato_liberado" || ownInterests.some(i => i.demandId === d.id)),
    interests: ownInterests.map(i => {
      if (account?.role !== "student") return i;
      const { refusalReason: _reason, ...interest } = i;
      return interest;
    }),
    inProject: Object.fromEntries(visibleStudents.map(s => [s.id, !!s.inProject])),
    notifications,
    attachments: account?.role === "student" ? db.sql.prepare("SELECT id,name,category,length(content) AS size FROM attachments WHERE student_id=?").all(account.profileId) as unknown as VitrineState["attachments"] : [],
    impact: {
      released: interests.filter(i => i.status === "contato_liberado").length,
      projects: publicStudents.reduce((n, s) => n + s.projects.length, 0),
      demands: demands.length, students: publicStudents.length,
      byArea: countBy(demands, d => d.area), byCourse: countBy(publicStudents, s => s.course),
    },
    demo: config.demo,
    auth: { emailEnabled: config.mail.mode !== "disabled", verificationRequired: config.requireVerifiedEmail },
  };
}
