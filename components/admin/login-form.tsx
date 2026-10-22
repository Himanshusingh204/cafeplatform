"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, StatusMessage, type FieldErrors } from "@/components/admin/form-field";
import { LogoMark, Wordmark } from "@/components/brand/logo";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const data = new FormData(event.currentTarget);
    const errors: FieldErrors = {};
    if (!String(data.get("email") ?? "").trim()) errors.email = "Enter your email address.";
    if (!String(data.get("password") ?? "")) errors.password = "Enter your password.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError("Please fill in both fields.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
      });

      if (!response.ok) {
        setError(response.status === 429 ? "Too many attempts. Please wait a few minutes." : "Invalid email or password.");
        if (response.status !== 429) setFieldErrors({ password: "Check your password and try again." });
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Could not sign in. Please check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-card p-8 shadow-card">
      <div className="flex flex-col items-center gap-2 text-center">
        <LogoMark />
        <Wordmark />
        <p className="mt-1 text-sm text-muted-foreground">Staff sign-in</p>
      </div>

      <Field id="admin-email" label="Email" required error={fieldErrors.email}>
        {(p) => (
          <Input {...p} name="email" type="email" maxLength={254} autoComplete="username" autoFocus className="bg-background" />
        )}
      </Field>

      <Field id="admin-password" label="Password" required error={fieldErrors.password}>
        {(p) => (
          <Input {...p} name="password" type="password" maxLength={128} autoComplete="current-password" className="bg-background" />
        )}
      </Field>

      <StatusMessage error={error} />

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
        <LogIn className="h-4 w-4" aria-hidden="true" />
      </Button>
    </form>
  );
}
