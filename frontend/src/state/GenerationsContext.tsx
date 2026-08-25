import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import {
  fetchCredits,
  fetchGeneration,
  fetchGenerations,
  submitGeneration,
  type GenerationDTO,
  type ToolType,
} from "../api/client";
import { getInitData } from "../telegram/webapp";

interface GenerationsContextValue {
  credits: number;
  generations: GenerationDTO[];
  refreshCredits: () => Promise<void>;
  refreshGenerations: () => Promise<void>;
  createGeneration: (file: File, type: ToolType, style?: string) => Promise<GenerationDTO>;
  /** Re-fetches one generation's status and updates the cache. Called by
   * the Result screen while a generation is pending/processing. */
  pollGeneration: (id: string) => Promise<GenerationDTO>;
  getCached: (id: string) => GenerationDTO | undefined;
}

const GenerationsContext = createContext<GenerationsContextValue | null>(null);

export function GenerationsProvider({ children }: { children: ReactNode }) {
  const [credits, setCredits] = useState(0);
  const [generations, setGenerations] = useState<GenerationDTO[]>([]);

  const upsert = useCallback((gen: GenerationDTO) => {
    setGenerations((prev) => {
      const idx = prev.findIndex((g) => g.id === gen.id);
      if (idx === -1) return [gen, ...prev];
      const copy = [...prev];
      copy[idx] = gen;
      return copy;
    });
  }, []);

  const refreshCredits = useCallback(async () => {
    const res = await fetchCredits(getInitData());
    setCredits(res.balance);
  }, []);

  const refreshGenerations = useCallback(async () => {
    const list = await fetchGenerations(getInitData());
    setGenerations(list);
  }, []);

  const createGeneration = useCallback(
    async (file: File, type: ToolType, style?: string) => {
      const gen = await submitGeneration(getInitData(), file, type, style);
      upsert(gen);
      setCredits((c) => Math.max(0, c - gen.credits_spent));
      return gen;
    },
    [upsert],
  );

  const pollGeneration = useCallback(
    async (id: string) => {
      const gen = await fetchGeneration(getInitData(), id);
      upsert(gen);
      if (gen.status === "failed") {
        // The backend refunds the credit on failure - re-sync the balance
        // instead of trying to guess it client-side.
        refreshCredits().catch(() => {});
      }
      return gen;
    },
    [upsert, refreshCredits],
  );

  const getCached = useCallback((id: string) => generations.find((g) => g.id === id), [generations]);

  return (
    <GenerationsContext.Provider
      value={{ credits, generations, refreshCredits, refreshGenerations, createGeneration, pollGeneration, getCached }}
    >
      {children}
    </GenerationsContext.Provider>
  );
}

export function useGenerations(): GenerationsContextValue {
  const ctx = useContext(GenerationsContext);
  if (!ctx) throw new Error("useGenerations must be used within GenerationsProvider");
  return ctx;
}
