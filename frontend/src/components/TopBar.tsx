import styles from "./TopBar.module.css";

interface Props {
  credits: number;
  onCreditsClick: () => void;
}

export function TopBar({ credits, onCreditsClick }: Props) {
  return (
    <div className={styles.bar}>
      <span className={styles.wordmark}>Vireli</span>
      <button className={styles.credits} onClick={onCreditsClick} aria-label="Открыть баланс кредитов">
        <span className={styles.creditsDot} />
        {credits}
      </button>
    </div>
  );
}
