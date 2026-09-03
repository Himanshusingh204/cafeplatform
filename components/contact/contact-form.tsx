"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type FormStatus = "idle" | "sending" | "sent" | "error";

interface FieldErrors {
  name?: string;
  email?: string;
  phone?: string;
  subject?: string;
  message?: string;
}

const DISPOSABLE_DOMAINS = new Set([
  "guerrillamail.com", "tempmail.com", "throwaway.email", "temp-mail.org",
  "fakeinbox.com", "sharklasers.com", "dispostable.com", "yopmail.com",
  "mailinator.com", "maildrop.cc", "trashmail.com", "10minutemail.com",
]);

function validateName(value: string): string | undefined {
  const v = value.trim();
  if (v.length < 2) return "Name must be at least 2 characters.";
  if (v.length > 120) return "Name is too long.";
  if (!/^[a-zA-Z\s.'-]+$/.test(v)) return "Name can only contain letters, spaces, hyphens, and apostrophes.";
  return undefined;
}

function validateEmail(value: string): string | undefined {
  const v = value.trim().toLowerCase();
  if (!v) return "Email is required.";
  if (v.length > 254) return "Email is too long.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Please enter a valid email address.";
  const domain = v.split("@")[1];
  if (domain && DISPOSABLE_DOMAINS.has(domain)) return "Please use a permanent email address.";
  return undefined;
}

function validatePhone(value: string): string | undefined {
  const v = value.trim();
  if (!v) return undefined; // optional
  const cleaned = v.replace(/[\s\-()+ ]/g, "");
  if (cleaned.length < 7) return "Phone number is too short.";
  if (cleaned.length > 20) return "Phone number is too long.";
  if (!/^[+]?\d+$/.test(cleaned)) return "Please enter a valid phone number.";
  return undefined;
}

function validateSubject(value: string): string | undefined {
  const v = value.trim();
  if (v.length < 2) return "Subject must be at least 2 characters.";
  if (v.length > 120) return "Subject is too long.";
  if (/^(test|asdf|hello|hi|hey)$/i.test(v)) return "Please enter a meaningful subject.";
  return undefined;
}

function validateMessage(value: string): string | undefined {
  const v = value.trim();
  if (v.length < 10) return "Message must be at least 10 characters.";
  if (v.length > 2000) return "Message is too long.";
  return undefined;
}

export function ContactForm() {
  const [status, setStatus] = React.useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const openedAt = React.useRef(0);

  React.useEffect(() => {
    openedAt.current = Date.now();
  }, []);

  function validateField(name: string, value: string): string | undefined {
    switch (name) {
      case "name": return validateName(value);
      case "email": return validateEmail(value);
      case "phone": return validatePhone(value);
      case "subject": return validateSubject(value);
      case "message": return validateMessage(value);
      default: return undefined;
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const error = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    if (touched[name]) {
      const error = validateField(name, value);
      setErrors((prev) => ({ ...prev, [name]: error }));
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;

    const form = event.currentTarget;
    const data = new FormData(form);

    // Validate all fields
    const allErrors: FieldErrors = {
      name: validateName(data.get("name") as string),
      email: validateEmail(data.get("email") as string),
      phone: validatePhone(data.get("phone") as string),
      subject: validateSubject(data.get("subject") as string),
      message: validateMessage(data.get("message") as string),
    };

    setTouched({ name: true, email: true, phone: true, subject: true, message: true });
    setErrors(allErrors);

    const hasErrors = Object.values(allErrors).some(Boolean);
    if (hasErrors) {
      if (allErrors.name) document.getElementById("contact-name")?.focus();
      else if (allErrors.email) document.getElementById("contact-email")?.focus();
      else if (allErrors.phone) document.getElementById("contact-phone")?.focus();
      else if (allErrors.subject) document.getElementById("contact-subject")?.focus();
      else if (allErrors.message) document.getElementById("contact-message")?.focus();
      return;
    }

    setStatus("sending");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          phone: data.get("phone"),
          subject: data.get("subject"),
          message: data.get("message"),
          website: data.get("website"),
          formStart: openedAt.current,
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: { message?: string } }
        | null;

      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Something went wrong. Please try again.");
      }
      setStatus("sent");
      form.reset();
      setErrors({});
      setTouched({});
      openedAt.current = Date.now();
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Something went wrong. Please try again."
      );
    }
  }

  if (status === "sent") {
    return (
      <div
        role="status"
        className="rounded-xl border border-border bg-card p-8 text-center shadow-card"
      >
        <p className="heading-display text-2xl">Message received</p>
        <p className="mt-2 text-muted-foreground">
          Thank you for writing to us — we usually reply within a day.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => setStatus("idle")}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact-name">Name</Label>
          <Input
            id="contact-name"
            name="name"
            required
            minLength={2}
            maxLength={120}
            autoComplete="name"
            onBlur={handleBlur}
            onChange={handleChange}
            aria-invalid={touched.name && !!errors.name}
            aria-describedby={errors.name ? "contact-name-error" : undefined}
          />
          {touched.name && errors.name ? (
            <p id="contact-name-error" className="text-xs text-destructive" role="alert">{errors.name}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-email">Email</Label>
          <Input
            id="contact-email"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            onBlur={handleBlur}
            onChange={handleChange}
            aria-invalid={touched.email && !!errors.email}
            aria-describedby={errors.email ? "contact-email-error" : undefined}
          />
          {touched.email && errors.email ? (
            <p id="contact-email-error" className="text-xs text-destructive" role="alert">{errors.email}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact-phone">
            Phone <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="contact-phone"
            name="phone"
            type="tel"
            maxLength={20}
            autoComplete="tel"
            placeholder="+91 98765 43210"
            onBlur={handleBlur}
            onChange={handleChange}
            aria-invalid={touched.phone && !!errors.phone}
            aria-describedby={errors.phone ? "contact-phone-error" : undefined}
          />
          {touched.phone && errors.phone ? (
            <p id="contact-phone-error" className="text-xs text-destructive" role="alert">{errors.phone}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-subject">Subject</Label>
          <Input
            id="contact-subject"
            name="subject"
            required
            minLength={2}
            maxLength={120}
            onBlur={handleBlur}
            onChange={handleChange}
            aria-invalid={touched.subject && !!errors.subject}
            aria-describedby={errors.subject ? "contact-subject-error" : undefined}
          />
          {touched.subject && errors.subject ? (
            <p id="contact-subject-error" className="text-xs text-destructive" role="alert">{errors.subject}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-message">Message</Label>
        <Textarea
          id="contact-message"
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={6}
          className="min-h-[140px]"
          onBlur={handleBlur}
          onChange={handleChange}
          aria-invalid={touched.message && !!errors.message}
          aria-describedby={errors.message ? "contact-message-error" : undefined}
        />
        {touched.message && errors.message ? (
          <p id="contact-message-error" className="text-xs text-destructive" role="alert">{errors.message}</p>
        ) : null}
      </div>

      {/* Honeypot — hidden from real users, catches bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {status === "error" && errorMessage ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Send message"}
        <Send className="h-4 w-4" aria-hidden="true" />
      </Button>
    </form>
  );
}
