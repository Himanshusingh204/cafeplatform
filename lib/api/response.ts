import { NextResponse } from "next/server";

export function ok<T>(data: T) {
  return NextResponse.json({ success: true, data });
}

export function fail(code: string, message: string, status: number) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status }
  );
}

export function validationError() {
  return fail("VALIDATION_ERROR", "Please check the submitted fields.", 422);
}

export function unauthorized() {
  return fail("UNAUTHORIZED", "Please sign in to continue.", 401);
}

export function forbidden() {
  return fail("FORBIDDEN", "You do not have permission for this action.", 403);
}

export function notFound() {
  return fail("NOT_FOUND", "The requested resource was not found.", 404);
}

export function rateLimited(retryAfterMs = 0) {
  return NextResponse.json(
    { success: false, error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." } },
    { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
  );
}

export function serverError() {
  return fail("SERVER_ERROR", "Something went wrong. Please try again.", 500);
}

export function conflict(message = "This record already exists.") {
  return fail("CONFLICT", message, 409);
}