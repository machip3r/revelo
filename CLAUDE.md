@AGENTS.md

# Revelo Technical Documentation

## Core project constraints

- Framework: Next.js App Router + TypeScript.
- Styling: Tailwind CSS.
- Backend/Data: Supabase (Postgres, Auth, Realtime).
- All game state updates happen server-side through API routes.
- Client never mutates sensitive game tables directly.
- Service role key is server-only and used only in trusted route handlers.

## Mandatory repository rule

- **Every database change must also update the initial schema file in `supabase/migrations/20260415000000_initial.sql`.**

## Environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)

## High-level architecture

- `app/`:
  - pages and route handlers
  - App Router UI entries
- `components/`:
  - reusable UI and client wrappers (`SessionRoot`, `Toast`, game components)
- `lib/`:
  - domain logic, validation, constants, Supabase clients
- `supabase/migrations/`:
  - source-of-truth SQL schema

## Data model (main tables)

- `users`: profile row for auth user id + display name
- `rooms`: room identity, host, status, current turn owner
- `players`: user participation in room + errors + alive + turn order
- `combinations`: secret shape/color per player
- `guesses`: all historical guesses and match flags
- `revelations`: globally known shape/color state for each target

## Gameplay flow

1. User lands on `/`, signs in anonymously, sets display name.
2. User creates or joins room.
3. Host starts game:
   - assign unique combinations
   - create revelation rows
   - choose random first attacker
4. Turn loop:
   - attacker submits guess
   - server evaluates outcome
   - server updates guesses / players / room / revelations
   - realtime broadcast refreshes all clients
5. End condition:
   - one player alive => room `finished`
   - winner shown in full-page result UI

## Turn logic (implemented contract)

- Exact match:
  - eliminate target
  - attacker keeps turn
- Non-exact guess (partial or complete miss):
  - attacker gains error
  - turn passes away from attacker
  - if attacker reaches 2 errors, attacker eliminated
- Partial reveal:
  - shape and/or color can become globally known in `revelations`

## Realtime strategy

- Subscribed entities:
  - `players`
  - `revelations`
  - `guesses`
  - `rooms`
- Hybrid approach:
  - realtime subscription for immediate updates
  - short polling fallback for resilience
- Browser Supabase client is singleton to avoid auth/realtime desync.

## API routes map

- Profile:
  - `POST /api/user/profile`
- Room:
  - `POST /api/room/create`
  - `POST /api/room/join`
  - `GET /api/room/snapshot`
  - `POST /api/room/close`
  - `POST /api/room/leave`
- Game:
  - `POST /api/game/start`
  - `POST /api/game/guess`
  - `GET /api/game/snapshot`
  - `POST /api/game/restart`

## UI route map

- `/`: home (create/join)
- `/room/[code]`: lobby
- `/game/[roomId]`: game runtime

## Notable components

- `components/SessionRoot.tsx`:
  - anonymous session bootstrap + realtime auth sync
- `components/Toast.tsx`:
  - global feedback
- `components/Spinner.tsx`:
  - loading states
- `components/game/*`:
  - board, player cards, guess modal, history log

## File structure snapshot

- `app/layout.tsx`
- `app/page.tsx`
- `app/room/[code]/page.tsx`
- `app/room/[code]/RoomClient.tsx`
- `app/game/[roomId]/page.tsx`
- `app/game/[roomId]/GameClient.tsx`
- `app/api/**/route.ts`
- `lib/gameLogic.ts`
- `lib/validation.ts`
- `lib/combinationAssign.ts`
- `lib/constants.ts`
- `lib/types.ts`
- `lib/supabase/{client,server,admin}.ts`
- `middleware.ts`
- `supabase/migrations/20260415000000_initial.sql`

## Security and ownership rules

- Only host can:
  - start game
  - restart game
  - close room
- Non-host players can leave room via dedicated route.
- Guess submission is validated server-side:
  - not your own player
  - target alive
  - attacker alive
  - guess does not contradict known revelations

## UX behavior decisions

- When room/game becomes invalid for a user (403/404 snapshot), client redirects to `/`.
- End-game screen is full page.
- Non-host end-game actions are limited to leaving.
- Confirm modal is used for destructive room close action (no native browser alert).

## Planned extension: minigame turn steals

Target direction:

- Trigger minigames only in explicit conditions (e.g. partial guess challenge).
- Keep them short and fair (seconds, single interaction).
- Add anti-abuse constraints (cooldowns/one-use rules).
- Persist duel outcomes so turn ownership remains auditable.

Implementation note:

- If introducing new turn-steal entities/columns, update:
  - SQL migration file
  - domain logic in `lib/gameLogic.ts`
  - server routes (especially `guess` path)
  - realtime subscriptions and client state handling