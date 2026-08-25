/**
 * Backend API client.
 *
 * Stage 4: all endpoints below are real (see backend/app/api/):
 *   - GET  /api/health
 *   - GET  /api/health/db
 *   - POST /api/auth/telegram      (header: X-Telegram-Init-Data)
 *   - GET  /api/credits            (header: X-Telegram-Init-Data)
 *   - GET  /api/generations        (header: X-Telegram-Init-Data)
 *   - GET  /api/generations/:id    (header: X-Telegram-Init-Data)
 *   - POST /api/generations        (header: X-Telegram-Init-Data, multipart form)
 *
 * There is no more mock data layer - api/mockGenerations.ts has been
 * removed. See src/state/GenerationsContext.tsx for the React-facing
 * wrapper around these calls (caching, polling, credit bookkeeping).
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function authHeaders(initData: string): HeadersInit {
  return { "X-Telegram-Init-Data": initData };
}

async function parseErrorDetail(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.detail ?? res.statusText;
  } catch {
    return res.statusText;
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
    throw new ApiError(res.status, await parseErrorDetail(res));
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
  credits_balance: number;
}

/** Sends the raw, signed Telegram initData string to the backend, which
 * verifies its HMAC signature against the bot token and creates the user
 * on first sight (see backend/app/api/deps.py::get_current_user). */
export function verifyTelegramUser(initData: string) {
  return request<VerifiedTelegramUser>("/api/auth/telegram", {
    method: "POST",
    headers: authHeaders(initData),
  });
}

export interface CreditsResponse {
  balance: number;
}

export function fetchCredits(initData: string) {
  return request<CreditsResponse>("/api/credits", { headers: authHeaders(initData) });
}

export type ToolType = "enhance" | "remove_bg" | "style" | "caption";
export type GenerationStatus = "pending" | "processing" | "completed" | "failed";

export interface GenerationDTO {
  id: string;
  type: ToolType;
  status: GenerationStatus;
  /** Short-lived signed URL for the uploaded input image. */
  input_url: string | null;
  /** Short-lived signed URL for the output image (image tools only). */
  output_url: string | null;
  /** Caption text (caption tool only, once completed). */
  output_text: string | null;
  credits_spent: number;
  error_message: string | null;
  created_at: string;
}

export function fetchGenerations(initData: string) {
  return request<GenerationDTO[]>("/api/generations", { headers: authHeaders(initData) });
}

export function fetchGeneration(initData: string, id: string) {
  return request<GenerationDTO>(`/api/generations/${id}`, { headers: authHeaders(initData) });
}

/** Uploads a photo and kicks off a generation. Returns immediately with
 * status "pending"/"processing" - poll fetchGeneration() for the result. */
export async function submitGeneration(
  initData: string,
  file: File,
  type: ToolType,
  style?: string,
): Promise<GenerationDTO> {
  const form = new FormData();
  form.append("file", file);
  form.append("type", type);
  if (style) form.append("style", style);

  const res = await fetch(`${BASE_URL}/api/generations`, {
    method: "POST",
    // No Content-Type here - the browser sets the multipart boundary itself.
    headers: authHeaders(initData),
    body: form,
  });

  if (!res.ok) {
    throw new ApiError(res.status, await parseErrorDetail(res));
  }

  return res.json();
}
