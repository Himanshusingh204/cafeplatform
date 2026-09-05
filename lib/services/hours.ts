/**
 * Store Operating Hours & Pickup Slot Gatekeeper
 * Enforces kitchen opening/closing hours and validates order timeslots.
 */

export interface DaySchedule {
  day: number; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  name: string;
  isOpen: boolean;
  openTime: string; // "11:30"
  closeTime: string; // "22:00"
}

export const DEFAULT_SCHEDULE: DaySchedule[] = [
  { day: 0, name: "Sunday", isOpen: true, openTime: "11:30", closeTime: "22:00" },
  { day: 1, name: "Monday", isOpen: true, openTime: "11:30", closeTime: "22:00" },
  { day: 2, name: "Tuesday", isOpen: true, openTime: "11:30", closeTime: "22:00" },
  { day: 3, name: "Wednesday", isOpen: true, openTime: "11:30", closeTime: "22:00" },
  { day: 4, name: "Thursday", isOpen: true, openTime: "11:30", closeTime: "22:30" },
  { day: 5, name: "Friday", isOpen: true, openTime: "11:30", closeTime: "23:00" },
  { day: 6, name: "Saturday", isOpen: true, openTime: "11:30", closeTime: "23:00" },
];

function timeStringToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = m.toString().padStart(2, "0");
  return `${displayH}:${displayM} ${period}`;
}

export interface StoreStatus {
  isOpen: boolean;
  dayName: string;
  hoursText: string;
  message: string;
}

/**
 * Get real-time restaurant open/closed status.
 */
export function getStoreStatus(now: Date = new Date()): StoreStatus {
  const currentDay = now.getDay();
  const schedule = DEFAULT_SCHEDULE.find((s) => s.day === currentDay) || DEFAULT_SCHEDULE[0];

  if (!schedule.isOpen) {
    return {
      isOpen: false,
      dayName: schedule.name,
      hoursText: "Closed Today",
      message: "The kitchen is closed today. Pre-orders accepted for tomorrow.",
    };
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = timeStringToMinutes(schedule.openTime);
  const closeMinutes = timeStringToMinutes(schedule.closeTime);

  const openHoursStr = minutesToTimeString(openMinutes);
  const closeHoursStr = minutesToTimeString(closeMinutes);
  const hoursText = `${openHoursStr} – ${closeHoursStr}`;

  if (currentMinutes < openMinutes) {
    return {
      isOpen: false,
      dayName: schedule.name,
      hoursText,
      message: `The kitchen opens at ${openHoursStr}.`,
    };
  }

  if (currentMinutes >= closeMinutes - 15) {
    // 15-minute last-order cutoff
    return {
      isOpen: false,
      dayName: schedule.name,
      hoursText,
      message: `Kitchen is closed for the evening. Last orders close 15 minutes before ${closeHoursStr}.`,
    };
  }

  return {
    isOpen: true,
    dayName: schedule.name,
    hoursText,
    message: "Kitchen is open and accepting orders.",
  };
}

/**
 * Generate available 15-minute order timeslots for the day.
 */
export function getAvailablePickupSlots(now: Date = new Date()): string[] {
  const status = getStoreStatus(now);
  const slots: string[] = [];

  const currentDay = now.getDay();
  const schedule = DEFAULT_SCHEDULE.find((s) => s.day === currentDay) || DEFAULT_SCHEDULE[0];

  if (!schedule.isOpen) {
    return ["Closed Today (Pre-order for Tomorrow)"];
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = timeStringToMinutes(schedule.openTime);
  const closeMinutes = timeStringToMinutes(schedule.closeTime) - 15; // last order 15m before close

  if (status.isOpen) {
    slots.push("ASAP (~20–30 mins)");
  }

  // Earliest slot is max(openMinutes, next 15-minute mark + 30 mins)
  const earliestMinute = Math.max(openMinutes, Math.ceil((currentMinutes + 30) / 15) * 15);

  for (let m = earliestMinute; m <= closeMinutes; m += 15) {
    slots.push(minutesToTimeString(m));
  }

  return slots.length > 0 ? slots : ["Kitchen Closed for the Day"];
}

/**
 * Validate that a submitted order time is acceptable.
 */
export function isSlotValid(requestedTime: string, diningMode: string = "TAKEAWAY"): boolean {
  if (diningMode === "DINE_IN") {
    // Dine in ordering is immediate
    return true;
  }

  const trimmed = requestedTime.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("ASAP")) return true;

  // Check if requested time matches a valid slot
  const validSlots = getAvailablePickupSlots();
  return validSlots.some((slot) => slot.toLowerCase() === trimmed.toLowerCase());
}
