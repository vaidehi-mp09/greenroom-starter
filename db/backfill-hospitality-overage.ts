/**
 * Backfills hospitality_overage_rule on the deals table.
 *
 * Logic (realistic to the venue's actual history):
 *
 * Deals WHERE actual hospitality > cap (107 shows — all silently absorbed):
 *   - Vs deals, high guarantee (≥ $5,000):  small % get 'split'  (bigger acts have leverage to negotiate)
 *   - Vs deals, mid guarantee ($2k–$5k):    'venue_absorbs'
 *   - % of net + door deals with overage:   'venue_absorbs'      (smaller acts, venue eats it)
 *   - A handful of well-documented deals:   'artist_absorbs'     (rare but realistic)
 *
 * Deals WHERE hospitality stayed within cap:
 *   - Cap existed, no overage ever triggered: 'venue_absorbs'   (rule was agreed, never invoked)
 *
 * Deals with no hospitality cap → null (not applicable)
 *
 * Run with: npx tsx db/backfill-hospitality-overage.ts
 */

import { db } from "./index";
import { sql } from "drizzle-orm";

type Rule = "venue_absorbs" | "artist_absorbs" | "split";

interface DealRow {
  id: string;
  show_id: string;
  deal_type: string;
  guarantee_amount: number | null;
  hospitality_cap: number | null;
}

async function backfill() {
  const allDeals = (await db.run(sql`
    SELECT id, show_id, deal_type, guarantee_amount, hospitality_cap
    FROM deals
  `)).rows as unknown as DealRow[];

  // Actual hospitality spend per show
  const hospSpend = (await db.run(sql`
    SELECT show_id, SUM(amount) as total
    FROM expenses
    WHERE category = 'hospitality'
    GROUP BY show_id
  `)).rows as unknown as { show_id: string; total: number }[];

  const hospMap = new Map<string, number>();
  for (const row of hospSpend) hospMap.set(row.show_id, row.total);

  const counts: Record<Rule | "null", number> = {
    venue_absorbs: 0,
    artist_absorbs: 0,
    split: 0,
    null: 0,
  };

  // Deterministic pseudo-random for variety (based on show id hash)
  function stableIndex(id: string, mod: number): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    return hash % mod;
  }

  for (const deal of allDeals) {
    // No hospitality cap → not applicable
    if (!deal.hospitality_cap) {
      counts.null++;
      continue;
    }

    const actual = hospMap.get(deal.show_id) ?? 0;
    const hasOverage = actual > deal.hospitality_cap;
    const guarantee = deal.guarantee_amount ?? 0;

    let rule: Rule;

    if (hasOverage) {
      if (deal.deal_type === "vs" && guarantee >= 5000) {
        // High-value Vs deals — occasional split (bigger acts negotiate)
        // ~20% split, ~5% artist_absorbs, rest venue_absorbs
        const r = stableIndex(deal.id, 20);
        if (r < 4)       rule = "split";
        else if (r === 4) rule = "artist_absorbs";
        else             rule = "venue_absorbs";
      } else if (deal.deal_type === "vs" && guarantee >= 2000) {
        // Mid-tier Vs deals — mostly venue absorbs, rare split
        const r = stableIndex(deal.id, 10);
        rule = r === 0 ? "split" : "venue_absorbs";
      } else {
        // Door / % of net / small guarantees — venue always absorbs
        rule = "venue_absorbs";
      }
    } else {
      // Had a cap, never went over — still needs a rule agreed at booking
      // Almost all venue_absorbs (The Crescent's default position)
      // Small % are split (negotiated by stronger agents)
      const r = stableIndex(deal.id, 15);
      rule = r === 0 ? "split" : "venue_absorbs";
    }

    await db.run(
      sql`UPDATE deals SET hospitality_overage_rule = ${rule} WHERE id = ${deal.id}`
    );
    counts[rule]++;
  }

  const total = allDeals.length;
  console.log("✅ hospitality_overage_rule backfill complete");
  console.log(`   venue_absorbs  : ${counts.venue_absorbs}`);
  console.log(`   split          : ${counts.split}`);
  console.log(`   artist_absorbs : ${counts.artist_absorbs}`);
  console.log(`   null (no cap)  : ${counts.null}`);
  console.log(`   total          : ${total} deals`);

  // Spot checks
  console.log("\nSpot checks (overage shows):");
  const checks = await db.run(sql`
    SELECT d.id, d.deal_type, d.guarantee_amount, d.hospitality_cap,
           d.hospitality_overage_rule,
           COALESCE(e.actual, 0) as actual_hosp
    FROM deals d
    LEFT JOIN (
      SELECT show_id, SUM(amount) as actual FROM expenses
      WHERE category = 'hospitality' GROUP BY show_id
    ) e ON e.show_id = d.show_id
    WHERE d.hospitality_cap IS NOT NULL
    AND COALESCE(e.actual, 0) > d.hospitality_cap
    ORDER BY (COALESCE(e.actual, 0) - d.hospitality_cap) DESC
    LIMIT 8
  `);

  for (const row of checks.rows) {
    const r = row as Record<string, unknown>;
    console.log(
      `   ${r.id} | ${r.deal_type} | g:$${r.guarantee_amount} | cap:$${r.hospitality_cap} | actual:$${r.actual_hosp} | → ${r.hospitality_overage_rule}`
    );
  }
}

backfill().catch(console.error);
