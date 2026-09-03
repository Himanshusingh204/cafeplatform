"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function SettingsForm({ values }: { values: SettingsValues }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const data = new FormData(event.currentTarget);
    setPending(true);
    setSaved(false);
    setError(null);

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

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Could not save settings.");
      return;
    }

    setSaved(true);
    router.refresh();
  }

  const field = (name: keyof SettingsValues, label: string, props?: Record<string, unknown>) => (
    <div className="space-y-2">
      <Label htmlFor={`settings-${name}`}>{label}</Label>
      <Input id={`settings-${name}`} name={name} defaultValue={values[name]} {...props} />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="heading-display text-xl">Business details</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {field("cafeName", "Café name *", { required: true, maxLength: 120 })}
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
        <div className="space-y-2">
          <Label htmlFor="settings-openingHours">Weekly schedule (JSON)</Label>
          <Textarea
            id="settings-openingHours"
            name="openingHours"
            rows={7}
            defaultValue={values.openingHours}
            className="font-mono text-xs"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            Keys are weekday names in lowercase; shown on the contact page and footer.
          </p>
        </div>
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

      {error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
        {saved ? (
          <p role="status" className="text-sm font-medium text-success">
            Settings saved.
          </p>
        ) : null}
      </div>
    </form>
  );
}
