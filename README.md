# Revelo

Revelo is a real-time multiplayer deduction game where each player has a secret shape+color combination.
Your objective is simple: survive and outsmart everyone else.

## What the game is about

- 4 to 6 players join the same room.
- Each player receives one secret combination:
  - Shape: `circle`, `square`, `triangle`
  - Color: `red`, `blue`, `green`
- Combinations are unique inside a match.
- You only see your own combination.
- Last alive player wins.

## Current gameplay rules

- On your turn, you guess another player's exact combination.
- If your guess is exactly correct:
  - target is eliminated
  - you keep the turn
- If your guess is wrong (partial or complete miss):
  - you gain 1 error
  - turn passes away from you
- At 2 errors, you are eliminated.
- Partial matches still reveal information globally:
  - shape match reveals target shape
  - color match reveals target color

## What is already implemented

- Real-time room lobby (joiners appear without refresh).
- Real-time game board updates:
  - turns
  - guesses
  - eliminations
  - revelations
- Host controls:
  - start game
  - restart game after finish
  - close room
- Player controls:
  - leave lobby
  - leave game
- End-game full-page result with winner.
- Modern dark UI, toasts, and loading spinner.

## Local setup

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

### 3) Prepare Supabase

- Run SQL migration from `supabase/migrations/20260415000000_initial.sql`
- Enable Anonymous Auth in Supabase

### 4) Run app

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Product vision (next improvements)

To make matches more dynamic and fun, planned additions include:

- **Minigame turn steals** in specific moments (ex: partial reveal challenge).
- **More dramatic rounds**:
  - comeback mechanics
  - anti-snowball rules
- **Game feel polish**:
  - micro animations
  - better sounds/feedback
  - richer guess history storytelling
- **Quality improvements**:
  - better onboarding screens
  - clearer in-game hints and rule reminders
  - stronger test coverage

## Philosophy

Revelo is designed to be:

- easy to understand in 1 minute
- tense in every turn
- social and replayable
- fair, fast, and reactive in multiplayer
