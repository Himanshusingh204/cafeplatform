import "server-only";

import { unstable_cache } from "next/cache";
import { db } from "@/lib/db/prisma";
import { site } from "@/config/site";
import { logAction } from "@/lib/services/audit";

const DEFAULTS: Record<string, string> = {
  cafeName: site.name,
  tagline: site.tagline,
  phone: site.phone,
  email: site.email,
  address: site.address,
  mapsLink: site.mapsLink,
  openingHours: JSON.stringify(site.openingHours),
  instagram: site.instagram,
  facebook: site.facebook,
  whatsapp: site.whatsapp,
  reservationLink: site.reservationLink,
};

export type SiteSettings = Record<keyof typeof DEFAULTS, string>;

export function normalizeSettings(rows: { key: string; value: string }[]): SiteSettings {
  const out = { ...DEFAULTS } as SiteSettings;
  for (const row of rows) {
    if (row.key in out) {
      out[row.key as keyof SiteSettings] = row.value;
    }
  }
  return out;
}

export const getSettingsCached = unstable_cache(
  async (): Promise<SiteSettings> => {
    const rows = await db.setting.findMany();
    return normalizeSettings(rows);
  },
  ["site-settings"],
  { tags: ["settings"], revalidate: 300 }
);

export async function getSettings(): Promise<SiteSettings> {
  return getSettingsCached();
}

export async function getSettingsFresh(): Promise<SiteSettings> {
  const rows = await db.setting.findMany();
  return normalizeSettings(rows);
}

export async function updateSettings(
  input: Omit<SiteSettings, "openingHours"> & { openingHours?: string },
  actorId?: string | null
) {
  const entries = Object.entries(input) as [keyof SiteSettings, string][];
  for (const [key, value] of entries) {
    await db.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  await logAction({
    actorId,
    action: "SETTINGS_CHANGED",
    entityType: "SETTING",
    entityId: null,
    metadata: { keys: entries.map(([key]) => key) },
  });
}