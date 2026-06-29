# Baza de date partajată pentru dev (fără Docker)

**Local (`localhost:3001`) și Vercel (`phish-guard-rho.vercel.app`) pot folosi aceeași bază Neon.**

| | Local dev | Vercel |
|---|-----------|--------|
| **App URL** | `http://localhost:3001` | `https://phish-guard-rho.vercel.app` |
| **DATABASE_URL** | Neon (în `apps/web/.env`) | Neon (Environment Variables) |
| **Docker** | Nu e necesar | Nu există |

`BETTER_AUTH_URL` rămâne `localhost` local — asta e doar adresa aplicației, nu a bazei de date.

## Setup (o singură bază Neon pentru tot)

1. Neon + Vercel: `DATABASE_URL` deja în Vercel Environment Variables.
2. **Copiază același string** în `apps/web/.env` (sau rulează scriptul de sync):

```powershell
.\scripts\sync-vercel-database.ps1
```

3. Prima dată sau DB goală:

```bash
bun run db:bootstrap
```

4. Local:

```bash
bun run dev:web
```

Acum `localhost:3001` și site-ul Vercel văd **aceleași date** (useri, scanări, org-uri).

## Device nou

```bash
git pull
bun install
# același apps/web/.env (DATABASE_URL Neon)
bun run dev:web
```

Fără Docker. Fără seed (dacă baza are deja date).

---

## Alternative

| Serviciu | Notă |
|----------|------|
| [Supabase](https://supabase.com) | Postgres + dashboard; connection string din Project Settings → Database |
| PostgreSQL local | Doar pe un singur PC; nu se potrivește pentru mai multe device-uri |

---

## Comenzi utile

| Comandă | Când |
|---------|------|
| `bun run db:bootstrap` | Prima configurare sau DB goală — push schema + seed doar dacă nu există useri |
| `bun run db:push` | După pull cu schimbări Prisma |
| `bun run db:seed` | Opțional — re-creează demo; admin rămâne; demo se sare dacă org există |
| `bun run db:studio` | UI pentru date |

### Variabile seed (opționale)

```env
SEED_DEMO=false          # fără date demo
DEMO_RESET=true          # șterge și recreează org demo
ADMIN_EMAIL=admin@...
ADMIN_PASSWORD=...
```

---

## Docker (opțional, legacy)

`docker-compose.yml` rămâne doar dacă vrei Postgres **local offline**. Pentru mai multe device-uri, folosește Neon.

```bash
# doar dacă insiști pe local:
docker compose up -d
# DATABASE_URL=postgresql://phishguard:phishguard_dev_password@localhost:5432/phishguard
```

---

## Ce pui în `.env` pe toate device-urile

Minim partajat (aceleași valori):

- `DATABASE_URL` — Neon connection string
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL` / `CORS_ORIGIN` (localhost pe fiecare mașină)

Poți folosi un manager de parole (1Password, Bitwarden) pentru același fișier `.env` dev.
