# Hack-Seguro - PRD (Phase 1)

## Overview
**Hack-Seguro** is a mobile-first (Expo) educational and gamified application to teach cybersecurity and prevent cybercrimes to children, teenagers, parents and older adults in Mexico. Duolingo-style progression, focused on local Mexican scam scenarios.

## Phase 1 Scope (this delivery) — Frontend UI-first with mock data
Fully navigable app with local state. Backend, real AI chatbot, real auth, cloud persistence, downloadable certificates and voice narration are deferred to Phase 2.

## Feature list (Phase 1)
- **Welcome + profile selection** — 4 profiles (Niño/Estudiante default, Adolescente, Padre/Madre, Adulto Mayor).
- **Bottom tab navigation** — Inicio, Aprende, Juegos, CiberBot, Perfil.
- **Dashboard** — greeting, streak chip, XP/Coins/Hearts pills, level card with progress, daily reward chest, recommended lesson card, "Jugar ahora", daily challenges list, badges preview.
- **Learning path (Aprende)** — 10 modules with lessons (Contraseñas, Phishing, WhatsApp, Redes, Videojuegos, Fraudes bancarios, Compras, Privacidad, IA, Ciberacoso). Locked/unlocked states progressing gate by gate.
- **Interactive lesson** — supports multiple-choice, true/false and "spot the fraud" with immediate feedback and celebratory finish screen (stars, XP, coins).
- **Games (4)** — ¿Fraude o Real? swipe, Memorama Ciber, Reto de Contraseña (strength meter), Escape del Hacker (narrative decisions).
- **CiberBot** — pre-scripted keyword-based Spanish assistant, quick action chips, never asks for personal data. **SIMULATED** (no LLM).
- **Profile** — avatar, level, XP, coins, streak, badges grid, accessibility toggles (Large text, High contrast), Family/School placeholders, reset profile.
- **Gamification** — XP, level (1-50 scale, 100 XP/level), CiberMonedas, hearts, streak (mocked to 3), 6 badges, daily chest claim.
- **Local Mexican scam context** — Estafeta paquetería, becas Bienestar, BBVA, Marketplace, WhatsApp familia, etc.

## Design tokens
- Primary brand: Navy `#00357a`
- Accent: Lime green `#d0e80b`
- Surfaces cream/white `#F8FAFC`/`#FFFFFF`, dark ink text.
- Icons: `@expo/vector-icons` (Ionicons).
- Fonts: system default (rounded weight 800 for headings).

## File map
- `/app/frontend/src/theme.ts` — color/spacing/radius tokens
- `/app/frontend/src/mock.ts` — modules, lessons, games, badges, chatbot intents
- `/app/frontend/src/store.tsx` — React Context state (in-memory)
- `/app/frontend/app/_layout.tsx` — providers + icon prewarm preserved
- `/app/frontend/app/index.tsx` — welcome + profile
- `/app/frontend/app/(tabs)/*` — tabs
- `/app/frontend/app/lesson/[id].tsx` — lesson runner
- `/app/frontend/app/game/*` — 4 games

## What is SIMULATED / MOCKED
- **CiberBot: MOCKED** — Local keyword-based script, no LLM.
- **Progress/state: LOCAL ONLY** — resets on app cold start (no persistence yet).
- **Daily reset: MOCKED** — streak fixed to 3, daily chest is per-session.
- **Family/School panels: PLACEHOLDER** — labelled "Próximamente".
- **Certificates: PLACEHOLDER** — no real file generation.

## Phase 2 (recommended next actions)
1. Backend FastAPI + MongoDB (users, progress, lessons, games, badges, certificates).
2. Persist progress locally with `@/src/utils/storage` and remotely via API.
3. Integrate real LLM for CiberBot via `integration_playbook_expert_v2` (Emergent LLM Key candidate).
4. Real streak based on server-side timestamps.
5. Certificate generation + shareable PDF.
6. Auth flow (JWT or Emergent Google Auth) for parents/teachers.
