import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/settings-form";
import { getSettingsFresh } from "@/lib/services/settings";
import { getAdminTenantId } from "@/lib/auth/tenant-context";
import { getPlanUsage } from "@/lib/plans";
import { requirePermission } from "@/lib/auth/guards";
import { hasPermission, permissions } from "@/config/roles";

export const metadata: Metadata = { title: "Settings" };

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const admin = await requirePermission(permissions.MANAGE_SETTINGS);
  const tenantId = await getAdminTenantId(admin);
  const [settings, planUsage] = await Promise.all([getSettingsFresh(tenantId), getPlanUsage(tenantId)]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="heading-display text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Business information shown across the public website.
        </p>
      </div>
      <SettingsForm
        planUsage={planUsage}
        canEdit={hasPermission(admin.role, permissions.MANAGE_SETTINGS)}
        values={{
          cafeName: settings.cafeName,
          tagline: settings.tagline,
          phone: settings.phone,
          email: settings.email,
          address: settings.address,
          mapsLink: settings.mapsLink,
          openingHours: settings.openingHours,
          instagram: settings.instagram,
          facebook: settings.facebook,
          whatsapp: settings.whatsapp,
          reservationLink: settings.reservationLink,
        }}
      />
    </div>
  );
}
