/**
 * Backend API client.
 *
 * IMPORTANT: only endpoints that actually exist on the backend today are
 * called for real (see backend/app/api/health.py):
 *   - GET  /api/health
 *   - GET  /api/health/db
 *   - GET  /api/auth/telegram/verify-test  (header: X-Telegram-Init-Data)
 *
 * /api/me, /api/credits, /api/generations do not exist on the backend
 * yet. Calling code for those lives in api/mockGenerations.ts and is
 * clearly labelled as a stand-in so it's a one-line swap once the real
 * endpoints ship.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* response wasn't JSON, keep statusText */
    }
    throw new ApiError(res.status, detail);
  }

  return res.json() as Promise<T>;
}

export function checkHealth() {
  return request<{ status: string }>("/api/health");
}

export interface VerifiedTelegramUser {
  verified: true;
  telegram_id: number;
  username: string | null;
}

/** Sends the raw, signed Telegram initData string to the backend, which
 * verifies its HMAC signature against the bot token before trusting it. */
export function verifyTelegramUser(initData: string) {
  return request<VerifiedTelegramUser>("/api/auth/telegram/verify-test", {
    headers: { "X-Telegram-Init-Data": initData },
  });
}
