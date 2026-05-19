/**
 * Seeds a single upcoming test show for May 22, 2026.
 * Status: booked (not yet happened)
 * Artist: Pale Lake (returning act, indie rock, CAA)
 * Deal: Vs deal — $4,200 vs 80% of net after expenses
 * Expenses: none (show hasn't happened yet)
 * Settlement: none
 * Vendors: sound + lights pre-confirmed, others not yet decided
 *
 * Run with: npx tsx db/seed-test-show.ts
 */

import { db } from "./index";
import { shows, deals, vendors } from "./schema";
import { sql } from "drizzle-orm";

const SHOW_ID = "show_0538";
const ARTIST_ID = "art_pale_lake"; // Pale Lake — indie rock, 5 prior shows, CAA

async function seedTestShow() {
  // Clean up if re-running
  await db.run(sql`DELETE FROM deals WHERE show_id = ${SHOW_ID}`);
  await db.run(sql`DELETE FROM vendors WHERE show_id = ${SHOW_ID}`);
  await db.run(sql`DELETE FROM shows WHERE id = ${SHOW_ID}`);

  // ── Show ──────────────────────────────────────────────────────────────────
  await db.insert(shows).values({
    id: SHOW_ID,
    venueId: "venue_crescent",
    artistId: ARTIST_ID,
    date: "2026-05-22",
    status: "booked",
    doorsTime: "19:00",
    setTime: "20:30",
    roomConfig: "standing",
    internalNotes: "Pale Lake return date — last played Feb 2025, sold 487 tickets. Meera (CAA) expects strong walkup. Advance docs due May 15. Monitor hospitality — rider ran over last time.",
    createdAt: new Date(),
  });

  // ── Deal ─────────────────────────────────────────────────────────────────
  await db.insert(deals).values({
    id: `deal_${SHOW_ID}`,
    showId: SHOW_ID,
    dealType: "vs",
    guaranteeAmount: 4200,
    percentage: 0.80,
    percentageBasis: "net",
    expenseCap: 2100,
    hospitalityCap: 500,
    bonusesJson: JSON.stringify([
      {
        type: "gross_threshold",
        label: "+$700 if gross > $18,000",
        threshold: 18000,
        amount: 700,
        stacks: false,
      },
    ]),
    dealNotesFreetext:
      "$4,200 vs 80% of net after expenses, whichever greater. Expenses capped $2,100. Hospitality cap $500. +$700 bonus if gross exceeds $18,000. Marketing recoup of $600 against gross — confirmed outside expense cap per Meera's email 4/28.",
    createdAt: new Date(),
  });

  // ── Vendors — only sound + lights pre-confirmed ───────────────────────────
  await db.insert(vendors).values([
    {
      id: `sv_${SHOW_ID}_sound`,
      showId: SHOW_ID,
      name: "Nashville Sound Co.",
      category: "sound",
      contactName: "Jake Torres",
      contactEmail: "jake@nashvillesound.com",
      createdAt: new Date(),
    },
    {
      id: `sv_${SHOW_ID}_lights`,
      showId: SHOW_ID,
      name: "Music City Lighting",
      category: "lights",
      contactName: "Devon Park",
      contactEmail: "devon@mclighting.com",
      createdAt: new Date(),
    },
  ]);

  console.log("✅ Test show seeded:");
  console.log(`   ID:       ${SHOW_ID}`);
  console.log(`   Artist:   Pale Lake`);
  console.log(`   Date:     May 22, 2026`);
  console.log(`   Status:   booked`);
  console.log(`   Deal:     $4,200 vs 80% net · cap $2,100 · hosp $500`);
  console.log(`   Vendors:  Nashville Sound Co. (sound) · Music City Lighting (lights)`);
  console.log(`   Expenses: none`);
  console.log(`   Settlement: none`);
  console.log(`\n   Open at: http://localhost:3000/shows/${SHOW_ID}`);
}

seedTestShow().catch(console.error);
