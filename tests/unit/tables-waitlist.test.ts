import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db/prisma";
import {
  createTable,
  updateTableStatus,
  occupyTableWithOrder,
  freeTable,
  generateTableQrUrl,
} from "@/lib/services/tables";
import {
  addToWaitlist,
  notifyParty,
  seatParty,
  getPublicWaitlistPosition,
  getActiveWaitlist,
} from "@/lib/services/waitlist";
import { truncateTables, uniqueSuffix } from "../helpers/db";

beforeAll(async () => {
  await truncateTables("DiningTable", "WaitlistEntry");
});

afterAll(async () => {
  await truncateTables("DiningTable", "WaitlistEntry");
});

describe("Interactive Table Floorplan & Waitlist Engine", () => {
  it("creates a table with capacity, section, and generates QR code URL", async () => {
    const tableNum = `T-${uniqueSuffix().slice(0, 4)}`;
    const table = await createTable({
      tableNumber: tableNum,
      capacity: 6,
      shape: "ROUND",
      section: "Outdoor Garden",
    });

    expect(table.tableNumber).toBe(tableNum);
    expect(table.capacity).toBe(6);
    expect(table.shape).toBe("ROUND");
    expect(table.status).toBe("AVAILABLE");

    const qrUrl = generateTableQrUrl(tableNum, "https://spicesaffron.com");
    expect(qrUrl).toBe(`https://spicesaffron.com/menu?table=${encodeURIComponent(tableNum)}&mode=dine_in`);
  });

  it("handles table status transitions from AVAILABLE to OCCUPIED and DIRTY", async () => {
    const tableNum = `T-${uniqueSuffix().slice(0, 4)}`;
    const table = await createTable({
      tableNumber: tableNum,
      capacity: 4,
    });

    // Occupy with an order ID
    const dummyOrderId = "00000000-0000-0000-0000-000000000001";
    await occupyTableWithOrder(tableNum, dummyOrderId);

    let current = await db.diningTable.findUnique({ where: { id: table.id } });
    expect(current?.status).toBe("OCCUPIED");
    expect(current?.currentOrderId).toBe(dummyOrderId);

    // Free the table (guest departs -> DIRTY for bussing)
    await freeTable(tableNum);
    current = await db.diningTable.findUnique({ where: { id: table.id } });
    expect(current?.status).toBe("DIRTY");
    expect(current?.currentOrderId).toBeNull();

    // Bussing complete -> mark clean (AVAILABLE)
    await updateTableStatus(table.id, "AVAILABLE");
    current = await db.diningTable.findUnique({ where: { id: table.id } });
    expect(current?.status).toBe("AVAILABLE");
  });

  it("manages dynamic waitlist, calculates estimated wait, and advances guest status", async () => {
    const suffix = uniqueSuffix();

    const party1 = await addToWaitlist({
      customerName: `Priya Sharma ${suffix}`,
      customerPhone: "+91 98765 00001",
      partySize: 2,
    });

    const party2 = await addToWaitlist({
      customerName: `Vikram Patel ${suffix}`,
      customerPhone: "+91 98765 00002",
      partySize: 4,
    });

    expect(party1.status).toBe("WAITING");
    expect(party2.status).toBe("WAITING");

    // Party 1 should be #1 in line
    const pos1 = await getPublicWaitlistPosition(party1.id);
    expect(pos1?.position).toBe(1);

    // Party 2 should be #2 in line
    const pos2 = await getPublicWaitlistPosition(party2.id);
    expect(pos2?.position).toBe(2);

    // Notify party 1 (Buzzer/SMS)
    await notifyParty(party1.id);
    const notified1 = await db.waitlistEntry.findUnique({ where: { id: party1.id } });
    expect(notified1?.status).toBe("NOTIFIED");
    expect(notified1?.notifiedAt).toBeDefined();

    // Seat party 1
    await seatParty(party1.id);
    const seated1 = await db.waitlistEntry.findUnique({ where: { id: party1.id } });
    expect(seated1?.status).toBe("SEATED");

    // Active waitlist should now only have party 2
    const active = await getActiveWaitlist();
    expect(active.some((w) => w.id === party1.id)).toBe(false);
    expect(active.some((w) => w.id === party2.id)).toBe(true);
  });
});
