/**
 * STAND-IN DATA LAYER — NOT REAL BACKEND CALLS.
 *
 * The backend does not yet implement /api/generations, /api/credits or
 * /api/me (see backend/app/api/ — only health + verify-test exist right
 * now). Everything in this file lives in memory on the device only:
 * nothing here is persisted, uploaded, or seen by an AI provider.
 *
 * This exists purely so the UI/UX for Create -> Upload -> Result ->
 * My Creations -> Credits can be built, reviewed and clicked through
 * end to end today. Once the real endpoints exist (POST /api/generations,
 * GET /api/generations, GET /api/credits), swap the calls in the screens
 * that import this file for real ones from api/client.ts — the shapes
 * below (Generation, ToolType) are already modelled on backend/sql/schema.sql
 * so that swap should be close to a no-op.
 */

export type ToolType = "enhance" | "remove_bg" | "style" | "caption";

export type GenerationStatus = "pending" | "processing" | "completed" | "failed";

export interface Generation {
  id: string;
  type: ToolType;
  status: GenerationStatus;
  inputPreviewUrl: string;
  outputPreviewUrl: string | null;
  createdAt: string;
  creditsSpent: number;
}

const STARTING_CREDITS = 5;
const COST_PER_GENERATION = 1;

let creditsBalance = STARTING_CREDITS;
const generations: Generation[] = [];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((cb) => cb());
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getCreditsBalance(): number {
  return creditsBalance;
}

export function getGenerations(): Generation[] {
  return [...generations].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function hasEnoughCredits(): boolean {
  return creditsBalance >= COST_PER_GENERATION;
}

/** Simulates submitting a generation and, after a short delay, "completing"
 * it by reusing the input image as the output (since there's no real AI
 * call wired up yet). Returns the generation id immediately, matching the
 * shape POST /api/generations will eventually return. */
export function createMockGeneration(type: ToolType, inputPreviewUrl: string): string {
  if (!hasEnoughCredits()) {
    throw new Error("Недостаточно кредитов");
  }

  const id = crypto.randomUUID();
  creditsBalance -= COST_PER_GENERATION;

  generations.push({
    id,
    type,
    status: "processing",
    inputPreviewUrl,
    outputPreviewUrl: null,
    createdAt: new Date().toISOString(),
    creditsSpent: COST_PER_GENERATION,
  });
  notify();

  window.setTimeout(() => {
    const gen = generations.find((g) => g.id === id);
    if (gen) {
      gen.status = "completed";
      gen.outputPreviewUrl = inputPreviewUrl;
      notify();
    }
  }, 1800);

  return id;
}

export function getGeneration(id: string): Generation | undefined {
  return generations.find((g) => g.id === id);
}
