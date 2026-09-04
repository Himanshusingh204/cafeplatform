/**
 * Spice & Saffron Unified API Client
 * Connects frontend (Port 3000) to the backend API service (Port 4000).
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface ApiFetchOptions extends RequestInit {
  token?: string;
}

export async function apiClient<T = unknown>(
  endpoint: string,
  options: ApiFetchOptions = {}
): Promise<{ ok: boolean; data?: T; error?: string; status: number }> {
  const { token, headers: customHeaders, ...rest } = options;

  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const headers = new Headers(customHeaders);
  if (!headers.has("Content-Type") && !(rest.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    const response = await fetch(url, {
      ...rest,
      headers,
      credentials: rest.credentials ?? "include",
    });

    let data: unknown = null;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errObj = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
      const errorMsg =
        typeof errObj?.error === "string"
          ? errObj.error
          : typeof errObj?.message === "string"
            ? errObj.message
            : typeof data === "string"
              ? data
              : `HTTP ${response.status}`;

      return {
        ok: false,
        error: errorMsg,
        status: response.status,
      };
    }

    return {
      ok: true,
      data: data as T,
      status: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network error",
      status: 0,
    };
  }
}

/**
 * Validates a promo coupon via the Port 4000 Backend API
 */
export async function checkCouponApi(code: string, subtotal: number) {
  return apiClient<{ valid: boolean; discountAmount?: number; discountPercent?: number; message?: string }>(
    "/api/v1/coupons/validate",
    {
      method: "POST",
      body: JSON.stringify({ code, subtotal }),
    }
  );
}

/**
 * Checks Backend Service Health
 */
export async function getBackendHealth() {
  return apiClient<{ status: string; service: string; port: number }>("/api/health");
}
