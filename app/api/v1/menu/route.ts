import { NextResponse } from "next/server";
import { verifyS2SRequest } from "@/lib/auth/s2s";
import { db } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/menu
 * B2B S2S endpoint to sync the active menu catalog with external POS, aggregators, or digital displays.
 */
export async function GET(request: Request) {
  const auth = await verifyS2SRequest(request, "menu:read");
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const tenantId = auth.context.tenantId;

  const categories = await db.category.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      OR: [{ tenantId }, { tenantId: null }],
    },
    orderBy: { sortOrder: "asc" },
    include: {
      dishes: {
        where: {
          isAvailable: true,
          deletedAt: null,
          OR: [{ tenantId }, { tenantId: null }],
        },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          shortDescription: true,
          description: true,
          price: true,
          compareAtPrice: true,
          image: true,
          isFeatured: true,
          isAvailable: true,
          isVegetarian: true,
          isVegan: true,
          isSpicy: true,
          containsNuts: true,
          preparationTime: true,
          calories: true,
        },
      },
    },
  });

  return NextResponse.json({
    tenant: {
      id: auth.context.tenant.id,
      slug: auth.context.tenant.slug,
      name: auth.context.tenant.name,
    },
    totalCategories: categories.length,
    data: categories,
  });
}
