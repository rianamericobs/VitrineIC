import type { Account, Demand, Interest, Student } from "./index";
import type { Company } from "@/data/companies";

export interface Notification {
  id: string;
  type: string;
  from: string;
  project: string;
  time: string;
  unread: boolean;
  content: string;
  interestId?: string;
  canReply: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  category: "tech" | "language" | "portfolio";
  size: number;
}

export interface ImpactStats {
  released: number;
  projects: number;
  demands: number;
  students: number;
  byArea: [string, number][];
  byCourse: [string, number][];
}

export interface VitrineState {
  students: Student[];
  companies: Company[];
  accounts: Account[];
  session: { accountId: string } | null;
  demands: Demand[];
  interests: Interest[];
  inProject: Record<string, boolean>;
  notifications: Notification[];
  attachments: Attachment[];
  impact: ImpactStats;
  demo: boolean;
  auth: { emailEnabled: boolean; verificationRequired: boolean };
}
