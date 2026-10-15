import "server-only";

import { db } from "@/lib/db/prisma";
import type { TableStatus, TableShape } from "@/lib/generated/prisma/enums";

export interface CreateTableInput {
  tableNumber: string;
  capacity?: number;
  shape?: TableShape;
  section?: string;
  posX?: number;
  posY?: number;
  width?: number;
  height?: number;
  tenantId?: string;
}

export interface UpdateTableInput {
  tableNumber?: string;
  capacity?: number;
  status?: TableStatus;
  shape?: TableShape;
  section?: string;
  posX?: number;
  posY?: number;
  width?: number;
  height?: number;
  currentOrderId?: string | null;
  isActive?: boolean;
}

/**
 * Fetch all active dining tables
 */
export async function getAllTables(tenantId?: string) {
  const where = {
    isActive: true,
    ...(tenantId ? { tenantId } : {}),
  };

  const tables = await db.diningTable.findMany({
    where,
    orderBy: [{ section: "asc" }, { tableNumber: "asc" }],
  });

  return tables;
}

/**
 * Get single table by table number
 */
export async function getTableByNumber(tableNumber: string, tenantId?: string) {
  return db.diningTable.findFirst({
    where: {
      tableNumber,
      isActive: true,
      ...(tenantId ? { tenantId } : {}),
    },
  });
}

/**
 * Create a new table on floorplan
 */
export async function createTable(input: CreateTableInput) {
  const existing = await db.diningTable.findFirst({
    where: {
      tableNumber: input.tableNumber.trim(),
      ...(input.tenantId ? { tenantId: input.tenantId } : {}),
    },
  });

  if (existing) {
    throw new Error(`Table "${input.tableNumber}" already exists.`);
  }

  return db.diningTable.create({
    data: {
      tableNumber: input.tableNumber.trim(),
      capacity: input.capacity ?? 4,
      shape: input.shape ?? "RECTANGLE",
      section: input.section?.trim() || "Main Dining",
      posX: input.posX ?? 100,
      posY: input.posY ?? 100,
      width: input.width ?? 120,
      height: input.height ?? 80,
      tenantId: input.tenantId || null,
    },
  });
}

/**
 * Update table layout or details
 */
export async function updateTable(id: string, input: UpdateTableInput) {
  return db.diningTable.update({
    where: { id },
    data: {
      tableNumber: input.tableNumber?.trim(),
      capacity: input.capacity,
      status: input.status,
      shape: input.shape,
      section: input.section?.trim(),
      posX: input.posX,
      posY: input.posY,
      width: input.width,
      height: input.height,
      currentOrderId: input.currentOrderId,
      isActive: input.isActive,
    },
  });
}

/**
 * Quick status change (e.g. AVAILABLE, OCCUPIED, DIRTY, RESERVED)
 */
export async function updateTableStatus(
  id: string,
  status: TableStatus,
  currentOrderId?: string | null
) {
  return db.diningTable.update({
    where: { id },
    data: {
      status,
      currentOrderId: currentOrderId !== undefined ? currentOrderId : undefined,
    },
  });
}

/**
 * Associate an order with a table and mark OCCUPIED
 */
export async function occupyTableWithOrder(tableNumber: string, orderId: string) {
  const table = await db.diningTable.findFirst({
    where: { tableNumber, isActive: true },
  });

  if (!table) return null;

  return db.diningTable.update({
    where: { id: table.id },
    data: {
      status: "OCCUPIED",
      currentOrderId: orderId,
    },
  });
}

/**
 * Free up table when guest departs
 */
export async function freeTable(tableNumber: string) {
  const table = await db.diningTable.findFirst({
    where: { tableNumber, isActive: true },
  });

  if (!table) return null;

  return db.diningTable.update({
    where: { id: table.id },
    data: {
      status: "DIRTY", // Requires bussing/cleaning before becoming AVAILABLE
      currentOrderId: null,
    },
  });
}

/**
 * Delete / soft-delete table
 */
export async function deleteTable(id: string) {
  return db.diningTable.update({
    where: { id },
    data: { isActive: false },
  });
}

/**
 * Generate Dine-In QR redirect URL
 */
export function generateTableQrUrl(tableNumber: string, baseUrl?: string): string {
  const base = baseUrl || "";
  return `${base}/menu?table=${encodeURIComponent(tableNumber)}&mode=dine_in`;
}
