# Claude Code Session Log — Greenroom Applied AI PM Case Study
**Candidate: Vaidehi Rayate**
**Session duration: ~2 days**
**Tool: Claude Code (Anthropic)**

This document captures the full build process — prompts, analysis, decisions, iterations, and reasoning — for the Greenroom Applied AI PM case study. Shared as bonus material per the case study brief.

---

## Phase 1 — Setup & Orientation

**Prompt:** Read the case study brief (Links 1 & 2 from Notion) and give me a step-by-step plan.

**What happened:**
- Parsed both Notion pages manually (WebFetch couldn't access private Notion)
- Produced a phased plan: Setup → Exploration → Slice decision → Build → Memo → Loom
- Identified the starter repo: `https://github.com/samay-cbh/greenroom-starter`

**Setup commands run:**
```bash
gh repo fork samay-cbh/greenroom-starter --clone=false
git clone https://github.com/vaidehi-mp09/greenroom-starter
npm install
npm run db:reset
npm run dev
```

**DB seeded:** 537 shows, 537 settlements (paid: 455, disputed: 16, signed: 17...), 92 settlements with recoups, 1 named Coastal Spell dispute.

---

## Phase 2 — Data Exploration & Analysis

### Stakeholder Research
Read all 4 transcripts in `data/transcripts/`:
- **Mariana (Booker):** "Two tabs open at 2am — Greenroom and a Google Sheet. Your tool can't handle vs deals."
- **Diego (TM):** "I want to pull up the settlement on my phone on the drive between load-out and the back office."
- **Sarah Kim (Agent, WME):** "Itemisation. Provenance. Tone. The deal was a ghost."
- **Marcus (GM):** "We're paying a tax on every poorly-written deal email we ever signed."

Read `data/ceo-memo.md`: Pri's Q4 mandate — "settlement is the place we are most clearly failing on craft."

Read `data/dispute-thread.md`: Coastal Spell $720 dispute — ambiguous marketing recoup sentence in deal email, 4-day email thread, $720 concession.

### DB Queries (run in TablePlus + sqlite3)

**Deal type distribution:**
```sql
SELECT deal_type, COUNT(*) FROM deals GROUP BY deal_type;
-- vs: 189, flat: 173, percentage_of_net: 129, door: 27, percentage_of_gross: 19
-- 64% of deals can't be settled in-app
```

**The key anomaly — freetext vs structured fields:**
```sql
SELECT id, deal_notes_freetext, bonuses_json FROM deals
WHERE deal_notes_freetext LIKE '%performance bonuses per the deal memo%'
AND (bonuses_json IS NULL OR bonuses_json = '[]');
-- 14 deals: bonuses exist in email, not in system ("ghost bonuses")
```

**Deal updated but structured field stale:**
- `deal_show_0011`: freetext says "bonus threshold dropped to $18,000 via phone call" but `bonuses_json` still shows $23,000

**calculation_json is NULL on all 537 settlements:**
- No stored proof of work on any settlement — even flat deals the tool "supports"

**Disputed settlements with positive signoff:**
```sql
SELECT show_id, status, signoff_text FROM settlements WHERE status = 'disputed';
-- All 16 disputed settlements have positive signoff: "Looks good", "👍", "ok wire monday"
-- TM signed, agent disputed later — the signoff means nothing
```

**Hospitality overages:**
- 107 shows over hospitality cap, $10,258 total
- Every settlement note: "Hospitality $87 absorbed — over rider" (same template string, not a real note)

**Agent-artist linkage:** `artists.agent_id` → `agents.id` → `agencies.id` — the chain works, `agents.email` populated. But nothing in the system ever sends to it.

### Key Findings Summary
1. `notes_freetext` is the source of truth — structured fields are inconsistently filled
2. 14 "ghost bonus" deals reference email threads that aren't in the system
3. All 537 settlements have `calculation_json = NULL` — no audit trail stored anywhere
4. 16 disputed settlements all have positive TM signoff — disputes come from agents later
5. $10,258 in silent hospitality absorptions with no structured rule
6. Marketing recoup basis (inside cap / outside cap / against gross) never structured — source of Coastal Spell

---

## Phase 3 — Slice Decision

**Process:** Built a "shelf" of identified problems during analysis, then converged.

**Shelf items accumulated:**
1. Recoup basis field (`inside_cap / outside_cap / against_gross`) on deals table
2. Hospitality overage rule (`venue_absorbs / artist_absorbs / split`) on deals table
3. Graceful alternative for unsupported deals (guided mode instead of dead-end)
4. Two-stage deal document (booking confirmation + settlement statement)
5. Artist/manager visibility gap — agent email exists but never used

**Four options considered:**
- Fallback gap (AI parse freetext → pre-fill settlement)
- TM trust (visibility layer)
- Deal structure complexity (non-standard deals, edge cases)
- Vendor receipt flow (expenses assembled pre-show)

**Decision rationale:**
> "The calculator is the wrong leverage point. Mariana's spreadsheet wasn't doing anything her phone calculator can't. What it gave her was a place where the numbers were assembled and the structure was clear. That's a presentation problem, not a computation problem."

The two cases that needed fixing were upstream: data integrity (recoup basis, hospitality overage never structured) and expense assembly (receipts chased at midnight from 5 disconnected sources).

**Slice:** Vendor receipt flow + Anomaly-resistant data model. These two unlock the others.

---

## Phase 4 — Build

### 4.1 Vendor Receipt Flow

**Prompt:** Build a vendor receipt flow. Vendors linked to shows, upload receipts, AI parses and populates expense ledger.

**First attempt:** Used Anthropic API (claude-opus-4-5) for receipt parsing.

**User feedback:** "Can we use a free open-source model? I don't want to add API key dependencies."

**Decision:** Tesseract.js (OCR) + pdf-parse (PDF text extraction) + regex parser. Zero API keys, fully offline.

**Regex parser logic:**
- Find "Total / Amount Due / Balance Due" line → extract amount
- Fallback: largest dollar amount in document
- Category: keyword matching ("speaker/microphone" → sound, "catering/rider" → hospitality, etc.)
- Vendor name: first non-trivial line

**Schema changes:**
```typescript
// New vendors table (show_id nullable for master pool)
vendors: { id, showId, name, category, contactName, contactEmail, createdAt }

// Expenses additions
expenses: { ...existing, vendorId, receiptRaw, receiptParsed }
```

**Bug fixed:** `pdf-parse` loaded at module level caused `DOMMatrix is not defined` server error. Fixed by lazy-requiring inside the function only when actually parsing a PDF.

### 4.2 Vendor UX Iterations

**Iteration 1:** Vendors as colored cards with badges in a separate panel
**User feedback:** "Follow the same format as Artist & Agent — Field components, no separate cards"
**Iteration 2:** Vendors as Field items inside Artist & Agent card
**User feedback:** "Separate the vendor block, move it to the left of expenses"
**Final:** Standalone Vendors card (1 col) | Expenses (2 col)

**Add vendor form iterations:**
- Started with: name (free text), category, contact name, contact email (4 fields)
- **User feedback:** "She should select from pre-onboarded vendors, not add someone new. 2 fields only."
- Final: Category select → Name dropdown (filtered from master pool by category). Contact details copied silently from master record.

**Past show lockout:**
- User asked: "Adding vendor to past show should be restricted — is this handled?"
- It wasn't. Added two-layer guard: UI hides button + server action checks `show.date < today`

### 4.3 Expense Table

**Column reorder:** Category → Vendor → Upload receipt → Description → Amount

**Vendor placeholder rows:** For future shows with no expenses, show a row per registered vendor (empty amount, camera icon ready). Only show vendors registered for this show — no placeholder for unregistered categories.

**Vendor assignment in expense rows:**
- Started: dropdown from master pool
- **User feedback:** "Should only pull from vendors registered for this show. No shortcut around the Vendors panel."
- Fixed: dropdown only shows `showVendors`, not `masterVendors`. If no show vendor for category → "Add via Vendors panel" prompt.

**Receipt upload popup fix (3 iterations):**
1. `position: absolute` → clipped by `overflow: hidden` on Card
2. `position: fixed` with `getBoundingClientRect` → went off right edge of viewport
3. Inline form expanding within the table cell → no positioning issues, stays in card

### 4.4 Structured Deal Terms

**Added to schema:**
```typescript
deals: {
  recoupBasis: "inside_cap" | "outside_cap" | "against_gross" | null,
  hospitalityOverageRule: "venue_absorbs" | "artist_absorbs" | "split" | null,
}
```

**Backfill scripts:**
- `recoup_basis`: freetext signal detection first ("against gross" → `against_gross`), then settlement inference (Vs deal with marketing recoup → `outside_cap`)
- Result: 2 `against_gross`, 35 `outside_cap`, 24 `inside_cap`, 477 null

- `hospitality_overage_rule`: deal type + guarantee size heuristics
- Result: 314 `venue_absorbs`, 32 `split`, 3 `artist_absorbs` (high-value Vs deals, manually set), 192 null

**Always visible principle:**
- User: "Include recoup & hospitality overage in deal terms whether discussed or not"
- When null → amber dot + "Not agreed" (not a blank, not hidden)
- Same amber warning in settlement worksheet + deal terms PDF

### 4.5 Settlement Worksheet Redesign

**Starting state:** Two separate experiences — supported deals (flat/% gross) got a calculation, unsupported deals (62%) got a dead-end warning card + disconnected "What the system has" card.

**Process:** User asked for 3 layout options. Presented:
1. Waterfall (numbered steps, top to bottom)
2. Two-column: Deal vs Actual (side by side)
3. Receipt-style (one column, +/- prefixes)

**Decision:** Option 2 — two-column worksheet.

**User clarification before building:** "The redesign should be efficient enough to clock the change but not so far from the UX that users don't recognise where they've landed."

**Built:** Unified `SettlementWorksheet` component replacing both `UnsupportedDeal` and `SupportedSettlement`:
- Same hero number + lifecycle bar preserved
- Every deal type gets the two-column table
- Agreed column shows deal terms; Actual column shows show numbers
- Recoup and hospitality overage rows always present (amber when not agreed)
- Expenses collapsible (click to expand per-category breakdown)

**Exports added:**
- Excel (.xlsx) via SheetJS — expenses always expanded in export
- PDF via `window.print()` with print CSS
- Google Sheets — intent shown, disabled, tooltip explaining OAuth requirement

**Settlement PDF print CSS:**
- User feedback during testing: "PDF generated for settlement should not contain lifecycle, case study section, or signoff"
- Added `no-print` class to lifecycle bar, signoff section, case study footer

### 4.6 Deal Terms PDF

**Prompt:** Add PDF download at bottom of deal terms card containing Artist & Agent block + Deal Terms block.

**Approach:** Opens a new browser window with formatted HTML, triggers `window.print()`. No external dependencies.

**Always shows:** recoup basis and hospitality overage rule — amber ⚠ warning when null.

---

## Phase 5 — Data & Testing Infrastructure

### Test Shows Seeded
- `show_0538` — Pale Lake · May 22 · Vs deal · $4,200 vs 80% net
- `show_0539` — Hollow Branch · May 29 · Flat · $2,800 · sellout bonus
- `show_0540` — Telegraph Avenue · Jun 5 · % of net · recoup_basis intentionally null (demonstrates amber warning)
- `show_0541` — Glass Bottle · Jun 12 · Door deal · self-managed

### Master Vendor Pool
31 vendors seeded across 8 categories (3-5 per category). Vendors are pre-onboarded Nashville-area service providers The Crescent has worked with historically.

### Sample Receipts
10 HTML receipts (2 per category: sound, lights, production, hospitality, marketing). Open in browser → print to PDF → upload, or copy-paste text.

### Full Seed Pipeline
```bash
npm run db:reset
# Runs in order:
# 1. Base dataset (537 shows, artists, settlements)
# 2. Backfill recoup_basis
# 3. Backfill hospitality_overage_rule
# 4. Master vendors + show assignments
# 5. Test shows 0538-0541
```

---

## Phase 6 — Bugs Found in E2E Testing

| Bug | Root cause | Fix |
|---|---|---|
| Upload receipt popup clipped | Card has `overflow: hidden`; absolute positioned popup clipped | Render form inline within table cell — no floating, no z-index |
| Past show: "+ Add vendor" still showing in expense rows | `ExpenseVendorCell` had no date check; used `masterVendors` not `showVendors` | Added `showDate` prop, `isPastShow` check, switched to show-only vendors |
| Settlement PDF includes lifecycle + signoff + case study section | Print CSS didn't target those elements | Wrapped in `.no-print` class |
| Vendor add error: "DOMMatrix is not defined" | `pdf-parse` required at module level, loads browser APIs on server | Lazy-require inside `extractPdfText()` function only |

---

## Phase 7 — Documentation

### MEMO.md
1-page product memo covering: slice rationale, what was built, why sub-features not a big feature (6 reasons), what was cut, assumptions, validation metrics, CEO memo connection.

**Key argument:**
> "The calculator is the wrong first move. The data feeding it is untrustworthy. Make the terms structured, the expenses traceable, and the math visible — in that order. After that, the Smart Settlement Engine is an enhancement, not a re-architecture."

### PRD.md
Concise PRD covering both features: personas, assumptions & scope boundaries, user stories (generic persona format), functional requirements (VRF-01 through VRF-09, ADT-01 through ADT-11), non-functional requirements, edge cases, success metrics, next build (Smart Settlement Engine).

**Success metrics:**
- Post-settlement agent queries: 25% reduction in 90 days
- In-app settlement completion: 18% → 40% at pilot venue
- Pre-show expense coverage: 0% → 75% in 60 days
- Median settlement time: 45 min → 25 min

---

## Key Design Decisions & Reasoning

| Decision | Alternative considered | Why this |
|---|---|---|
| Tesseract.js over Anthropic API | Claude vision API for receipt parsing | OCR is a solved problem; adding managed API = credential dependency with no product benefit |
| Inline expanding form over floating popup | Fixed-position popup | Table context + card overflow:hidden made floating impossible to position reliably |
| Always show recoup/overage fields | Only show when set | A blank is invisible risk; "Not agreed" is a Wednesday task |
| Show-only vendor dropdown | Master pool dropdown in expense rows | Vendor Panel is the entry point; expense table is not a shortcut around it |
| Sub-features over one big feature | Build Vs calculator first | Data layer must exist before math is reliable; sub-features built the rails |
| Worksheet over calculator as 2am artifact | Auto-calculate all deal types | Calculator produces a number; worksheet produces proof. Trust is built by showing work. |

---

## Out of Scope (Identified During Build)

- Vendor onboarding (adding to master pool)
- Email/push notifications to agents or vendors
- Google Sheets export (OAuth required)
- Shareable TM preview link (token auth required)
- Smart Settlement Engine (data layer ready; calculation layer next)
- Bar/POS integration
- Receipt verification (wrong category, wrong show, duplicates, cap mismatch) — Phase 2
- Vs deal calculator (data is clean; 2-3 day build from here)

---

## Commits on `vaidehi/vendor-receipt-flow`

| Commit | What |
|---|---|
| `784401d` | chore: ignore local research files |
| `0ca7eac` | feat: vendor receipt flow with Claude-powered expense parsing |
| `6b8c1ee` | refactor: replace Anthropic API with Tesseract.js + regex |
| `9b9ac7b` | feat: inline vendor assignment in expenses table |
| `01ab75a` | fix: auto-display show vendors + global vendor pool for dropdown |
| `6d76809` | chore: seed test show (Pale Lake, May 22) |
| `619f230` | feat: add recoup_basis field with full backfill |
| `c3148a6` | feat: add hospitality_overage_rule field with full backfill |
| `14a662c` | feat: show recoup/overage on deal terms card |
| `e798db3` | fix: match to Field grid format |
| `d03ace1` | refactor: fold vendors into Artist & agent card |
| `ed12d1d` | feat: move receipt upload to expenses table as camera icon |
| `6c138ed` | feat: redesign settlement page with two-column worksheet |
| `eaaad28` | feat: collapsible expenses + Excel/PDF export |
| `2b83b00` | feat: reorder expense columns + vendor placeholder rows |
| `3a65efd` | refactor: separate vendor block + pre-populated add vendor |
| `3cb2ed4` | feat: restrict vendor additions to future shows only |
| `93ba098` | feat: download deal terms as PDF |
| `a88ec0c` | feat: always show recoup & hospitality overage — explicit when not agreed |
| `4e6c86a` | docs: add MEMO.md and PRD.md |
| `e08a376` | chore: seed 3 test shows (Flat, % of net, Door) |
| `89e3174` | chore: add 10 sample receipts for reviewer testing |
| `746927d` | fix: 4 bugs from E2E testing |
| `dc534c4` | fix: clamp receipt upload popup to viewport |
| `0971a1c` | fix: render receipt upload form inline within cell |
| `56b3f1a` | chore: update db:reset to run full seed pipeline |

---

*Built with Claude Code by Anthropic. Full session shared as bonus material per case study brief.*
