import { useEffect, useState } from "react";
import { Home } from "./screens/Home";
import { Create } from "./screens/Create";
import { Result } from "./screens/Result";
import { MyCreations } from "./screens/MyCreations";
import { Credits } from "./screens/Credits";
import { TopBar } from "./components/TopBar";
import type { Screen } from "./types/nav";
import { getCreditsBalance, subscribe } from "./api/mockGenerations";
import { getInitData, initTelegramWebApp, isInsideTelegram, setBackButton } from "./telegram/webapp";
import { verifyTelegramUser } from "./api/client";

type AuthState =
  | { status: "checking" }
  | { status: "verified"; telegramId: number }
  | { status: "skipped" } // not inside Telegram (e.g. dev browser preview)
  | { status: "failed"; message: string };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [credits, setCredits] = useState(getCreditsBalance());
  const [auth, setAuth] = useState<AuthState>({ status: "checking" });

  useEffect(() => {
    initTelegramWebApp();
    return subscribe(() => setCredits(getCreditsBalance()));
  }, []);

  useEffect(() => {
    if (!isInsideTelegram) {
      setAuth({ status: "skipped" });
      return;
    }
    verifyTelegramUser(getInitData())
      .then((res) => setAuth({ status: "verified", telegramId: res.telegram_id }))
      .catch((err) => setAuth({ status: "failed", message: err.message ?? "Не удалось проверить пользователя" }));
  }, []);

  useEffect(() => {
    if (screen.name === "home") {
      setBackButton(null);
    } else {
      setBackButton(() => setScreen({ name: "home" }));
    }
  }, [screen]);

  return (
    <>
      <TopBar credits={credits} onCreditsClick={() => setScreen({ name: "credits" })} />

      {auth.status === "failed" && (
        <div
          role="alert"
          style={{
            margin: "0 24px 8px",
            padding: "10px 14px",
            borderRadius: 12,
            background: "rgba(255,84,112,0.1)",
            border: "1px solid rgba(255,84,112,0.25)",
            color: "#ffb3c0",
            fontSize: 12,
          }}
        >
          Не удалось подтвердить Telegram-пользователя: {auth.message}
        </div>
      )}

      {screen.name === "home" && <Home navigate={setScreen} isInsideTelegram={isInsideTelegram} />}
      {screen.name === "create" && <Create navigate={setScreen} />}
      {screen.name === "result" && <Result generationId={screen.generationId} navigate={setScreen} />}
      {screen.name === "my-creations" && <MyCreations navigate={setScreen} />}
      {screen.name === "credits" && <Credits navigate={setScreen} />}
    </>
  );
}
