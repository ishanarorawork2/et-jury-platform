# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ET Enterprise Security Awards 2026 — Jury Evaluation Platform. Internal, closed-panel web app for ~50 jurors to score nominations. Full spec is in `CLAUDE_CODE_PROMPT_jury_platform.md` — read it before writing any code.

## Hard Constraints

- **$0 cost** — free tiers only (Supabase free, Vercel free, no paid APIs)
- **No runtime LLM calls** — AI scores are pre-imported from Excel files, never generated at runtime
- **Standalone** — no integration with the existing ET portal

## Tech Stack

- **Next.js** (App Router, TypeScript) on Vercel
- **Supabase** — Postgres, Supabase Auth, Row-Level Security
- **UI** — Tailwind CSS + shadcn/ui + TanStack Table
- **Excel parsing** — `xlsx` (SheetJS), server-side only in Next.js route handlers; service-role key never in client bundle

## Commands

```bash
npm run dev        # local dev server
npm run build      # production build
npm run lint       # ESLint
```

Database: use Supabase CLI or dashboard migrations. **Always show SQL to the user before applying to Supabase.**

## Architecture

### Data Flow
1. Admin uploads 4 Excel files via admin panel → server-side import route validates, cleans, fuzzy-joins, previews, then on Confirm upserts to DB
2. Only nominations with **both** a raw row AND a matched AI assessment are loaded (~1,348 of ~2,347 raw rows)
3. Admin assigns exactly 2 jurors per nomination (conflict-aware)
4. Jurors log in, read nominations (Tab 1), read AI assessment (Tab 2), submit scores via dynamic rubric form (Tab 3)
5. Final score = simple average of the 2 jurors' `total_score`; rankings exclude incomplete nominations

### Key Tables
- `jury_users` — juror/admin accounts linked to Supabase Auth
- `category_mapping` — normalizes 22 raw category spellings → canonical keys → 3 master categories
- `nominations` — core entity; `raw_data_json` holds clean question→answer map; every row has a matching `ai_assessment`
- `ai_assessment` — read-only imported AI scores; `criteria_scores_json` populated only for Project category
- `rubric_templates` — one row per master category; `criteria_json` drives the dynamic scoring form
- `assignments` — exactly 2 per nomination; unique on (juror, nomination_id)
- `scores` — append-only versioned submissions; stores computed `total_score`
- `conflicts` — blocks a juror from being assigned nominations from a conflicted company

### RLS
Jurors see only their own assignments and the nominations assigned to them. Admins bypass RLS.

### Import Engine (§6 of spec)
Cell cleaning pipeline: HTML entity decode → mojibake fix (e.g. `â‚¹` → `₹`) → trim/collapse whitespace → float ID → string. Fuzzy join audited→raw on normalized(Nominee + Company + Category) — lowercase, trim, collapse whitespace, strip punctuation. Report unmatched rows; never drop silently.

### Scoring Rules (§9 of spec)
- `scores.total_score` is computed at submit time (sum or mean of criteria — **confirm with user before building Tab 3**, this is an open question)
- Final score = average of exactly 2 jurors' totals
- Incomplete nominations (< 2 jurors scored) are excluded from rankings
- Ties surfaced for manual review, never auto-broken
- AI score is reference-only; weighting is a config value (default 0%), not hardcoded

## Build Order

Follow this sequence; commit at each step and get user approval before destructive or irreversible actions:

1. Scaffold Next.js + Supabase + env wiring
2. Schema SQL → **show user before applying**
3. Import engine → **stop at preview/reconciliation for user review before any DB writes**
4. Read paths: juror dashboard + nomination detail Tabs 1 & 2
5. Scoring: rubric templates + Tab 3 write path
6. Admin: juror management, assignment, conflicts, progress dashboard
7. Results, ranking, export
8. Deploy to Vercel

## Open Questions (§11 — confirm before coding Tab 3)

1. Rubric scale for Individual/Org categories: keep 0–10?
2. Per-juror `total_score`: sum of criteria scores, or mean?

## Out of Scope

Public pages, payments, runtime AI generation, ET portal integration, mobile native apps.
