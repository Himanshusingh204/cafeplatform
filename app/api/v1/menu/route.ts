import { apiError } from "@/lib/api/errors";
import { NextResponse } from "next/server";
import { verifyS2SRequest } from "@/lib/auth/s2s";
import { getApiMenuCatalog } from "@/lib/services/menu";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/menu
 * B2B S2S endpoint to sync the active menu catalog with external POS, aggregators, or digital displays.
 * Catalog loading and caching live in `lib/services/menu.ts`, shared with the Express adapter.
 */
export async function GET(request: Request) {
  const auth = await verifyS2SRequest(request, "menu:read");
  if (!auth.success) {
    return apiError(auth.status, auth.error);
  }

  const { data: categories, fromCache } = await getApiMenuCatalog(auth.context.tenantId);

  return NextResponse.json(
    {
      tenant: {
        id: auth.context.tenant.id,
        slug: auth.context.tenant.slug,
        name: auth.context.tenant.name,
      },
      totalCategories: categories.length,
      data: categories,
    },
    { headers: { "X-Cache-Lookup": fromCache ? "HIT" : "MISS" } }
  );
}
