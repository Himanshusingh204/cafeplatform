import { Router } from "express";
import { getApiMenuCatalog } from "@/lib/services/menu";
import { sendError } from "./errors";
import { verifyExpressS2S } from "./s2s";

export const menuRouter = Router();

// Same contract as app/api/v1/menu/route.ts: S2S auth with menu:read and the
// catalog from the shared service, so the two runtimes cannot drift.
menuRouter.get("/", async (req, res) => {
  try {
    const auth = await verifyExpressS2S(req, "menu:read");
    if (!auth.success) {
      sendError(req, res, auth.status, auth.error);
      return;
    }

    const { data, fromCache } = await getApiMenuCatalog(auth.context.tenantId);

    res.setHeader("X-Cache-Lookup", fromCache ? "HIT" : "MISS");
    res.json({
      tenant: {
        id: auth.context.tenant.id,
        slug: auth.context.tenant.slug,
        name: auth.context.tenant.name,
      },
      totalCategories: data.length,
      data,
    });
  } catch (error) {
    console.error("Failed to load menu:", error);
    sendError(req, res, 500, "Failed to load menu");
  }
});
