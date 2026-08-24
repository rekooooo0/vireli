import styles from "./Home.module.css";
import type { Screen } from "../types/nav";

interface Props {
  navigate: (s: Screen) => void;
  isInsideTelegram: boolean;
}

export function Home({ navigate, isInsideTelegram }: Props) {
  return (
    <div className={styles.wrap}>
      <div className={styles.hero}>
        <div className={styles.eyebrow}>AI Content Studio</div>
        <h1 className={styles.title}>
          Фото — в <span className={styles.titleGradient}>контент</span>, за секунды
        </h1>
        <p className={styles.subtitle}>
          Загрузи фотографию — Vireli улучшит, обработает и оформит её для соцсетей и бренда.
        </p>
      </div>

      <div className={styles.signature} aria-hidden="true">
        <div className={`${styles.signatureHalf} ${styles.signatureBefore}`} />
        <div className={`${styles.signatureHalf} ${styles.signatureAfter}`} />
        <span className={`${styles.signatureLabel} ${styles.labelBefore}`}>исходник</span>
        <span className={`${styles.signatureLabel} ${styles.labelAfter}`}>vireli</span>
      </div>

      <div className={styles.actions}>
        <button className={styles.primaryAction} onClick={() => navigate({ name: "create" })}>
          Create
        </button>
        <div className={styles.secondaryRow}>
          <button className={styles.secondaryAction} onClick={() => navigate({ name: "my-creations" })}>
            <span className={styles.secondaryLabel}>My Creations</span>
            <span className={styles.secondaryHint}>История генераций</span>
          </button>
          <button className={styles.secondaryAction} onClick={() => navigate({ name: "credits" })}>
            <span className={styles.secondaryLabel}>Credits</span>
            <span className={styles.secondaryHint}>Баланс и тарифы</span>
          </button>
        </div>
      </div>

      {!isInsideTelegram && (
        <div className={styles.offlineNotice}>
          Открыто вне Telegram — часть функций (проверка пользователя) недоступна. Открой Vireli через кнопку в
          @vireli_bot.
        </div>
      )}
    </div>
  );
}
