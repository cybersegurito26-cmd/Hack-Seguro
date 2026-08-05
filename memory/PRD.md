# Hack-Seguro - PRD

## Overview
Hack-Seguro is a mobile-first Expo app (works in Expo Go and via web preview) with a real FastAPI + MongoDB backend. It teaches cybersecurity and cybercrime prevention to Mexican children, teens, parents and older adults through a Duolingo-style progression, four mini-games and a Claude-powered CiberBot. Users compete in weekly leagues by school code, and completed modules produce shareable PDF certificates.

## Phase status
- **Phase 1 (frontend UI + mock)**: DONE
- **Phase 2 (real backend + IA + leagues + certs + Google Auth + local persistence)**: DONE

## Architecture
- **Backend**: FastAPI + Motor (MongoDB) at 0.0.0.0:8001, all routes prefixed with `/api`.
- **Auth**: Emergent-managed Google OAuth (`https://auth.emergentagent.com`). Session tokens (7-day) stored in Expo `SecureStore` on mobile / `localStorage` on web.
- **AI**: Claude Sonnet 4.6 via `emergentintegrations.llm.chat.LlmChat` (multi-turn). Emergent Universal LLM Key in `/app/backend/.env`.
- **PDF Certificates**: server-side with ReportLab (`reportlab==5.0.0`), served inline as `application/pdf`.
- **Persistence**: MongoDB collections `users`, `user_sessions`, `schools`, `weekly_scores`, `lesson_events`, `game_events`, `chat_messages`, `certificates`. Token in `secureGet/secureSet` under key `hackseguro.session_token`.

## Backend endpoints (all under `/api`)
- Auth: `POST /auth/session` (Emergent session_id → session_token), `GET /auth/me`, `POST /auth/logout`.
- Schools: `GET /schools/mine`, `GET /schools/{code}`, `POST /schools/join`.
- Progress: `GET /progress`, `POST /lessons/complete`, `POST /games/complete`, `POST /daily/claim`.
- Leaderboards: `GET /leaderboards/weekly?scope=school|global` (rank starts at 1, Monday-anchored `week_start`, `me` object).
- Certificates: `GET /certificates/{module_id}` (bearer via header or `?t=token` for browser links).
- Chatbot: `POST /chatbot` (Claude Sonnet 4.6, multi-turn), `GET /chatbot/history`.
- Teacher panel: `GET /teacher/roster` (grouped by grade+group; students only see 403).

## Frontend map
- `/app/frontend/src/api.ts` — API client (Bearer, base URL).
- `/app/frontend/src/auth.tsx` — AuthContext (Google login + web/mobile deep link parsing + refresh + logout).
- `/app/frontend/src/store.tsx` — Thin action wrapper (calls backend, updates user from returned payload).
- `/app/frontend/app/index.tsx` — Welcome with "Entrar con Google".
- `/app/frontend/app/join-school.tsx` — School code + role + grade + group selection.
- `/app/frontend/app/(tabs)/{index,learn,games,league,chatbot,profile,teacher}.tsx` — Tabs. `teacher` shows only for role teacher/parent.
- `/app/frontend/app/lesson/[id].tsx` — Interactive lesson; posts `/lessons/complete`.
- `/app/frontend/app/game/{fraude-real,memorama,password,escape}.tsx` — 4 games; post `/games/complete`.

## Weekly League (by school)
- School code identifies each community (e.g. `DEMO-001`, `COL-LEON-001`, `SEC-CDMX-042`).
- Users join via `/schools/join`, providing role (student/teacher/parent) + optional grade + group.
- Weekly XP is aggregated on every lesson/game/daily-claim (`_apply_xp_coins`) into the `weekly_scores` collection keyed by `(user_id, week_start=Monday UTC)`.
- `GET /leaderboards/weekly?scope=school` returns Top 10 sorted by XP with automatic gold/silver/bronze medals in the UI. Also returns a `me` block with my rank & XP for the current week.
- Architecture is ready for future municipal/state scopes: the same collection already stores `school_code`, and the endpoint uses `scope=global` (no filter). Adding `scope=city/state` only needs a lookup from `schools.city`/`schools.state`.

## Gamification
- XP: 10 per correct lesson answer + game XP (20–40) + 20 daily.
- Coins: variable + 15 daily.
- Level: `max(1, xp // 100 + 1)`.
- Streak: server-tracked from `last_activity_at`.
- Badges: `guardian` (contraseñas), `phishcazador` (phishing), `escudo` (3+ módulos), `maestro` (todos), `racha7` (racha ≥ 7 días), `detective` (juego fraude ≥ 4 aciertos).
- Daily challenges: shown on Dashboard, mapped to real completions.
- **Business enhancement** implemented: **Liga semanal por escuela** — impulsa retención diaria e invita a otras escuelas a unirse mediante compartir el código único.

## What is MOCKED / SIMULATED
- Nothing critical is mocked in Phase 2. Real backend, real AI (Claude Sonnet 4.6), real PDF, real Google Auth, real MongoDB.
- Some game rewards are fixed (e.g. `password` game always awards +20 XP if strength ≥ 80%); this is a product design decision, not a mock.

## What is DEFERRED
- Local offline persistence beyond session token (progress already lives in MongoDB and reloads via `/auth/me`; adding an offline cache is optional).
- Push notifications for streak reminders.
- Municipal/state leaderboards (architecture ready).
- Certificate signature verification page (a public `/api/certificates/verify/{cert_id}` could be added).

## Testing
- 17/17 backend pytest cases pass. Suite lives at `/app/backend/tests/test_backend.py`.
- Manual login on web preview works with Google (real credential required).
- Test bearer tokens are documented in `/app/memory/test_credentials.md` for CI/automation.
