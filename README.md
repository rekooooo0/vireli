# Vireli — AI Content Studio (Telegram Mini App)

MVP в разработке. Текущий этап: **Stage 4 — реальные генерации** (backend теперь
принимает фото, списывает кредиты и обрабатывает их через AI-провайдера;
заглушка `mockGenerations.ts` удалена).

## Структура

```
vireli/
├── backend/     # FastAPI backend (Python)
├── frontend/    # React + TS + Vite
├── .github/workflows/deploy-frontend.yml  # автодеплой frontend на GitHub Pages
├── .env.example # какие переменные окружения нужны backend'у
└── .gitignore
```

## Что реально работает (Stage 4)

Backend реализует полный цикл:

- `POST /api/auth/telegram` — проверяет подписанный `initData`, создаёт
  пользователя в Supabase при первом визите и выдаёт стартовые 5 кредитов.
- `GET /api/credits` — текущий баланс.
- `POST /api/generations` — принимает фото (multipart), проверяет баланс,
  загружает фото в приватный Supabase Storage bucket `generations`,
  списывает 1 кредит и **в фоне** отправляет изображение AI-провайдеру
  (см. `backend/app/services/ai.py`):
  - `enhance`, `remove_bg`, `style` — Hugging Face Inference API
    (`HUGGINGFACE_API_TOKEN`);
  - `caption` — OpenRouter, vision-модель (`OPENROUTER_API_KEY`).
  Если провайдер не настроен или упал с ошибкой — генерация помечается
  `failed`, кредит **автоматически возвращается** пользователю.
- `GET /api/generations` / `GET /api/generations/{id}` — список и статус
  (frontend поллит `{id}` каждые 1.5с, пока статус не станет `completed`
  или `failed`).

Frontend (`frontend/src/state/GenerationsContext.tsx`) полностью перешёл
на эти реальные вызовы — заглушка `mockGenerations.ts` удалена.

### Известные ограничения / что доделать дальше

- Модели в `HF_MODELS` (`backend/app/services/ai.py`) выбраны как рабочая
  отправная точка — стоит проверить качество результата под реальные
  кейсы и, если нужно, заменить на другие модели/провайдера (в т.ч.
  Sber Kandinsky/GigaChat — `SBER_AUTH_KEY` пока зарезервирован, но не
  подключен).
  Убедитесь, что в вашем HF-аккаунте включён доступ к Inference API для
  выбранных моделей, а провайдер OpenRouter имеет баланс для запросов к
  выбранной vision-модели.
- В Supabase нужно один раз создать приватный bucket `generations`
  (Storage → New bucket → имя `generations`, Public: **off**).
- Обработка идёт в background task в рамках того же процесса — если
  Render перезапустит инстанс backend прямо во время генерации, она
  зависнет в статусе `processing`. Для продакшена стоит вынести это в
  отдельную очередь (например, Celery/RQ + Redis), но для MVP это
  избыточно.

## Быстрый старт (backend)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example ../.env
# впиши в .env свой TELEGRAM_BOT_TOKEN
uvicorn app.main:app --reload
```

Проверка: открой http://localhost:8000/api/health — должен вернуть `{"status":"ok"}`.

## Деплой backend на Render

1. Запушь репозиторий на GitHub.
2. Render → New → Web Service → выбери репозиторий, root directory `backend`.
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Environment → добавь переменные из `.env.example` с реальными значениями.

## Frontend: локальный запуск

```bash
cd frontend
npm install
cp .env.example .env
# впиши VITE_API_BASE_URL = адрес твоего backend на Render
npm run dev
```

Открой http://localhost:5173 — интерфейс откроется, но проверка
Telegram-пользователя не сработает вне Telegram (в браузере `initData`
пустой) — это ожидаемо, внизу экрана появится уведомление об этом.

## Деплой frontend на GitHub Pages (автоматический)

Уже настроен workflow `.github/workflows/deploy-frontend.yml`: при каждом
push в `main` с изменениями в `frontend/` он сам собирает и публикует
сайт на GitHub Pages.

Разово нужно:

1. Запушить репозиторий на GitHub.
2. Repo → **Settings → Pages** → Source: **GitHub Actions**.
3. Repo → **Settings → Secrets and variables → Actions → Variables** →
   **New repository variable**:
   - Name: `VITE_API_BASE_URL`
   - Value: адрес backend на Render, например `https://vireli-backend.onrender.com`
4. Сделай любой push в `frontend/` (или запусти workflow вручную во
   вкладке **Actions**) — через 1–2 минуты сайт будет доступен по адресу
   `https://<твой-логин>.github.io/<имя-репозитория>/`.
5. Этот URL пропиши в backend на Render в переменной `FRONTEND_ORIGIN`
   (нужно для CORS) — и в @BotFather как URL Mini App кнопки.

## Бот: регистрация webhook (обязательно один раз после деплоя)

Backend теперь умеет отвечать на `/start` кнопкой "Открыть Vireli", но
Telegram должен знать, куда слать сообщения — для этого нужно один раз
зарегистрировать webhook.

1. На Render → Environment → добавь переменные:
   - `TELEGRAM_WEBAPP_URL` = URL фронтенда, например `https://твой-логин.github.io/vireli/`
   - `TELEGRAM_WEBHOOK_SECRET` = любая длинная случайная строка (например,
     сгенерируй так: `openssl rand -hex 32` в терминале, или просто
     придумай случайный набор из 40+ символов)
2. Дождись передеплоя backend на Render.
3. Выполни один раз в терминале (замени `<BOT_TOKEN>`, `<BACKEND_URL>` и
   `<WEBHOOK_SECRET>` на свои значения — `<WEBHOOK_SECRET>` должен
   **точно совпадать** с тем, что ты вписала в Render):

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "<BACKEND_URL>/api/telegram/webhook",
    "secret_token": "<WEBHOOK_SECRET>",
    "allowed_updates": ["message"]
  }'
```

  Например:
  ```bash
  curl -X POST "https://api.telegram.org/bot123456:AAExample/setWebhook" \
    -H "Content-Type: application/json" \
    -d '{
      "url": "https://vireli-backend.onrender.com/api/telegram/webhook",
      "secret_token": "мой-случайный-секрет-abc123",
      "allowed_updates": ["message"]
    }'
  ```

4. Успешный ответ выглядит так: `{"ok":true,"result":true,"description":"Webhook was set"}`
5. Проверь, что всё зарегистрировалось:
   ```bash
   curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
   ```
   В ответе `url` должен быть твой backend, а `last_error_message` — пустым.
6. Открой бота в Telegram и напиши `/start` — должно прийти сообщение с
   кнопкой "Открыть Vireli".

### Если после этого /start всё ещё не отвечает

- Проверь `last_error_message` из `getWebhookInfo` выше — Telegram сам
  скажет, что пошло не так (чаще всего: неверный `secret_token`, backend
  не отвечает 200, или `TELEGRAM_WEBAPP_URL` не указан).
- Проверь логи backend на Render (вкладка **Logs**) в момент отправки `/start`.

## Статус этапов

- [x] Stage 1 — backend-скелет + проверка Telegram initData
- [x] Stage 2 — Supabase (БД + Storage)
- [x] Stage 3 — frontend-скелет + GitHub Pages (auth реальный, генерации — заглушка)
- [x] Stage 3.5 — Telegram webhook + ответ на /start кнопкой Mini App
- [ ] Stage 4 — кредиты + auth-флоу целиком (реальные backend-эндпоинты)
- [ ] Stage 5 — AI-адаптер + первая интеграция
- [ ] Stage 6 — остальные AI-инструменты
- [ ] Stage 7 — "My Creations" + polling
- [ ] Stage 8 — обработка ошибок, лимиты, логирование
