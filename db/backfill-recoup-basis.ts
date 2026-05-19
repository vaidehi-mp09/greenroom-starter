/**
 * Backfills recoup_basis on the deals table using a two-pass approach:
 *
 * Pass 1 — Freetext signals (highest confidence):
 *   "against gross"            → against_gross
 *   "outside (expense) cap"    → outside_cap
 *   "inside (expense) cap"     → inside_cap
 *
 * Pass 2 — Settlement data inference (lower confidence, realistic assumption):
 *   Has marketing recoup in settlement + Vs or % of net deal → outside_cap
 *   Has marketing recoup in settlement + flat / door deal    → inside_cap
 *
 * Deals with no marketing recoup at all → recoup_basis stays NULL
 *
 * Run with: npx tsx db/backfill-recoup-basis.ts
 */

import { db } from "./index";
import { deals, settlements } from "./schema";
import { sql } from "drizzle-orm";

type RecoupBasis = "inside_cap" | "outside_cap" | "against_gross";

interface DealRow {
  id: string;
  dealType: string;
  dealNotesFreetext: string | null;
}

interface SettlementRow {
  showId: string;
  recoupsJson: string | null;
}

function inferFromFreetext(notes: string | null): RecoupBasis | null {
  if (!notes) return null;
  const t = notes.toLowerCase();

  if (/against gross|off the gross|pre.gross|from gross/.test(t))
    return "against_gross";
  if (/outside (the |expense )?cap|outside cap|on top of (the |expense )?cap|in addition to (the |expense )?cap/.test(t))
    return "outside_cap";
  if (/inside (the |expense )?cap|within (the |expense )?cap|part of (the |expense )?cap|included in (the |expense )?cap/.test(t))
    return "inside_cap";

  return null;
}

function hasMarketingRecoup(recoupsJson: string | null): boolean {
  if (!recoupsJson) return false;
  try {
    const arr = JSON.parse(recoupsJson);
    return Array.isArray(arr) && arr.some((r: { category: string }) => r.category === "marketing");
  } catch {
    return false;
  }
}

async function backfill() {
  const allDeals = await db.select().from(deals) as DealRow[];
  const allSettlements = await db.select().from(settlements) as SettlementRow[];

  // Map showId → settlement for quick lookup
  const settlementMap = new Map<string, SettlementRow>();
  for (const s of allSettlements) {
    settlementMap.set(s.showId, s);
  }

  const updates: { id: string; basis: RecoupBasis }[] = [];
  let nullCount = 0;

  for (const deal of allDeals) {
    // Pass 1 — freetext
    const freetextBasis = inferFromFreetext(deal.dealNotesFreetext);
    if (freetextBasis) {
      updates.push({ id: deal.id, basis: freetextBasis });
      continue;
    }

    // Pass 2 — settlement inference
    const showId = deal.id.replace("deal_", "");
    const settlement = settlementMap.get(showId);
    if (settlement && hasMarketingRecoup(settlement.recoupsJson)) {
      const basis: RecoupBasis =
        deal.dealType === "vs" || deal.dealType === "percentage_of_net"
          ? "outside_cap"
          : "inside_cap";
      updates.push({ id: deal.id, basis });
      continue;
    }

    nullCount++;
  }

  // Apply updates in batches
  let updated = 0;
  const counts: Record<RecoupBasis, number> = {
    against_gross: 0,
    outside_cap: 0,
    inside_cap: 0,
  };

  for (const { id, basis } of updates) {
    await db.run(
      sql`UPDATE deals SET recoup_basis = ${basis} WHERE id = ${id}`
    );
    counts[basis]++;
    updated++;
  }

  console.log("✅ recoup_basis backfill complete");
  console.log(`   against_gross : ${counts.against_gross}`);
  console.log(`   outside_cap   : ${counts.outside_cap}`);
  console.log(`   inside_cap    : ${counts.inside_cap}`);
  console.log(`   null (no recoup in this deal): ${nullCount}`);
  console.log(`   total updated : ${updated} / ${allDeals.length} deals`);

  // Spot-check the known deals
  console.log("\nSpot checks:");
  const checks = [
    "deal_show_coastal_spell_dispute",
    "deal_show_0538",
    "deal_show_0011",
    "deal_show_0000",
    "deal_show_0002",
  ];
  for (const id of checks) {
    const row = await db.run(
      sql`SELECT id, deal_type, recoup_basis FROM deals WHERE id = ${id}`
    );
    console.log(`   ${id}: ${JSON.stringify(row.rows[0])}`);
  }
}

backfill().catch(console.error);
