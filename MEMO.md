# Settlement at The Crescent — Product Memo
**Vaidehi Rayate · Applied AI PM Case Study · Greenroom**

---

## The Slice

Settlement is four adjacent problems wearing one name. I considered each:

- **Fallback gap** — no graceful path when the tool can't handle a deal; escape hatch defaults to a spreadsheet
- **TM trust** — tour managers have zero visibility into settlement numbers before they sit down at 2am
- **Deal structure complexity** — ambiguous prose in deal emails that two parties read differently at settlement
- **Vendor receipt flow** — expenses manually chased from five sources the night of the show

I built the vendor receipt flow and addressed deal structure complexity at the data layer. The other two are partially resolved as byproducts and are sequentially next — but they both depend on clean data to be meaningful. A TM preview built on ambiguous deal terms and scattered expenses surfaces the same problems faster. It doesn't fix them.

**My slice: make the data trustworthy before making the math automatic.**

---

## What I Built

**Vendor Receipt Flow.** Vendors are a first-class entity on each show. Mariana registers vendors from The Crescent's pre-onboarded pool. Each vendor gets an expense row immediately — before money is spent — with a camera icon for receipt upload. Tesseract.js OCR parses the receipt, a regex layer extracts the total and category, and the expense is logged automatically. Expenses arrive assembled by show night rather than chased at midnight.

**Structured Deal Terms.** Two new fields on `deals` — `recoup_basis` (`inside_cap / outside_cap / against_gross`) and `hospitality_overage_rule` (`venue_absorbs / artist_absorbs / split`) — backfilled across all 538 deals. Both are always visible on the deal terms card. When null, an amber warning reads *"Not agreed"* rather than a blank. The Coastal Spell $720 dispute was an ambiguous sentence. This field is the fix.

**Settlement Worksheet Redesign.** Every deal type gets a unified two-column worksheet: Agreed (deal terms) left, Actual (show numbers) right. The dead-end warning for unsupported deals is gone. Expenses collapse and expand per-category. Exports to Excel and PDF give Mariana a structured artifact that shows its work rather than presenting a number with no trail.

---

## Why Sub-Features, Not a Big Feature

Each change here took hours, not weeks. Six reasons this was right:

1. **Distributes admin burden** — vendors submit their own receipts. Mariana confirms rather than collects. Removes the human error of retyping numbers at midnight.
2. **Builds toward a predictive state** — vendor-to-expense structure enables future overage alerts, missing receipt nudges, and live expense forecasts for the TM before show night. We built the rails.
3. **Moves toward a two-segment agreement** — deal terms PDF and settlement export are interim solutions for the missing agent confirmation loop. Can be emailed today without new infrastructure.
4. **Right data, wrong place** — the settlement page had everything Mariana needed but spread across screens. Reframing it into one worksheet removes the assembly burden. No new data added — just better access to what was already there.
5. **Dispute avoidance over dispute resolution** — amber warnings on unset fields change the operating posture. The system stops resolving ambiguity at 2am and starts flagging it on Wednesday. TM trust follows.
6. **DB restructure: lowest effort, highest leverage** — adding two enum fields and backfilling 538 deals took hours. It completely changes how the product operates — from ambiguous state to explicit state, from last-minute surprises to proactive callouts.

---

## What I Cut

**AI pre-fill from `notes_freetext`** — right fix for the fallback gap, but the structured schema targets didn't exist yet. Now they do. Two-day build from here.

**Shareable TM preview link** — Diego's exact request. Cut for scope; requires token auth and a read-only settlement view.

**Smart Settlement Engine** — with the worksheet in place, the Booker can reach the correct number with a phone calculator in under a minute. The data it needs is now clean and ready. This is the next build.

**Bar/POS integration** — $10,258 in hospitality overages across 107 shows. The vendor receipt flow covers the manual version of the same outcome.

---

## Assumptions

- Vendor onboarding to the master pool is a separate workflow — out of scope
- Mariana is the only user who registers vendors to a show
- One vendor per expense category per show in the current model
- Past show defined as `show.date < today` — no timezone handling
- Backfilled `recoup_basis` and `hospitality_overage_rule` are reasonable approximations, not verified against original deal emails
- OCR accuracy is sufficient for standard printed or photographed receipts — handwritten or low-quality images fall back to paste-text
- Browser print dialog is acceptable for PDF — no server-side rendering required
- `agents.email` is populated and ready — notification infrastructure is out of scope

---

## How I'd Validate

- **Dispute rate** — 25% reduction in post-settlement agent queries within 90 days
- **Spreadsheet exit rate** — track `settlement.status` progression through in-app lifecycle vs jumping straight to "paid"
- **Time to TM signoff** — timestamps exist in schema; target shift from 45-minute settlements toward 25-minute median

---

## Tying It to the CEO Memo

Pri's mandate: *pick where to start, go deep, be honest about trade-offs.* The settlement experience was failing not because features were missing but because the foundation was wrong — deal terms in prose, expenses scattered, math happening somewhere else. This version makes the terms structured, the expenses traceable, and the math visible. After this, building a smart settlement engine that handles all deal types is an enhancement, not a re-architecture. The craft improvement is real. The product went from a tool bookers tolerate to one they can trust at 2am.
