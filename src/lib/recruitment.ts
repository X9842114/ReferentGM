export const RECRUITMENT_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "ANALYZING",
  "STAFF_REVIEW",
  "MORE_INFO",
  "VOICE_PROPOSED",
  "DECISION_PENDING",
  "ACCEPTED",
  "REJECTED",
  "CLOSED",
] as const;

export type RecruitmentStatus = (typeof RECRUITMENT_STATUSES)[number];

export const RECRUITMENT_STATUS_LABEL: Record<RecruitmentStatus, string> = {
  DRAFT: "Brouillon",
  SUBMITTED: "Candidature envoyée",
  ANALYZING: "Dossier en cours d’analyse",
  STAFF_REVIEW: "Étude par les référents",
  MORE_INFO: "Informations supplémentaires demandées",
  VOICE_PROPOSED: "Vocal proposé",
  DECISION_PENDING: "En attente de décision",
  ACCEPTED: "Candidature acceptée",
  REJECTED: "Candidature refusée",
  CLOSED: "Candidature fermée",
};

export type RecruitmentAnalysis = {
  source: "automatic" | "groq";
  recommendation: "FAVORABLE" | "CLARIFY" | "REWORK" | "RESERVED";
  summary: string;
  strengths: string[];
  concerns: string[];
  questions: string[];
  documentAccessible: boolean;
  analyzedAt: string;
};

export type VoiceSlot = { id: string; startsAt: string; note: string };

export type RecruitmentApplication = {
  id: string;
  userId: string;
  discordName: string;
  discordAvatarUrl: string;
  firstName: string;
  age: number;
  uniqueId: string;
  experience: string;
  motivation: string;
  availability: string;
  documentUrl: string;
  trameSummary: string;
  status: RecruitmentStatus;
  analysis: RecruitmentAnalysis | null;
  candidateMessage: string | null;
  voiceSlots: VoiceSlot[];
  selectedVoiceSlotId: string | null;
  integrationAvailability: string;
  personalIntroduction: string;
  legalRpExperience: string;
  illegalRpExperience: string;
  serversVisited: string;
  rpStorylines: string;
  gmMissions: string;
  rpEvents: string;
  suggestions: string;
  whyGm: string;
  qualities: string;
  longTermContribution: string;
  staffExperience: string;
  additionalInformation: string;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
