# Vireli — AI Content Studio (Telegram Mini App)

MVP в разработке. Текущий этап: **Stage 1 — backend-скелет**.

## Структура

```
vireli/
├── backend/     # FastAPI backend (Python)
├── frontend/    # React + TS + Vite (появится на Stage 3)
├── .env.example # какие переменные окружения нужны
└── .gitignore
```

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

## Статус этапов

- [x] Stage 1 — backend-скелет + проверка Telegram initData
- [ ] Stage 2 — Supabase (БД + Storage)
- [ ] Stage 3 — frontend-скелет + GitHub Pages
- [ ] Stage 4 — кредиты + auth-флоу целиком
- [ ] Stage 5 — AI-адаптер + первая интеграция
- [ ] Stage 6 — остальные AI-инструменты
- [ ] Stage 7 — "My Creations" + polling
- [ ] Stage 8 — обработка ошибок, лимиты, логирование
