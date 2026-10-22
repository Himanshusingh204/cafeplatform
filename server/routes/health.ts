import { Router, type Request, type Response } from "express";
import { checkReadiness } from "@/lib/observability/readiness";

export const healthRouter = Router();

/** Liveness: no dependencies. */
healthRouter.get(["/health", "/api/health"], (_req: Request, res: Response) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

/** Readiness: 503 only when Postgres is down. */
healthRouter.get(["/ready", "/api/ready"], async (_req: Request, res: Response) => {
  const { httpStatus, body } = await checkReadiness();
  res.status(httpStatus).json(body);
});
