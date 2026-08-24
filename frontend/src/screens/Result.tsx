import { useEffect, useState } from "react";
import styles from "./Result.module.css";
import type { Screen } from "../types/nav";
import { TOOL_LABELS } from "../types/nav";
import { getGeneration, subscribe, type Generation } from "../api/mockGenerations";
import { haptic, hapticNotify } from "../telegram/webapp";

interface Props {
  generationId: string;
  navigate: (s: Screen) => void;
}

export function Result({ generationId, navigate }: Props) {
  const [gen, setGen] = useState<Generation | undefined>(() => getGeneration(generationId));

  useEffect(() => {
    const unsub = subscribe(() => {
      const updated = getGeneration(generationId);
      setGen(updated);
      if (updated?.status === "completed") hapticNotify("success");
      if (updated?.status === "failed") hapticNotify("error");
    });
    return unsub;
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
        <p>Генерация не найдена.</p>
      </div>
    );
  }

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

      <div className={styles.imageFrame}>
        {gen.status === "processing" || gen.status === "pending" ? (
          <div className={styles.processingOverlay}>
            <div className={styles.spinner} />
            <span className={styles.processingLabel}>Vireli обрабатывает фото…</span>
          </div>
        ) : (
          <img src={gen.outputPreviewUrl ?? gen.inputPreviewUrl} alt="Результат обработки" className={styles.image} />
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
              <a
                className={styles.secondaryBtn}
                href={gen.outputPreviewUrl ?? gen.inputPreviewUrl ?? undefined}
                download={`vireli-${gen.id}.png`}
              >
                Download
              </a>
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
