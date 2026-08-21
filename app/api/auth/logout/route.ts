import { deleteSession, getSession } from "@/lib/auth/session";
import { logAction } from "@/lib/services/audit";
import { ok, unauthorized } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function POST() {
  const admin = await getSession();
  if (!admin) return unauthorized();

  const actorId = admin.id;
  await deleteSession();

  await logAction({ actorId, action: "LOGOUT", entityType: "ADMIN", entityId: actorId }).catch(() => undefined);

  return ok({ loggedOut: true });
}