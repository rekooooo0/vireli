import { useEffect, useState } from "react";
import styles from "./Lists.module.css";
import type { Screen } from "../types/nav";
import { TOOL_LABELS } from "../types/nav";
import { getGenerations, subscribe, type Generation } from "../api/mockGenerations";

interface Props {
  navigate: (s: Screen) => void;
}

const STATUS_LABELS: Record<Generation["status"], string> = {
  pending: "В очереди",
  processing: "Обрабатывается",
  completed: "Готово",
  failed: "Ошибка",
};

export function MyCreations({ navigate }: Props) {
  const [items, setItems] = useState<Generation[]>(() => getGenerations());

  useEffect(() => subscribe(() => setItems(getGenerations())), []);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate({ name: "home" })} aria-label="Назад">
          ←
        </button>
        <h1 className={styles.title}>My Creations</h1>
      </div>

      {items.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>✧</div>
          <div className={styles.emptyTitle}>Пока пусто</div>
          <p className={styles.emptyHint}>Здесь появятся все твои обработанные фотографии и подписи.</p>
          <button className={styles.emptyCta} onClick={() => navigate({ name: "create" })}>
            Создать первую генерацию
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {items.map((gen) => (
            <button key={gen.id} className={styles.card} onClick={() => navigate({ name: "result", generationId: gen.id })}>
              <img src={gen.outputPreviewUrl ?? gen.inputPreviewUrl} alt="" className={styles.cardImage} />
              <div className={styles.cardBody}>
                <div className={styles.cardType}>{TOOL_LABELS[gen.type]}</div>
                <div className={styles.cardStatus}>{STATUS_LABELS[gen.status]}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
