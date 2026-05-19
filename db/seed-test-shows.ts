/**
 * Seeds 3 upcoming test shows with different deal types for reviewer testing.
 * All shows are future-dated, status: booked, no expenses, partial vendor assignments.
 *
 * show_0539 — Flat deal        · Hollow Branch     · May 29, 2026
 * show_0540 — Percentage of net · Telegraph Avenue  · June 5, 2026
 * show_0541 — Door deal        · Glass Bottle      · June 12, 2026
 *
 * Run with: npx tsx db/seed-test-shows.ts
 */

import { db } from "./index";
import { shows, deals, vendors } from "./schema";
import { sql } from "drizzle-orm";

const TEST_SHOWS = [
  {
    // ── Flat deal — simple returning act, buyout, no upside ──────────────────
    showId:   "show_0539",
    artistId: "art_hollow_branch",   // Hollow Branch, post rock, 5 prior shows
    date:     "2026-05-29",
    doorsTime: "19:30",
    setTime:   "21:00",
    internalNotes:
      "Hollow Branch return — sold 410 last time. Flat buyout, no backend. " +
      "Rosa (Wasserman) prefers wire by Tuesday. Watch hospitality — band has a " +
      "large rider and ran $80 over cap on their Feb show.",
    deal: {
      id:              "deal_show_0539",
      dealType:        "flat" as const,
      guaranteeAmount: 2800,
      percentage:      null,
      percentageBasis: null,
      expenseCap:      null,
      hospitalityCap:  500,
      bonusesJson:     JSON.stringify([
        { type: "sellout", label: "+$400 on sellout", amount: 400 },
      ]),
      dealNotesFreetext:
        "Flat $2,800. No backend. Hospitality cap $500. +$400 on sellout (≥95% capacity). " +
        "Wire by Tuesday per Rosa's standard.",
      recoupBasis:             null,   // no marketing recoup on flat deals
      hospitalityOverageRule:  "venue_absorbs" as const,
    },
    vendors: [
      { masterId: "mv_sound_1",  category: "sound" as const },
      { masterId: "mv_prod_1",   category: "production" as const },
      { masterId: "mv_hosp_1",   category: "hospitality" as const },
    ],
  },

  {
    // ── Percentage of net — soul act, no guarantee, pure upside ─────────────
    showId:   "show_0540",
    artistId: "art_telegraph_avenue",  // Telegraph Avenue, soul, 4 prior shows
    date:     "2026-06-05",
    doorsTime: "20:00",
    setTime:   "21:30",
    internalNotes:
      "Telegraph Avenue — first time at this capacity for them. Danny (CAA) pushed " +
      "for a guarantee but we held the line on pure % deal given the risk. " +
      "Strong presale tracking — 280 tickets as of booking. Marketing recoup " +
      "of $450 against gross discussed but basis not confirmed in writing.",
    deal: {
      id:              "deal_show_0540",
      dealType:        "percentage_of_net" as const,
      guaranteeAmount: null,
      percentage:      0.85,
      percentageBasis: "net" as const,
      expenseCap:      1400,
      hospitalityCap:  400,
      bonusesJson:     JSON.stringify([
        {
          type:      "gross_threshold",
          label:     "+$500 if gross > $14,000",
          threshold: 14000,
          amount:    500,
          stacks:    false,
        },
      ]),
      dealNotesFreetext:
        "85% of net after expenses. Expenses capped $1,400. Hospitality cap $400. " +
        "+$500 if gross exceeds $14,000. No guarantee. Marketing recoup of $450 " +
        "discussed — basis (inside vs outside cap) not confirmed in deal email. " +
        "Clarify with Danny before show week.",
      recoupBasis:             null,   // intentionally unset — surfaces amber warning
      hospitalityOverageRule:  "split" as const,
    },
    vendors: [
      { masterId: "mv_sound_2",  category: "sound" as const },
      { masterId: "mv_lights_1", category: "lights" as const },
      { masterId: "mv_mkt_1",    category: "marketing" as const },
    ],
  },

  {
    // ── Door deal — DIY/indie folk, all upside to artist, venue takes expenses ─
    showId:   "show_0541",
    artistId: "art_glass_bottle",  // Glass Bottle, indie folk, 4 prior shows
    date:     "2026-06-12",
    doorsTime: "19:00",
    setTime:   "20:30",
    internalNotes:
      "Glass Bottle self-managed tour. Jordan handles everything. " +
      "Door deal — low production ask, BYO backline, hospitality minimal. " +
      "Good word-of-mouth draw. No advance received yet — due May 30.",
    deal: {
      id:              "deal_show_0541",
      dealType:        "door" as const,
      guaranteeAmount: null,
      percentage:      null,
      percentageBasis: null,
      expenseCap:      600,
      hospitalityCap:  200,
      bonusesJson:     null,
      dealNotesFreetext:
        "Door deal. Artist receives gross ticket revenue minus capped expenses ($600). " +
        "Hospitality capped $200 — venue absorbs any overage given low rider. " +
        "No guarantee, no backend percentage. Self-managed — Jordan Wells is both " +
        "agent and day-of contact.",
      recoupBasis:             null,   // no marketing recoup on door deals
      hospitalityOverageRule:  "venue_absorbs" as const,
    },
    vendors: [
      { masterId: "mv_sound_3",  category: "sound" as const },
      { masterId: "mv_hosp_3",   category: "hospitality" as const },
    ],
  },
];

// Master vendor lookup — must match IDs seeded in seed-vendors.ts
const MASTER_LOOKUP: Record<string, { name: string; category: string; contactName: string; contactEmail: string }> = {
  mv_sound_1:  { name: "Nashville Sound Co.",      category: "sound",       contactName: "Jake Torres",   contactEmail: "jake@nashvillesound.com" },
  mv_sound_2:  { name: "SoundWave Productions",    category: "sound",       contactName: "Carla Meeks",   contactEmail: "carla@soundwavepro.com" },
  mv_sound_3:  { name: "Music Row Audio",          category: "sound",       contactName: "DeShawn Ellis", contactEmail: "deshawn@musicrowaudionash.com" },
  mv_lights_1: { name: "Music City Lighting",      category: "lights",      contactName: "Devon Park",    contactEmail: "devon@mclighting.com" },
  mv_prod_1:   { name: "Third Coast Production",   category: "production",  contactName: "Marcus Webb",   contactEmail: "marcus@thirdcoastprod.com" },
  mv_hosp_1:   { name: "Green Room Catering",      category: "hospitality", contactName: "Sofia Reyes",   contactEmail: "sofia@greenroomcatering.com" },
  mv_hosp_3:   { name: "Backstage Provisions",     category: "hospitality", contactName: "Dana Kim",      contactEmail: "dana@backstageprovisions.com" },
  mv_mkt_1:    { name: "Broad Street Media",       category: "marketing",   contactName: "Jess Holloway", contactEmail: "jess@broadstmedia.com" },
};

async function seedTestShows() {
  for (const s of TEST_SHOWS) {
    // Clean up if re-running
    await db.run(sql`DELETE FROM vendors WHERE show_id = ${s.showId}`);
    await db.run(sql`DELETE FROM deals WHERE show_id = ${s.showId}`);
    await db.run(sql`DELETE FROM shows WHERE id = ${s.showId}`);

    // Show
    await db.insert(shows).values({
      id:           s.showId,
      venueId:      "venue_crescent",
      artistId:     s.artistId,
      date:         s.date,
      status:       "booked",
      doorsTime:    s.doorsTime,
      setTime:      s.setTime,
      roomConfig:   "standing",
      internalNotes: s.internalNotes,
      createdAt:    new Date(),
    });

    // Deal
    await db.insert(deals).values({
      id:                    s.deal.id,
      showId:                s.showId,
      dealType:              s.deal.dealType,
      guaranteeAmount:       s.deal.guaranteeAmount,
      percentage:            s.deal.percentage,
      percentageBasis:       s.deal.percentageBasis,
      expenseCap:            s.deal.expenseCap,
      hospitalityCap:        s.deal.hospitalityCap,
      bonusesJson:           s.deal.bonusesJson,
      dealNotesFreetext:     s.deal.dealNotesFreetext,
      recoupBasis:           s.deal.recoupBasis,
      hospitalityOverageRule: s.deal.hospitalityOverageRule,
      createdAt:             new Date(),
    });

    // Vendors
    for (const v of s.vendors) {
      const master = MASTER_LOOKUP[v.masterId];
      if (!master) { console.warn(`  ⚠ Unknown master vendor: ${v.masterId}`); continue; }
      await db.insert(vendors).values({
        id:           `sv_${s.showId}_${v.category}`,
        showId:       s.showId,
        name:         master.name,
        category:     v.category,
        contactName:  master.contactName,
        contactEmail: master.contactEmail,
        createdAt:    new Date(),
      });
    }

    console.log(`✅ ${s.showId} · ${s.deal.dealType.padEnd(18)} · ${s.date} · vendors: ${s.vendors.map(v => v.category).join(", ")}`);
  }

  console.log("\nOpen in browser:");
  TEST_SHOWS.forEach(s =>
    console.log(`  http://localhost:3000/shows/${s.showId}`)
  );
}

seedTestShows().catch(console.error);
