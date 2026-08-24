import { useEffect, useState } from "react";
import styles from "./Lists.module.css";
import type { Screen } from "../types/nav";
import { getCreditsBalance, subscribe } from "../api/mockGenerations";

interface Props {
  navigate: (s: Screen) => void;
}

const PLANS = [
  { id: "free", name: "Free", credits: "5 кредитов", badge: "Текущий", highlight: false },
  { id: "start", name: "Start", credits: "30 кредитов", badge: "Скоро", highlight: false },
  { id: "pro", name: "Pro", credits: "100 кредитов", badge: "Скоро", highlight: true },
  { id: "max", name: "Max", credits: "300 кредитов", badge: "Скоро", highlight: false },
];

export function Credits({ navigate }: Props) {
  const [balance, setBalance] = useState(getCreditsBalance());

  useEffect(() => subscribe(() => setBalance(getCreditsBalance())), []);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate({ name: "home" })} aria-label="Назад">
          ←
        </button>
        <h1 className={styles.title}>Credits</h1>
      </div>

      <div className={styles.balanceCard}>
        <div className={styles.balanceLabel}>Баланс</div>
        <div className={styles.balanceValue}>{balance}</div>
      </div>

      <div className={styles.planList}>
        {PLANS.map((plan) => (
          <div key={plan.id} className={`${styles.planCard} ${plan.highlight ? styles.planCardHighlight : ""}`}>
            <div>
              <div className={styles.planName}>{plan.name}</div>
              <div className={styles.planCredits}>{plan.credits}</div>
            </div>
            <div className={`${styles.planBadge} ${plan.badge === "Скоро" ? styles.planBadgeSoon : ""}`}>
              {plan.badge}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
