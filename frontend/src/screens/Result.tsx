import { useEffect, useRef } from "react";
import styles from "./Result.module.css";
import type { Screen } from "../types/nav";
import { TOOL_LABELS } from "../types/nav";
import { useGenerations } from "../state/GenerationsContext";
import { haptic, hapticNotify } from "../telegram/webapp";

interface Props {
  generationId: string;
  navigate: (s: Screen) => void;
}

const POLL_INTERVAL_MS = 1500;

export function Result({ generationId, navigate }: Props) {
  const { getCached, pollGeneration } = useGenerations();
  const gen = getCached(generationId);
  const notifiedRef = useRef(false);

  useEffect(() => {
    notifiedRef.current = false;
  }, [generationId]);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const updated = await pollGeneration(generationId);
        if (cancelled) return;

        if (!notifiedRef.current && (updated.status === "completed" || updated.status === "failed")) {
          notifiedRef.current = true;
          hapticNotify(updated.status === "completed" ? "success" : "error");
        }
        if (updated.status === "pending" || updated.status === "processing") {
          setTimeout(tick, POLL_INTERVAL_MS);
        }
      } catch {
        // Transient network hiccup - try again on the next tick instead
        // of leaving the screen stuck.
        if (!cancelled) setTimeout(tick, POLL_INTERVAL_MS);
      }
    }

    tick();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generationId]);

  if (!gen) {
    return (
      <div className={styles.wrap}>
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={() => navigate({ name: "home" })}>
            ←
          </button>
          <h1 className={styles.title}>Result</h1>
        </div>
        <p>Загружаем…</p>
      </div>
    );
  }

  const isCaption = gen.type === "caption";

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate({ name: "home" })} aria-label="На главную">
          ←
        </button>
        <h1 className={styles.title}>{TOOL_LABELS[gen.type]}</h1>
      </div>

      <div
        className={`${styles.statusPill} ${
          gen.status === "completed"
            ? styles.statusCompleted
            : gen.status === "failed"
              ? styles.statusFailed
              : styles.statusProcessing
        }`}
      >
        {gen.status === "processing" && "Обрабатывается"}
        {gen.status === "completed" && "Готово"}
        {gen.status === "failed" && "Ошибка"}
        {gen.status === "pending" && "В очереди"}
      </div>

      {gen.status === "failed" && gen.error_message && (
        <div className={styles.errorText}>{gen.error_message}</div>
      )}

      <div className={styles.imageFrame}>
        {gen.status === "processing" || gen.status === "pending" ? (
          <div className={styles.processingOverlay}>
            <div className={styles.spinner} />
            <span className={styles.processingLabel}>Vireli обрабатывает фото…</span>
          </div>
        ) : isCaption ? (
          gen.status === "completed" ? (
            <p className={styles.captionCard}>{gen.output_text}</p>
          ) : (
            <img src={gen.input_url ?? undefined} alt="Исходное фото" className={styles.image} />
          )
        ) : (
          <img src={gen.output_url ?? gen.input_url ?? undefined} alt="Результат обработки" className={styles.image} />
        )}
      </div>

      <div className={styles.spacer} />

      <div className={styles.actionRow}>
        {gen.status === "completed" && (
          <>
            <button
              className={styles.primaryBtn}
              onClick={() => {
                haptic("light");
                navigate({ name: "create" });
              }}
            >
              Create another
            </button>
            <div className={styles.secondaryRow}>
              <button className={styles.secondaryBtn} onClick={() => navigate({ name: "my-creations" })}>
                Save
              </button>
              {!isCaption && (
                <a
                  className={styles.secondaryBtn}
                  href={gen.output_url ?? gen.input_url ?? undefined}
                  download={`vireli-${gen.id}.png`}
                >
                  Download
                </a>
              )}
            </div>
          </>
        )}

        {gen.status === "failed" && (
          <button className={styles.primaryBtn} onClick={() => navigate({ name: "create" })}>
            Попробовать снова
          </button>
        )}
      </div>
    </div>
  );
}
