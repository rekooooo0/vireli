/**
 * Thin wrapper around the Telegram Mini Apps JS SDK (loaded globally via
 * the <script src="https://telegram.org/js/telegram-web-app.js"> tag in
 * index.html, which exposes window.Telegram.WebApp).
 *
 * We never read/trust telegram user fields from the client for anything
 * that matters (auth). We only use window.Telegram.WebApp.initData — the
 * raw, signed string — and send that whole string to the backend, which
 * verifies the signature (see backend/app/core/security.py). Anything
 * we read here client-side (name, id, etc.) is for *display* only.
 */

interface TelegramWebAppUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: TelegramWebAppUser };
  colorScheme: "light" | "dark";
  ready: () => void;
  expand: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  enableClosingConfirmation?: () => void;
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;

/** True when running inside an actual Telegram client. False in a normal
 * desktop browser tab, where initData will be empty and auth can't work —
 * useful for showing a friendly "open me from Telegram" message instead
 * of a confusing error. */
export const isInsideTelegram = Boolean(tg && tg.initData);

export function initTelegramWebApp(): void {
  if (!tg) return;
  tg.ready();
  tg.expand();
  tg.setBackgroundColor?.("#0b0a12");
  tg.setHeaderColor?.("#0b0a12");
}

export function getInitData(): string {
  return tg?.initData ?? "";
}

export function getDisplayUser(): TelegramWebAppUser | null {
  return tg?.initDataUnsafe?.user ?? null;
}

export function haptic(style: "light" | "medium" | "heavy" = "light"): void {
  tg?.HapticFeedback?.impactOccurred(style);
}

export function hapticNotify(type: "error" | "success" | "warning"): void {
  tg?.HapticFeedback?.notificationOccurred(type);
}

export function setBackButton(onClick: (() => void) | null): void {
  if (!tg) return;
  tg.BackButton.offClick(onClick ?? (() => {}));
  if (onClick) {
    tg.BackButton.show();
    tg.BackButton.onClick(onClick);
  } else {
    tg.BackButton.hide();
  }
}
