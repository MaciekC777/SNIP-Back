# LastBid — Allegro Auction Sniper

Monorepo dla serwisu LastBid. Automatycznie składa oferty w ostatnich milisekundach aukcji Allegro.

```
lastbid/
├── backend/     # FastAPI + APScheduler — Railway (Docker)
└── frontend/    # Next.js 14 — Vercel
```

---

## Backend (`backend/`)

**Stack:** Python 3.12, FastAPI, APScheduler, Supabase, aiohttp

### Lokalne uruchomienie

```bash
cd backend
cp .env.example .env   # uzupełnij wartości
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs (tylko `ENVIRONMENT=development`)

### Deploy — Railway

```bash
railway login && railway init && railway up
```

Zmienne środowiskowe do ustawienia w Railway:

| Zmienna | Opis |
|---|---|
| `ALLEGRO_CLIENT_ID` | Allegro app client ID |
| `ALLEGRO_CLIENT_SECRET` | Allegro app client secret |
| `ALLEGRO_REDIRECT_URI` | `https://twój-backend.railway.app/auth/callback` |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `ENCRYPTION_KEY` | Fernet key (wygeneruj: patrz niżej) |
| `FRONTEND_URL` | URL frontendu na Vercel (CORS) |
| `ENVIRONMENT` | `production` |
| `SNIPE_OFFSET_MS` | ms przed końcem aukcji (domyślnie: 100) |

Generowanie klucza szyfrowania:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

---

## Frontend (`frontend/`)

**Stack:** Next.js 14, TypeScript, Tailwind CSS, App Router

### Lokalne uruchomienie

```bash
cd frontend
cp .env.local.example .env.local   # ustaw NEXT_PUBLIC_API_URL
npm install
npm run dev
```

Otwórz: http://localhost:3000

### Deploy — Vercel

1. Połącz repo z Vercel, ustaw **Root Directory** na `frontend`
2. Dodaj zmienną środowiskową:
   - `NEXT_PUBLIC_API_URL` = `https://twój-backend.railway.app`
3. Deploy

---

## Architektura

```
Przeglądarka → Frontend (Vercel)
                    ↓ REST API (NEXT_PUBLIC_API_URL)
             Backend (Railway)
                    ↓
              Supabase (PostgreSQL)
                    ↓ (scheduler)
              Allegro API (bidy)
```

### Sniper flow

1. Użytkownik loguje się przez `GET /auth/login` → Allegro OAuth2
2. Dodaje snipe przez `POST /snipes` (URL aukcji + maks. kwota)
3. Scheduler skanuje co minutę aktywne snipe'y
4. Snipe'y kończące się w ciągu 10 minut trafiają do kolejki
5. `SniperEngine` wysyła 3 bidy: 300ms, 200ms i `SNIPE_OFFSET_MS` ms przed końcem
6. Wynik (`won`/`lost`/`error`) zapisywany w Supabase z pełnymi logami

### Status flow

```
waiting → active → executing → won / lost / error / cancelled
```
