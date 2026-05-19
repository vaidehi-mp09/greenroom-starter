# PRD: Settlement Infrastructure — Vendor Receipt Flow & Anomaly-Resistant Deal Terms
**Greenroom · Applied AI PM Case Study · Author: Vaidehi Rayate**
**Status: Prototype · Scope: Single venue (650-cap, indie rock)**

---

## Problem Statement

Greenroom's settlement experience fails at the data layer before it fails at the math layer. 82% of customers default to spreadsheets — not because the arithmetic is hard, but because expenses arrive at midnight from five disconnected sources and deal terms critical to settlement (marketing recoup basis, hospitality overage rule) exist only as prose in a deal email. The result: the Booker spends Wednesday chasing receipts, 2am resolving ambiguities that should have been agreed at booking, and Monday managing disputes that should never have happened.

---

## Personas

**Booker (Primary)** — owns the full artist relationship from booking to payment. Settles 5-7 shows per week. Currently does all settlement math off-platform because the in-app tool can't handle 64% of deals. Primary pain is upstream: assembling data, not doing math.

**Tour Manager (Secondary)** — arrives at settlement with the deal memo and an expected number. Signs off on settlements they don't fully trust because the artist needs to load out. Disputes what they can't verify the next morning via the agent.

**Agent (Tertiary)** — reads the settlement statement the morning after the show. Disputes untraced lines. Routes around venues with settlement issues. Three requirements: itemisation, provenance, tone.

**Vendor (Supporting)** — external service provider (sound, lights, hospitality, etc.) linked to a specific show. Currently has no touchpoint in the system — submits paper receipts or invoices to the Booker manually.

---

## Assumptions & Scope Boundaries

**What we assume is true:**
- The `deal_notes_freetext` field is the source of truth for deal terms — structured fields are often incomplete or stale
- Backfilled `recoup_basis` and `hospitality_overage_rule` values are reasonable approximations based on freetext signals and settlement inference — not verified against original deal emails
- OCR via Tesseract.js is sufficient for standard printed or photographed receipts in English — handwritten or degraded images fall back to the paste-text input
- Browser print dialog is acceptable for PDF generation — no server-side rendering required
- Vendor contact data is populated in the DB — notification delivery infrastructure is not required for this version
- The settlement worksheet is read-only — inline value editing is not required for this version
- Past show is defined as `show.date < today` using server date — timezone handling is not required at single-venue scale
- One primary vendor per expense category per show is sufficient for the current model

**What is out of scope for this version:**
- Vendor onboarding (adding new vendors to the master pool) — separate workflow owned by venue operations
- Booker registering vendors is the only self-service flow — vendors do not self-onboard
- Email or push notifications to agents, vendors, or tour managers
- Google Sheets export — requires OAuth, deferred
- Shareable Tour Manager preview link — requires token-based auth and read-only settlement view
- Smart Settlement Engine (automated calculation for all deal types) — data layer built; calculation layer is the sequentially next build
- Bar/POS integration for hospitality expense auto-capture
- Multi-venue support

---

## User Stories

**Vendor Receipt Flow**

- As a **Booker**, I want to register vendors for an upcoming show from the venue's known vendor pool, so I don't have to track service providers separately
- As a **Booker**, I want to see a placeholder row in the expense table for each registered vendor before expenses are submitted, so I know what receipts are outstanding ahead of show night
- As a **Vendor**, I want to upload a receipt image or paste invoice text against my show, so my expenses are logged without the Booker having to collect them manually
- As a **Booker**, I want the system to parse the receipt and auto-populate the expense category and amount, so I only need to review rather than re-enter
- As a **Booker**, I want vendor additions to be blocked on past shows, so the expense record stays accurate after settlement

**Anomaly-Resistant Deal Terms**

- As a **Booker**, I want to see recoup basis and hospitality overage rule on every deal — even when not agreed — so I know what needs clarifying before show night
- As a **Booker**, I want an amber warning on unset deal term fields, so ambiguous deals surface on Wednesday, not at 2am
- As a **Booker**, I want to download a deal terms PDF to send to the agent at booking, so both parties have the same version of the deal from the start
- As a **Booker**, I want the settlement worksheet to show deal terms alongside actuals for all deal types, so I don't need a spreadsheet to walk the Tour Manager through the math
- As a **Tour Manager**, I want to see each line of the settlement with the agreed term on the left and the actual number on the right, so I can verify without relying on the Booker's verbal summary
- As a **Booker**, I want to export the settlement worksheet to Excel and PDF, so I can send the Agent a traceable statement the morning after the show

---

## Functional Requirements

### Vendor Receipt Flow

| ID | Requirement |
|---|---|
| VRF-01 | System maintains a master vendor pool (show_id = null) with name, category, contact name, and contact email per vendor |
| VRF-02 | Booker registers a vendor to a show by selecting category then vendor from the master pool — no free-text entry permitted |
| VRF-03 | A registered vendor appears as a placeholder expense row with empty amount and upload icon before any receipt is submitted |
| VRF-04 | Upload icon opens an inline form accepting image (jpg/png/webp/gif) or PDF, with a paste-text fallback |
| VRF-05 | Image input is processed via Tesseract.js OCR; PDF input is processed via pdf-parse text extraction |
| VRF-06 | Regex parser identifies: largest labelled total amount, vendor name, category via keyword match, line items |
| VRF-07 | Parsed receipt creates a new expense row linked to the vendor with `receipt_parsed = true`; confirmed by green checkmark in the upload column |
| VRF-08 | Vendor additions are rejected server-side if `show.date < today`; UI additionally hides the add vendor control on past shows |
| VRF-09 | Expense rows without a linked vendor show an inline dropdown filtered to master vendors of matching category |

### Anomaly-Resistant Deal Terms

| ID | Requirement |
|---|---|
| ADT-01 | `deals` table has `recoup_basis` enum: `inside_cap / outside_cap / against_gross / null` |
| ADT-02 | `deals` table has `hospitality_overage_rule` enum: `venue_absorbs / artist_absorbs / split / null` |
| ADT-03 | Both fields always render on the deal terms card — amber indicator reading "Not agreed" when null |
| ADT-04 | Settlement worksheet always shows a Marketing recoup row — amber "Not agreed — clarify with agent" in the Agreed column when `recoup_basis` is null |
| ADT-05 | Settlement worksheet always shows a Hospitality overage rule row — same amber pattern when null |
| ADT-06 | Deal terms PDF includes both fields in every export — amber warning text when null |
| ADT-07 | Settlement worksheet renders Agreed vs Actual two-column layout for all deal types — no unsupported deal dead-end state |
| ADT-08 | Expense rows collapse to a single summary row with item count; click expands per-category breakdown inline |
| ADT-09 | Settlement page exports to Excel (.xlsx) via SheetJS with all expense line items expanded regardless of collapsed UI state |
| ADT-10 | Settlement page exports to PDF via `window.print()` with print CSS hiding navigation and export controls |
| ADT-11 | Google Sheets export button is present and disabled with a tooltip explaining OAuth requirement |

---

## Non-Functional Requirements

| Area | Requirement |
|---|---|
| **Performance** | OCR processing completes within 10 seconds for standard receipt images under normal server load |
| **Fallback** | If OCR or PDF parsing returns no usable text, surface the paste-text input with a clear, actionable error message |
| **Security** | Past show lockout is enforced server-side — UI control is supplementary, not the sole protection |
| **Data integrity** | `recoup_basis` and `hospitality_overage_rule` always render on deal terms — never silently omitted regardless of null state |
| **Compatibility** | Excel export verified in Microsoft Excel and Google Sheets; PDF tested in Chrome and Safari print dialogs |
| **Accuracy** | Receipt parser identifies the correct total amount for standard invoice formats; ambiguous cases fall back to manual paste without auto-population |

---

## Edge Cases & Error States

| Scenario | Handling |
|---|---|
| OCR returns empty text | Error: "No readable text found. Try pasting the receipt text instead." |
| OCR finds no dollar amount | Error: "Could not find a total. Try pasting the text manually." |
| Category has no master vendors | Dropdown shows "No vendors for this category" — prompts Booker to contact venue operations for onboarding |
| Vendor already registered for a category | Category option disabled in add vendor form with "(already added)" label |
| Receipt uploaded to placeholder row (no existing expense) | New expense created with vendor linked; placeholder row replaced by real expense row on page refresh |
| Settlement has marketing recoups but `recoup_basis` is null | Worksheet shows actual recoup amount in red alongside amber "Not agreed" in the Agreed column |
| Hospitality spend exceeds cap | Expense row shows overage in amber below the category total; cap applied note visible in expanded view |
| Vendor addition attempted on past show via direct API call | Server action returns error: "Vendors cannot be added to a past show" |

---

## Success Metrics

| Metric | Baseline | Target | Timeframe | Source |
|---|---|---|---|---|
| Post-settlement agent queries | ~40% of settlements (Booker estimate) | 25% reduction | 90 days | Tracked via email thread volume per settlement |
| In-app settlement lifecycle completion | 18% (Greenroom-wide) | 40% at pilot venue | 90 days | `settlement.status` progression vs direct jump to `paid` |
| Pre-show expense coverage via vendor receipts | ~0% (all collected night-of) | 75% of expenses submitted pre-show day | 60 days | `receipt_parsed = true` rows as % of total expenses per show |
| Median settlement time | 45 min (complex deals) | 25 min | 60 days | `signed_at - show.set_time` per settlement record |

*Note on pre-show coverage: with sound and lights typically pre-confirmed (2 of 5-6 categories) and production, hospitality, and marketing vendors submitting during the show week, 75% is achievable within two months of vendor adoption. The data infrastructure to measure this is live in the schema.*

---

## Next: Smart Settlement Engine

The data layer is now ready. `recoup_basis`, `hospitality_overage_rule`, and per-vendor expense traceability give the calculation engine reliable, structured inputs for the first time. The next build extends `calculateSettlement` to handle all deal types currently settled off-platform — percentage of net, vs deals (including walkout pots and tier ratchets), and door deals — using the structured fields now in place. This is an enhancement to existing infrastructure, not a re-architecture.
