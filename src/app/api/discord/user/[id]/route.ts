import { fetchDiscordUser } from "@/lib/discord-rest";
import {
  canAccessStaffTools,
  canViewProfiles,
} from "@/lib/permissions";
import {
  jsonAuthError,
  requireApprovedAccount,
} from "@/lib/server-authorization";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireApprovedAccount();
    const { id } = await context.params;
    const user = await fetchDiscordUser(id);
    if (!user) {
      return Response.json({ error: "ID Discord invalide." }, { status: 400 });
    }
    const staff = canAccessStaffTools(actor.grade) || canViewProfiles(actor.grade);
    if (!staff) {
      return Response.json({ ...user, roles: [], grade: null });
    }
    return Response.json(user);
  } catch (error) {
    return jsonAuthError(error);
  }
}
