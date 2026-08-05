# Hack-Seguro - PRD

## Overview
Mobile-first Expo (SDK 54) app + FastAPI + MongoDB backend that teaches cybersecurity and cybercrime prevention to Mexican children, teens, parents and older adults. Duolingo-style progression, four mini-games, Claude-powered CiberBot, weekly leagues by school code with municipal/state/national escalation, PDF certificates with public QR verification, quarterly seasons, shareable school posters and push notifications for daily streak.

## Phase status
- **Phase 1 (frontend UI + mock)**: DONE
- **Phase 2 (real backend + Claude Sonnet 4.6 + Google Auth + leagues + PDF + teacher panel)**: DONE
- **Phase 3 (public cert verification + municipal/state/national scopes + quarterly seasons + shareable school poster + push notifications)**: DONE

## Architecture
- **Backend**: FastAPI + Motor (MongoDB) on port 8001. All routes under `/api`.
- **Auth**: Emergent-managed Google OAuth. Sessions 7 days. Token in Expo `SecureStore` (mobile) / `localStorage` (web).
- **AI**: Claude Sonnet 4.6 via `emergentintegrations` (Emergent LLM Key). Multi-turn per session.
- **PDF**: ReportLab (server-side); certificates carry a QR pointing to public verification page.
- **PNG poster**: Pillow (server-side) 1080×1920.
- **QR (poster + PDF)**: `qrcode` library, navy on white.
- **Push notifications**: Emergent-managed relay at `integrations.emergentagent.com`. `EMERGENT_PUSH_KEY` is `placeholder` in preview and auto-filled in deployment. Only works in real device builds.
- **Persistence**: MongoDB `hackseguro` DB with collections `users`, `user_sessions`, `schools`, `weekly_scores`, `lesson_events`, `game_events`, `chat_messages`, `certificates`.

## Backend endpoints (all under `/api`)
- **Auth**: `POST /auth/session`, `GET /auth/me`, `POST /auth/logout`.
- **Schools**: `GET /schools/mine`, `GET /schools/{code}`, `POST /schools/join`, `GET /schools/{code}/poster.png` (public).
- **Progress**: `GET /progress`, `POST /lessons/complete`, `POST /games/complete`, `POST /daily/claim`.
- **Leaderboards**: `GET /leaderboards/weekly?scope={school|city|state|global}` (Monday-anchored, Top 10, `me` object).
- **Seasons**: `GET /seasons/current`, `GET /seasons/leaderboard` (quarterly, ranking by **avg XP per active student**).
- **Certificates**: `GET /certificates/{module_id}` (auth PDF), `GET /certificates/verify/{cert_id}` (public JSON), `GET /verify/{cert_id}` (public HTML page — served under `/api/verify/...` for K8s ingress compatibility).
- **Chatbot**: `POST /chatbot`, `GET /chatbot/history`.
- **Teacher**: `GET /teacher/roster` (role teacher/parent).
- **Public landing**: `GET /join?code=...` (served under `/api/join?code=...`; QR-friendly).
- **Push**: `POST /register-push`, `POST /push/streak-reminder`.

## Frontend map
- `/app/frontend/src/api.ts` — API client + URL builders (`schoolPosterUrl`, `schoolShareUrl`, `verifyPageUrl`, `weeklyLeaderboard(scope)`, `seasonsLeaderboard`, `registerPush`).
- `/app/frontend/src/auth.tsx` — AuthContext + Emergent Google login (web + mobile deep link). Triggers push registration when user is present.
- `/app/frontend/src/store.tsx` — thin action wrapper (calls backend, updates auth user).
- `/app/frontend/src/push.ts` — Expo push registration (silent no-op on Expo Go / web).
- `/app/frontend/app/index.tsx` — Welcome + Google login.
- `/app/frontend/app/join-school.tsx` — School code + role + grade + group.
- `/app/frontend/app/(tabs)/{index,learn,games,league,chatbot,profile,teacher}.tsx` — Tabs. `teacher` visible only for teacher/parent.
- `/app/frontend/app/lesson/[id].tsx` — Interactive lesson; posts `/lessons/complete`.
- `/app/frontend/app/game/{fraude-real,memorama,password,escape}.tsx` — 4 games; each posts `/games/complete`.
- `/app/frontend/app/school-share.tsx` — Shareable school code screen with in-app QR (react-native-qrcode-svg) + native share + poster download.

## Weekly League (scopes)
- **Scope `school`** (default): all users under the same school_code.
- **Scope `city`** / **`state`**: all schools sharing city / state.
- **Scope `global`**: no filter.
- All scopes ranked Top 10 with gold/silver/bronze medals; `me` block returns my rank + XP.
- Reset: Monday 00:00 UTC.

## Quarterly seasons
- 3-month seasons: Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Oct-Dec).
- Winning metric: **avg_xp_per_active_student** = total_school_xp / distinct_active_students within the season. This rewards student engagement, not just school size.
- Endpoint `/api/seasons/leaderboard` returns Top 10 schools with rank, total_xp, active_students, avg_xp_per_active_student, city, state.

## Certificate PDF + Public verification
- Every completed module (>=1 lesson) unlocks a downloadable PDF signed with a QR code linking to `/api/verify/{cert_id}`.
- Public JSON: `GET /api/certificates/verify/{cert_id}` — `{ valid, cert_id, student_name, grade, group, school, module_id, module_title, issued_at }`.
- Public HTML: `GET /api/verify/{cert_id}` — branded Hack-Seguro card showing validity or "not found".

## Shareable school poster
- **Server PNG**: `/api/schools/{code}/poster.png` — 1080×1920, brand colors, school name, code, and QR pointing to `/api/join?code=CODE`.
- **In-app**: `/school-share` screen shows the school code, a locally-generated QR (`react-native-qrcode-svg`), native Share of the join URL, and a "Descargar póster" button that saves + opens the PNG (native share sheet on mobile, new tab on web).

## Push notifications
- Emergent-managed relay. `EMERGENT_PUSH_KEY` in `/app/backend/.env` is filled at deployment.
- Registration endpoint: `POST /api/register-push`.
- Streak reminder trigger: `POST /api/push/streak-reminder` — sends a "¡Tu racha te espera! 🔥" push to registered users with a streak who haven't been active today.
- **DOES NOT WORK IN EXPO GO.** Only real device builds (published from Emergent). User must supply `google-services.json` from Firebase Console at deployment time.

## What is MOCKED / SIMULATED
- `EMERGENT_PUSH_KEY` is `"placeholder"` in preview; real value set automatically at deploy.
- Nothing else is mocked.

## Testing
- 34/36 backend pytest cases pass (94%). Two remaining failures are pre-existing test-quality issues (pytest-xdist race + overly strict banlist substring), not real bugs.
- Frontend visually verified with screenshots for: login, dashboard, learn map, games grid, chatbot with Claude, league (all 4 scopes), season leaderboard, share-school poster, teacher panel, profile with certificates.
- Test bearer token + regeneration script documented in `/app/memory/test_credentials.md`.
