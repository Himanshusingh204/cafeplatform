import { deleteSession, getSession } from "@/lib/auth/session";
import { logAction } from "@/lib/services/audit";
import { checkOrigin } from "@/lib/api/request";
import { forbidden, ok, unauthorized } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await checkOrigin(request))) return forbidden();

  const admin = await getSession();
  if (!admin) return unauthorized();

  const actorId = admin.id;
  await deleteSession();

  await logAction({ actorId, action: "LOGOUT", entityType: "ADMIN", entityId: actorId }).catch(() => undefined);

  return ok({ loggedOut: true });
}