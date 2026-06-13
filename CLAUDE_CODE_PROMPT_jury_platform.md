# Build Prompt: ET Enterprise Security Awards 2026 — Jury Evaluation Platform

You are building a **standalone, internal, zero-cost** web platform for The Economic Times Enterprise Security Awards 2026. A closed panel of jurors logs in, reads nominations, sees the AI pre-assessment, and submits scores. An admin uploads the source data, assigns nominations, and exports ranked results per category.

Read this whole brief before writing code. Then read the data files (§4) and confirm their structure before building the importer. Only §11 is still open — ask me about it before coding the scoring form; everything else is decided.

---

## 1. Hard constraints (non-negotiable)

- **$0 running cost.** Free tiers only. No paid APIs, no paid hosting, no paid auth. If a choice risks a bill, pick the free alternative and tell me.
- **No runtime LLM calls.** The AI scores already exist in the audited Excel files (§4). You import them. Never call an AI API at runtime — that's the cost trap. The only "AI" in this app is read-only imported data.
- **Standalone.** Self-contained. Do not depend on or integrate with the existing `ciso.economictimes.indiatimes.com` portal.
- **Internal / closed.** Users are a fixed jury panel (~50 max), not the public. No public signup. Admin creates juror accounts.

## 2. Tech stack (use exactly this unless you flag a reason)

- **Database + Auth:** Supabase (free tier). Postgres, Supabase Auth, Row-Level Security.
- **Frontend + API:** Next.js (App Router, TypeScript) on Vercel (free tier).
- **Tables/UI:** TanStack Table for list views; Tailwind + shadcn/ui for components.
- **Import:** runs **server-side inside the Next.js app, triggered from the admin panel** (see §6) — not a developer-run local script. Parse `.xlsx` with `xlsx` (SheetJS) in a server route. Service-role key stays server-side only, never in the client bundle.

## 3. Scale + core rules (size everything for this)

- ~2,347 raw nomination rows across 22 categories; ~1,348 AI-audited rows.
- 22 categories → 3 master categories. Jury panel up to ~50.
- **Exactly 2 jurors per nomination.**
- **Final score = simple average of the 2 assigned jurors' total scores.** No weighting, no trimmed mean.

This is small. No microservices, no queues. One Next.js app + Supabase is the whole system.

## 4. Source data — real structure (verify against the files)

Four Excel files. Adjust paths to wherever I place them locally / upload them via the admin panel.

### 4a. `TOTAL_nominations___2_.xlsx` — raw nominations (source of truth for answers)
- **22 sheets**, one per category:
  `et ciso`, `et cyberwoman`, `et dpo`, `et rising star`, `et lifetime achievement`, `et cybersecurity influencer`, `bfsi`, `itites`, `manufacturing`, `healthcare and pharma`, `retail+fmcg`, `genericall sectors`, `ai security and responsible ai`, `identity and access management`, `zero trust architecture`, `cloud security champion`, `edrxdr implementation`, `shift left security and devseco`, `ot security`, `soc maturity and ransomware res`, `data protection and privacy`, `endpoint security`.
- Each sheet: header row + data rows, up to ~101 columns. **Every sheet has a different question set** — no universal schema. Treat each sheet's header row as that category's question list.
- Stable columns in most sheets: `Nomination Id`, `User Id`, `Status`, `Added Date`, `Nomination Status`, `Email`, `First Name`, `Last Name`, `Mobile`, `Designation`, `Company`, `Master Category Name`, `Category Name`, plus `Round 1/2/3 ...` question columns and a `Basic Nomination Form ...` block at the end.
- **Data quality problems to handle (see §6):**
  - Mojibake / bad encoding: `â‚¹` (should be ₹), `&nbsp;`, `&ndash;`, `&rsquo;`, etc.
  - **Duplicate/junk columns:** some sheets repeat a header ~15× (e.g. `Round 2 Was This A New Implementation...`) and carry many empty `Please Specify` columns, mostly blank. Drop empties, de-duplicate, don't trust column position.
  - Floats as IDs (`148849.0`), dates sometimes `########`.
- **Join key:** `Nomination Id`.

### 4b–4d. The three audited lists (AI assessment, already done — import read-only)
- `Individual_Category_Audited_List.xlsx` — 6 sheets: `ET CISO of the Year`, `Lifetime Achievement`, `Rising Star`, `DPO`, `ET Cyberwoman`, `CYBERSEC INFLUENCER`. ~908 rows.
- `Organisational_Excellence_Category_Audited_List.xlsx` — 6 sheets: `BFSI`, `ITITES`, `MANUFACTURING`, `HEALTHCARE`, `RETAIL`, `GENERIC`. ~169 rows.
- `Project_and_Technology_Excellence_Category_Audited_List.xlsx` — 6 sheets: `AI Security and Responsible AI`, `Cloud Security Champion`, `Zero Trust`, `EDRXDR Implementation`, `Data Protection and Privacy`, `ENDPOINT`. ~271 rows.

**Audited columns (Individual & Organisational):** `Award Category`, `Nominee Name`, `Designation`, `Company`, `Basic Nomination Form Organisational Revenue`, `Basic Nomination Form Employee Size`, `Total Score`, `Qualifies` (YES/NO), `Jury Notes`, `Strategic Feedback`, `Summary / Answer`.

**Project file is richer** — adds a per-criterion block: `Score: People`, `Score: Process`, `Score: Technology`, `Score: Community Impact`, `Score: Legacy`, `Score: Major Initiative`, `Score: Commitment & Structure`, `Score: Domain Criticality`, `Score: Maturity`, `Score: Frameworks & Standards / Compliance`, `Score: Governance / Ownership`, `Score: Execution & Impact`, `Score: Innovation & Differentiation`, `Score: Strategic Vision`, then `Total Score`, `Qualifies`, etc. Capture as `criteria_scores_json`.

The audited files have **no `Nomination Id`**, so the join to raw is fuzzy: match on normalized (`Nominee Name` + `Company` + `Award Category`). Build a normalization helper (lowercase, trim, collapse whitespace, strip punctuation) and **report unmatched rows** rather than dropping them silently.

### 4e. Import policy — load only fully-matched nominations
**Only persist a nomination if it has BOTH raw data AND a matched AI assessment.** Concretely:
- Raw row with no audit match → not loaded (report it).
- Audited row with no raw match → not loaded (report it).
- Matched pair → loaded.

This means the live platform set is the matched intersection (≤1,348), and the ~1,000 un-audited raw nominations do not enter the platform. Still produce a reconciliation report (per-category counts of raw-only / audited-only / matched) so the exclusions are visible and reviewable.

## 5. Data model (Supabase / Postgres)

- **`jury_users`** — `id`, `name`, `email`, `role` (`admin` | `juror`), linked to Supabase Auth. No plaintext passwords.
- **`category_mapping`** — `id`, `raw_label`, `normalized_key`, `master_category`. Normalizes the many spellings of a category across sheets to one canonical key. Examples: `ET CISO`, `ET CISO of the Year`, `et ciso` → `et_ciso`. Use this everywhere a category is read or matched, in import and in the app.
- **`nominations`** — `id`, `nomination_id` (from raw), `category_key` (FK → `category_mapping.normalized_key`), `master_category`, `nominee_name`, `designation`, `company`, `email`, `mobile`, `raw_data_json` (cleaned question→answer map), timestamps. **No `source_present` column** — source is derived from relationships (a `nominations` row = raw imported; a related `ai_assessment` row = audited). Per §4e, every loaded nomination has both anyway.
- **`ai_assessment`** — `id`, `nomination_id` FK, `total_score`, `qualifies` (bool), `summary`, `jury_notes`, `strategic_feedback`, `criteria_scores_json` (null for Individual/Org, populated for Project). **Read-only to jurors.**
- **`rubric_templates`** — `id`, `master_category`, `criteria_json` (array of `{key, label, min, max}`). One rubric per master category (§7). Drives the dynamic scoring form.
- **`assignments`** — `id`, `juror_id` FK, `nomination_id` FK, `assigned_by`, `assigned_at`, `status` (`pending` | `scored`). **Exactly 2 per nomination.** Unique on (juror, nomination); enforce a max of 2 jurors per nomination at the app layer.
- **`scores`** — `id`, `juror_id` FK, `nomination_id` FK, `criteria_scores_json` (per rubric criterion), **`total_score`** (computed and stored at submit time — see §9), `comment`, `submitted_at`, `version`. Edits write a new version; never overwrite.
- **`conflicts`** — `id`, `juror_id` FK, `company` (or pattern). A juror is never assigned a nomination from a conflicted company.

Enable RLS: a juror reads only their own assignments + the nominations assigned to them, and writes only their own scores. Admin bypasses.

## 6. Import workflow — admin upload, not a dev script

The whole import runs from the admin panel so ET teams refresh data without a developer. Server-side in a Next.js route using SheetJS.

**Admin flow:** Upload XLSX file(s) → Validate → Preview results → Confirm → Commit to DB.

Inside that flow, the engine must:
1. **Parse** each sheet of each uploaded workbook.
2. **Clean every cell:** decode HTML entities (`&nbsp;`→space, `&ndash;`→–, `&rsquo;`→', …); fix mojibake (`â‚¹`→₹ and similar UTF-8 misreads); trim + collapse whitespace; convert float-looking IDs to clean strings.
3. **Per-category question map:** from each raw sheet's header, build `{column → clean_question}`. Drop columns empty across the whole sheet. De-duplicate repeated headers (keep first non-empty). Persist these maps so the UI renders readable labels.
4. **Build `raw_data_json`** per nomination: ordered clean question→answer map, skipping blanks, grouped by Round 1 / Round 2 / Round 3 / Basic.
5. **Normalize categories** through `category_mapping`; derive master category from `Master Category Name` or the audited file the category lives in.
6. **Fuzzy-join** audited→raw on normalized (Nominee + Company + Category). Attach AI assessment.
7. **Apply §4e:** keep only matched pairs. Build the reconciliation report.
8. **Preview screen** shows: matched count, raw-only count, audited-only count (per category) + a sample of rows about to be imported. **Nothing is written until the admin clicks Confirm.**
9. **Idempotent upsert** keyed on `nomination_id` so re-running doesn't duplicate.

Store clean data. Never clean at render time.

## 7. Rubric templates (per master category, configurable)

Do not hardcode one rubric. Seed three, all data-driven from `rubric_templates`:
- **Individual Leadership** and **Organisational Excellence:** start with `Leadership`, `Innovation`, `Execution`, `Business Impact`, each 0–10. (I may revise criteria.)
- **Project & Technology Excellence:** mirror the 14 criteria in the Project audited file (People, Process, Technology, Community Impact, Legacy, Major Initiative, Commitment & Structure, Domain Criticality, Maturity, Frameworks & Standards/Compliance, Governance/Ownership, Execution & Impact, Innovation & Differentiation, Strategic Vision). Confirm scale with me (§11).

The nomination detail page reads the rubric for that nomination's master category and renders the scoring form dynamically. One page, all categories.

## 8. Application — features and screens

**Auth & roles:** Supabase Auth email/password. Admin creates juror accounts (no public signup). Roles: `admin`, `juror`. Jurors fetch everything from Supabase — never from Excel.

**Juror dashboard:** counts (assigned / completed / pending) + a TanStack table of assigned nominations (ID, Category, Company, Nominee, Status). Row → detail.

**Nomination detail — three tabs:**
- *Tab 1 — Nomination:* render `raw_data_json` with clean labels, grouped by round. Header: nominee, designation, company, category.
- *Tab 2 — AI Assessment:* read-only — AI total score, Qualifies, Summary, Jury Notes, Strategic Feedback, per-criterion breakdown if present. Labelled as AI guidance, not editable.
- *Tab 3 — Jury Evaluation:* dynamic form from the rubric template + comment box. Submit writes a `scores` row with computed `total_score`. Locked after submit but editable (edit = new version). Show the juror's prior submission if any.

**Admin panel:**
- **Data upload** (§6): upload → validate → preview → confirm.
- **Juror management** + conflict lists.
- **Assignment:** assign **exactly 2 jurors** per nomination; helper to distribute a category's nominations across jurors in pairs. Respect conflict rules.
- **Progress dashboard:** assigned / completed / pending, per juror **and** per category.
- **Results dashboard** (per category): final average score, ranking, AI score as a reference column, export to CSV/XLSX.

## 9. Scoring, completion & ranking

- **Per-juror total:** when a juror submits, compute and store `scores.total_score` from their per-criterion inputs (default: sum or mean of criteria per the rubric — confirm in §11). Storing it makes ranking and export fast.
- **Final score = average of the 2 assigned jurors' `total_score`.** Example: 84 and 92 → 88.
- **Completion rule:** a nomination is **Complete only when all assigned jurors (2/2) have submitted.** Incomplete nominations (2/1 or 2/0) are **excluded from rankings** and clearly flagged in the progress view.
- **Ranking (per category):** take Complete nominations → final average → sort descending → assign ranks. **Ties are surfaced for manual review, never auto-broken.**
- **AI score:** reference only by default — visible to jurors, **excluded from the final number and the rank.** Make the weighting a config value so ET can later switch to e.g. 70% jury / 30% AI without a code change.

## 10. Build order (incremental, with checkpoints)

1. **Scaffold:** Next.js + Supabase + env wiring. Confirm a trivial authed page works.
2. **Schema:** create all tables + `category_mapping` + RLS. **Show me the SQL before applying.**
3. **Import (admin upload):** build §6 end-to-end against the real files. **Stop at the preview/reconciliation step for my review before any Confirm/commit writes production data.**
4. **Read paths:** juror dashboard + nomination detail (Tabs 1 & 2).
5. **Scoring:** rubric templates + Tab 3 write path with `total_score` + versioning/locking.
6. **Admin:** juror management, 2-juror assignment, conflicts, progress dashboard.
7. **Results + ranking + export** (apply the completion rule).
8. **Deploy** to Vercel; document the free-tier setup, incl. Supabase's weekly-inactivity pause.

Commit at each step. No destructive DB operations without asking.

## 11. Still open — confirm before coding the scoring form

1. **Rubric criteria/scales:** keep 0–10 for Individual/Org? Confirm the Project criteria and their scale.
2. **Per-juror total from criteria:** sum of criteria, or mean? (This sets what `scores.total_score` holds.)

Already decided (don't re-ask): matched-only import (§4e), 2 jurors per nomination, final = simple mean, AI reference-only with configurable weight, ties surfaced for manual review.

## 12. Out of scope (don't build)

- Public pages or nominee self-service.
- Any payment/billing.
- Runtime AI generation or re-scoring.
- Integration with the existing ET portal.
- Mobile native apps.

---

When ready: read the four Excel files, verify structure against §4, print a short summary (sheet list, row counts, reconciliation gap under the §4e matched-only rule), then propose the schema SQL for my review before writing it to Supabase.
