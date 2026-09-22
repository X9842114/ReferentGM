import { auth } from "@/auth";
import type { RecruitmentAnalysis } from "@/lib/recruitment";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getRecruitmentSettings } from "@/lib/recruitment-settings";
import { writeAudit } from "@/lib/audit";

type Body = {
  firstName?: string;
  age?: number;
  uniqueId?: string;
  experience?: string;
  motivation?: string;
  availability?: string;
  documentUrl?: string;
  trameSummary?: string;
  submit?: boolean;
  selectedVoiceSlotId?: string | null;
  integrationAvailability?: string;
  personalIntroduction?: string;
  legalRpExperience?: string;
  illegalRpExperience?: string;
  serversVisited?: string;
  rpStorylines?: string;
  gmMissions?: string;
  rpEvents?: string;
  suggestions?: string;
  whyGm?: string;
  qualities?: string;
  longTermContribution?: string;
  staffExperience?: string;
  additionalInformation?: string;
  restart?: boolean;
};

function clean(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function publicGoogleDocTextUrl(url: string) {
  const match = url.match(/docs\.google\.com\/document\/d\/([\w-]+)/i);
  return match ? `https://docs.google.com/document/d/${match[1]}/export?format=txt` : null;
}

async function extractDocumentText(url: string) {
  const target = publicGoogleDocTextUrl(url);
  if (!target) return null;
  try {
    const response = await fetch(target, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    return (await response.text()).slice(0, 16000);
  } catch {
    return null;
  }
}

async function analyze(input: Body): Promise<RecruitmentAnalysis> {
  const documentUrl = clean(input.documentUrl, 1000);
  const extracted = await extractDocumentText(documentUrl);
  const text = [input.rpStorylines, input.gmMissions, input.rpEvents, input.suggestions, input.trameSummary, extracted].map((value) => clean(value, 8000)).filter(Boolean).join("\n").trim();
  const strengths: string[] = [];
  const concerns: string[] = [];
  const questions: string[] = [];
  if (text.length >= 1200) strengths.push("Trame suffisamment détaillée pour être étudiée.");
  else concerns.push("La présentation de la trame manque encore de détails.");
  if (/conséquence|suite|échec|alternative/i.test(text)) strengths.push("La trame semble anticiper les conséquences ou alternatives.");
  else questions.push("Que se passe-t-il si les joueurs refusent ou échouent ?");
  if (/récompense|or rouge|or bleu|give/i.test(text)) questions.push("Comment les récompenses prévues sont-elles justifiées ?");
  if (/choix|liberté|plusieurs fins|improvis/i.test(text)) strengths.push("Le dossier évoque la liberté ou l’adaptation aux joueurs.");
  else concerns.push("La liberté laissée aux joueurs doit être clarifiée.");
  if (clean(input.whyGm || input.motivation, 4000).length < 120) concerns.push("La motivation mérite d’être approfondie.");
  if (`${clean(input.legalRpExperience, 4000)} ${clean(input.illegalRpExperience, 4000)}`.length >= 200) strengths.push("Les expériences RP sont expliquées de manière exploitable.");
  questions.push("Comment réagirais-tu à un conflit entre deux groupes pendant ta mission ?");
  const recommendation = concerns.length >= 3 ? "REWORK" : concerns.length ? "CLARIFY" : "FAVORABLE";
  return {
    source: "automatic",
    recommendation,
    summary: text ? text.replace(/\s+/g, " ").slice(0, 420) : "Le document n’a pas pu être lu automatiquement ; les réponses du formulaire ont été utilisées.",
    strengths,
    concerns,
    questions,
    documentAccessible: Boolean(extracted),
    analyzedAt: new Date().toISOString(),
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Connexion Discord requise." }, { status: 401 });
  const { data, error } = await getSupabaseAdmin().from("refgm_gm_applications").select("*").eq("user_id", session.user.id).maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ application: data, settings: await getRecruitmentSettings() });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !session.user?.discordLinked) return Response.json({ error: "Connexion Discord requise." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) return Response.json({ error: "Formulaire invalide." }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { data: current } = await admin.from("refgm_gm_applications").select("*").eq("user_id", userId).maybeSingle();

  if (body.restart) {
    if (!current || current.status !== "CLOSED") return Response.json({ error: "Cette candidature ne peut pas être recommencée." }, { status: 409 });
    const settings = await getRecruitmentSettings();
    if (!settings.open) return Response.json({ error: settings.message }, { status: 403 });
    const [{ data: votes, error: votesError }, { count, error: historyError }] = await Promise.all([
      admin.from("refgm_gm_application_votes").select("*").eq("application_id", current.id),
      admin.from("refgm_gm_application_history").select("id", { count: "exact", head: true }).eq("user_id", userId),
    ]);
    if (votesError || historyError) return Response.json({ error: votesError?.message || historyError?.message }, { status: 500 });
    const { error: archiveError } = await admin.from("refgm_gm_application_history").insert({
      original_application_id: current.id,
      user_id: userId,
      attempt_number: (count ?? 0) + 1,
      final_status: current.status,
      closed_from_status: current.closed_from_status,
      candidate_message: current.candidate_message,
      application_snapshot: current,
      votes_snapshot: votes ?? [],
      submitted_at: current.submitted_at,
      closed_at: current.updated_at,
    });
    if (archiveError) return Response.json({ error: archiveError.message }, { status: 500 });
    await admin.from("refgm_gm_application_votes").delete().eq("application_id", current.id);
    const now = new Date().toISOString();
    const reset = {
      discord_name: session.user.name || "Candidat Discord", discord_avatar_url: session.user.image || "",
      first_name: "", age: null, unique_id: "", experience: "", motivation: "", availability: "", document_url: "", trame_summary: "",
      status: "DRAFT", analysis: null, candidate_message: null, closed_from_status: null, voice_slots: [], selected_voice_slot_id: null,
      integration_availability: "", personal_introduction: "", legal_rp_experience: "", illegal_rp_experience: "", servers_visited: "",
      rp_storylines: "", gm_missions: "", rp_events: "", suggestions: "", why_gm: "", qualities: "", long_term_contribution: "",
      staff_experience: "", additional_information: "", submitted_at: null, created_at: now, updated_at: now,
    };
    const { data, error } = await admin.from("refgm_gm_applications").update(reset).eq("id", current.id).select("*").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    await writeAudit({ actorId: userId, actorName: session.user.name || userId, action: "recruitment.application_restarted", entityType: "gm_application", entityId: current.id, metadata: { previousDecision: current.closed_from_status, attempt: (count ?? 0) + 2 } });
    return Response.json({ application: data });
  }

  if ("selectedVoiceSlotId" in body) {
    if (!current || current.status !== "VOICE_PROPOSED") return Response.json({ error: "Aucun vocal à sélectionner." }, { status: 409 });
    const valid = (current.voice_slots ?? []).some((slot: { id: string }) => slot.id === body.selectedVoiceSlotId);
    if (!valid) return Response.json({ error: "Créneau invalide." }, { status: 400 });
    const { data, error } = await admin.from("refgm_gm_applications").update({ selected_voice_slot_id: body.selectedVoiceSlotId, updated_at: new Date().toISOString() }).eq("user_id", userId).select("*").single();
    if (!error) await writeAudit({ actorId: userId, actorName: session.user.name || userId, action: "recruitment.voice_slot_selected", entityType: "gm_application", entityId: current.id, metadata: { slotId: body.selectedVoiceSlotId } });
    return error ? Response.json({ error: error.message }, { status: 500 }) : Response.json({ application: data });
  }

  if ("integrationAvailability" in body) {
    if (!current || current.status !== "ACCEPTED") return Response.json({ error: "Cette étape d’intégration n’est pas disponible." }, { status: 409 });
    const integrationAvailability = clean(body.integrationAvailability, 2000);
    if (!integrationAvailability) return Response.json({ error: "Indique au moins une disponibilité pour ton intégration." }, { status: 400 });
    const { data, error } = await admin.from("refgm_gm_applications").update({ integration_availability: integrationAvailability, updated_at: new Date().toISOString() }).eq("user_id", userId).select("*").single();
    if (!error) await writeAudit({ actorId: userId, actorName: session.user.name || userId, action: "recruitment.integration_availability_sent", entityType: "gm_application", entityId: current.id });
    return error ? Response.json({ error: error.message }, { status: 500 }) : Response.json({ application: data });
  }

  if (current && !["DRAFT", "MORE_INFO"].includes(current.status)) return Response.json({ error: "Cette candidature ne peut plus être modifiée." }, { status: 409 });
  const settings = await getRecruitmentSettings();
  if (!settings.open && (!current || current.status === "DRAFT")) return Response.json({ error: settings.message }, { status: 403 });
  const firstName = clean(body.firstName, 80), uniqueId = clean(body.uniqueId, 80);
  const age = Number(body.age);
  const personalIntroduction = clean(body.personalIntroduction, 5000), legalRpExperience = clean(body.legalRpExperience, 5000), illegalRpExperience = clean(body.illegalRpExperience, 5000), serversVisited = clean(body.serversVisited, 3000);
  const rpStorylines = clean(body.rpStorylines, 6000), gmMissions = clean(body.gmMissions, 6000), rpEvents = clean(body.rpEvents, 6000), suggestions = clean(body.suggestions, 6000);
  const whyGm = clean(body.whyGm, 5000), qualities = clean(body.qualities, 5000), longTermContribution = clean(body.longTermContribution, 5000);
  const availability = clean(body.availability, 2000), staffExperience = clean(body.staffExperience, 4000), additionalInformation = clean(body.additionalInformation, 4000), documentUrl = clean(body.documentUrl, 1000);
  const experience = [`Expérience RP légale :\n${legalRpExperience}`, `Expérience RP illégale :\n${illegalRpExperience}`, serversVisited ? `Serveurs fréquentés :\n${serversVisited}` : ""].filter(Boolean).join("\n\n");
  const motivation = [`Pourquoi GM :\n${whyGm}`, `Qualités :\n${qualities}`, `Apport à long terme :\n${longTermContribution}`].join("\n\n");
  const trameSummary = [`Trames RP :\n${rpStorylines}`, `Missions GM :\n${gmMissions}`, `Événements RP :\n${rpEvents}`, `Suggestions :\n${suggestions}`].join("\n\n");
  if (body.submit) {
    if (!firstName || !uniqueId || !Number.isFinite(age) || age < 13 || age > 99) return Response.json({ error: "Renseigne un prénom, un âge valide et ton ID unique." }, { status: 400 });
    if (personalIntroduction.length < 80) return Response.json({ error: "Ta présentation personnelle doit contenir au moins 80 caractères." }, { status: 400 });
    if (legalRpExperience.length < 20 || illegalRpExperience.length < 20) return Response.json({ error: "Réponds aux deux questions sur tes expériences RP, même si tu n’en as pas encore." }, { status: 400 });
    if ([rpStorylines, gmMissions, rpEvents, suggestions].some((value) => value.length < 40)) return Response.json({ error: "Développe chacune de tes idées en au moins 40 caractères." }, { status: 400 });
    if ([whyGm, qualities, longTermContribution].some((value) => value.length < 60)) return Response.json({ error: "Développe chaque réponse de la section « Pourquoi toi ? » en au moins 60 caractères." }, { status: 400 });
    if (availability) { const invalidSlot = availability.split("\n").some((line) => { const match = line.match(/:\s*(\d\d:\d\d)-(\d\d:\d\d)$/); return !match || match[1] >= match[2]; }); if (invalidSlot) return Response.json({ error: "L’heure de fin doit être après l’heure de début." }, { status: 400 }); }
    try { const url = new URL(documentUrl); const allowed = /(^|\.)(canva\.com|docs\.google\.com|drive\.google\.com)$/i.test(url.hostname) || /\.pdf($|[?#])/i.test(url.pathname + url.search); if (!allowed) throw new Error(); } catch { return Response.json({ error: "Ajoute un lien Canva, Google Docs/Drive ou PDF valide et accessible." }, { status: 400 }); }
  }
  const now = new Date().toISOString();
  const analysis = body.submit ? await analyze(body) : current?.analysis ?? null;
  const row = {
    user_id: userId,
    discord_name: session.user.name || "Candidat Discord",
    discord_avatar_url: session.user.image || "",
    first_name: firstName,
    age: Number.isFinite(age) ? age : null,
    unique_id: uniqueId,
    experience,
    motivation,
    availability,
    document_url: documentUrl,
    trame_summary: trameSummary,
    personal_introduction: personalIntroduction,
    legal_rp_experience: legalRpExperience,
    illegal_rp_experience: illegalRpExperience,
    servers_visited: serversVisited,
    rp_storylines: rpStorylines,
    gm_missions: gmMissions,
    rp_events: rpEvents,
    suggestions,
    why_gm: whyGm,
    qualities,
    long_term_contribution: longTermContribution,
    staff_experience: staffExperience,
    additional_information: additionalInformation,
    status: body.submit ? "STAFF_REVIEW" : "DRAFT",
    analysis,
    submitted_at: body.submit ? now : current?.submitted_at ?? null,
    updated_at: now,
  };
  const { data, error } = await admin.from("refgm_gm_applications").upsert(row, { onConflict: "user_id" }).select("*").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  await writeAudit({ actorId: userId, actorName: session.user.name || userId, action: body.submit ? "recruitment.application_submitted" : "recruitment.draft_saved", entityType: "gm_application", entityId: data.id, metadata: { status: data.status, documentAccessible: analysis?.documentAccessible ?? null } });
  return Response.json({ application: data });
}
