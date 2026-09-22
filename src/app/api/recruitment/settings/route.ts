import { canAccessStaffTools } from "@/lib/permissions";
import { getRecruitmentSettings, saveRecruitmentSettings } from "@/lib/recruitment-settings";
import { requireApprovedActor } from "@/lib/server-authorization";
import { writeAudit } from "@/lib/audit";

export async function GET() {
  try {
    return Response.json({ settings: await getRecruitmentSettings() });
  } catch {
    return Response.json({ error: "Impossible de connaître l’état des recrutements." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireApprovedActor();
    if (!canAccessStaffTools(actor.grade)) return Response.json({ error: "Accès réservé au staff." }, { status: 403 });
    const body = await request.json().catch(() => null) as { open?: boolean; message?: string } | null;
    if (!body || typeof body.open !== "boolean") return Response.json({ error: "État de recrutement invalide." }, { status: 400 });
    const settings = await saveRecruitmentSettings({ open: body.open, message: String(body.message || ""), actorId: actor.userId });
    await writeAudit({ actorId: actor.userId, actorName: actor.displayName, action: body.open ? "recruitment.opened" : "recruitment.closed", entityType: "recruitment_settings", metadata: { message: settings.message } });
    return Response.json({ settings });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: "Impossible de modifier les recrutements." }, { status: 500 });
  }
}
