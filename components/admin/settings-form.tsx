"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, StatusMessage, type FieldErrors } from "@/components/admin/form-field";
import { Textarea } from "@/components/ui/textarea";
import { updateSettingsAction } from "@/app/admin/actions/settings";

export interface SettingsValues {
  cafeName: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  mapsLink: string;
  openingHours: string;
  instagram: string;
  facebook: string;
  whatsapp: string;
  reservationLink: string;
}

export interface PlanUsageView {
  plan: string;
  usage: { resource: string; used: number; limit: number }[];
}

const RESOURCE_LABELS: Record<string, string> = {
  dishes: "Dishes",
  galleryImages: "Gallery images",
  adminUsers: "Admin users",
  ordersPerMonth: "Orders this month",
  apiKeys: "API keys",
};

export function SettingsForm({
  values,
  canEdit = true,
  planUsage,
}: {
  values: SettingsValues;
  canEdit?: boolean;
  planUsage?: PlanUsageView;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !canEdit) return;

    const data = new FormData(event.currentTarget);
    if (!String(data.get("cafeName") ?? "").trim()) {
      setFieldErrors({ cafeName: "Enter the cafe name." });
      setError("Please fix the highlighted fields.");
      setSaved(false);
      return;
    }
    setSaved(false);
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await updateSettingsAction({
        cafeName: data.get("cafeName"),
        tagline: data.get("tagline"),
        phone: data.get("phone"),
        email: data.get("email"),
        address: data.get("address"),
        mapsLink: data.get("mapsLink"),
        openingHours: data.get("openingHours"),
        instagram: data.get("instagram"),
        facebook: data.get("facebook"),
        whatsapp: data.get("whatsapp"),
        reservationLink: data.get("reservationLink"),
      });

      if (!result.ok) {
        const message = result.error ?? "Could not save settings.";
        // The action reports validation problems as "fieldName: message".
        const match = /^([A-Za-z]+):\s*(.+)$/.exec(message);
        if (match && match[1] in values) {
          setFieldErrors({ [match[1]]: match[2] });
        }
        setError(message);
        return;
      }

      setSaved(true);
      router.refresh();
    });
  }

  const field = (name: keyof SettingsValues, label: string, props?: Record<string, unknown>) => (
    <Field id={`settings-${name}`} label={label} required={name === "cafeName"} error={fieldErrors[name]}>
      {(p) => <Input {...p} name={name} defaultValue={values[name]} className="bg-background" {...props} />}
    </Field>
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-2xl space-y-6">
      {planUsage && (
        <section className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-card">
          <h2 className="heading-display text-xl">Plan: {planUsage.plan}</h2>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {planUsage.usage.map((row) => (
              <li key={row.resource} className="flex justify-between gap-4">
                <span className="text-muted-foreground">{RESOURCE_LABELS[row.resource] ?? row.resource}</span>
                <span>
                  {row.used} / {Number.isFinite(row.limit) ? row.limit : "unlimited"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <fieldset disabled={!canEdit || pending} className="min-w-0 space-y-6">
      <legend className="sr-only">Business settings</legend>
      <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="heading-display text-xl">Business details</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {field("cafeName", "Cafe name", { maxLength: 120 })}
          {field("tagline", "Tagline", { maxLength: 200 })}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {field("phone", "Phone", { type: "tel", maxLength: 20 })}
          {field("email", "Email", { type: "email", maxLength: 254 })}
        </div>
        {field("address", "Address", { maxLength: 300 })}
        {field("mapsLink", "Google Maps link", { type: "url", maxLength: 500 })}
      </section>

      <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="heading-display text-xl">Opening hours</h2>
        <Field
          id="settings-openingHours"
          label="Weekly schedule (JSON)"
          error={fieldErrors.openingHours}
          hint="Keys are weekday names in lowercase. Shown on the contact page and footer."
        >
          {(p) => (
            <Textarea
              {...p}
              name="openingHours"
              rows={7}
              defaultValue={values.openingHours}
              className="bg-background font-mono text-xs"
              spellCheck={false}
            />
          )}
        </Field>
      </section>

      <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="heading-display text-xl">Social &amp; booking</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {field("instagram", "Instagram URL", { type: "url", maxLength: 300 })}
          {field("facebook", "Facebook URL", { type: "url", maxLength: 300 })}
          {field("whatsapp", "WhatsApp number", { maxLength: 20 })}
          {field("reservationLink", "Reservation link", { type: "url", maxLength: 500 })}
        </div>
      </section>

      </fieldset>

      {!canEdit ? (
        <p role="status" className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
          You can view these settings but your role cannot change them.
        </p>
      ) : (
        <>
          <StatusMessage error={error} ok={saved ? "Settings saved." : null} />
          <div className="flex items-center gap-4">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save settings"}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
