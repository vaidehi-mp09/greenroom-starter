/**
 * Vendor seed script.
 *
 * Seeds two things:
 *   1. Master vendors (show_id = null) — pre-onboarded vendors The Crescent
 *      has worked with in the past. 3-5 per category. These appear in the
 *      "Add vendor" dropdown on any show.
 *   2. Show-specific assignments — links a master vendor to a recent show,
 *      representing vendors already confirmed for that event.
 *
 * Run with: npx tsx db/seed-vendors.ts
 */

import { db } from "./index";
import { vendors } from "./schema";
import { sql } from "drizzle-orm";

// ── Master vendor pool ──────────────────────────────────────────────────────

const MASTER_VENDORS = [
  // Sound (5)
  { id: "mv_sound_1", category: "sound",       name: "Nashville Sound Co.",       contactName: "Jake Torres",     contactEmail: "jake@nashvillesound.com" },
  { id: "mv_sound_2", category: "sound",       name: "SoundWave Productions",     contactName: "Carla Meeks",     contactEmail: "carla@soundwavepro.com" },
  { id: "mv_sound_3", category: "sound",       name: "Music Row Audio",           contactName: "DeShawn Ellis",   contactEmail: "deshawn@musicrowaudionash.com" },
  { id: "mv_sound_4", category: "sound",       name: "Clear Signal Sound",        contactName: "Jen Morrow",      contactEmail: "jen@clearsignalsound.com" },
  { id: "mv_sound_5", category: "sound",       name: "Stage Left Audio",          contactName: "Paul Nakamura",   contactEmail: "paul@stageleftaudio.com" },

  // Lights (4)
  { id: "mv_lights_1", category: "lights",     name: "Music City Lighting",       contactName: "Devon Park",      contactEmail: "devon@mclighting.com" },
  { id: "mv_lights_2", category: "lights",     name: "Stagecraft Illumination",   contactName: "Priya Anand",     contactEmail: "priya@stagecraftlight.com" },
  { id: "mv_lights_3", category: "lights",     name: "Neon & Flood Co.",          contactName: "Tyler Briggs",    contactEmail: "tyler@neonflood.com" },
  { id: "mv_lights_4", category: "lights",     name: "Luminary Event Lighting",   contactName: "Rosa Castillo",   contactEmail: "rosa@luminaryevents.com" },

  // Production (4)
  { id: "mv_prod_1",  category: "production",  name: "Third Coast Production",    contactName: "Marcus Webb",     contactEmail: "marcus@thirdcoastprod.com" },
  { id: "mv_prod_2",  category: "production",  name: "Crescent Stage Crew",       contactName: "Amy Liu",         contactEmail: "amy@crescentcrew.com" },
  { id: "mv_prod_3",  category: "production",  name: "Load In Nashville",         contactName: "Greg Okafor",     contactEmail: "greg@loadinnashville.com" },
  { id: "mv_prod_4",  category: "production",  name: "Backbone Staging",          contactName: "Fiona Chen",      contactEmail: "fiona@backbonestaging.com" },

  // Hospitality (5)
  { id: "mv_hosp_1",  category: "hospitality", name: "Green Room Catering",       contactName: "Sofia Reyes",     contactEmail: "sofia@greenroomcatering.com" },
  { id: "mv_hosp_2",  category: "hospitality", name: "The Rider Co.",             contactName: "Tom Nash",        contactEmail: "tom@theriderco.com" },
  { id: "mv_hosp_3",  category: "hospitality", name: "Backstage Provisions",      contactName: "Dana Kim",        contactEmail: "dana@backstageprovisions.com" },
  { id: "mv_hosp_4",  category: "hospitality", name: "Artist Eats Nashville",     contactName: "Leo Vance",       contactEmail: "leo@artisteats.com" },
  { id: "mv_hosp_5",  category: "hospitality", name: "The Green Rider",           contactName: "Nadia Patel",     contactEmail: "nadia@thegreenrider.com" },

  // Marketing (4)
  { id: "mv_mkt_1",   category: "marketing",   name: "Broad Street Media",        contactName: "Jess Holloway",   contactEmail: "jess@broadstmedia.com" },
  { id: "mv_mkt_2",   category: "marketing",   name: "Indie Poster House",        contactName: "Ravi Mehta",      contactEmail: "ravi@indieposter.com" },
  { id: "mv_mkt_3",   category: "marketing",   name: "Sound & Vision Digital",    contactName: "Cam Torres",      contactEmail: "cam@svdigital.com" },
  { id: "mv_mkt_4",   category: "marketing",   name: "The Promo Room",            contactName: "Aisha Grant",     contactEmail: "aisha@thepromoroom.com" },

  // Backline (3)
  { id: "mv_back_1",  category: "backline",    name: "Music Row Backline",        contactName: "Chris Ola",       contactEmail: "chris@musicrowbackline.com" },
  { id: "mv_back_2",  category: "backline",    name: "Amp & Axe Rentals",         contactName: "Sam Whitfield",   contactEmail: "sam@ampandaxe.com" },
  { id: "mv_back_3",  category: "backline",    name: "Tennessee Backline Co.",    contactName: "Bridget Moon",    contactEmail: "bridget@tnbackline.com" },

  // Security (3)
  { id: "mv_sec_1",   category: "security",    name: "Frontline Event Security",  contactName: "Dana Scott",      contactEmail: "dana@frontlinesecurity.com" },
  { id: "mv_sec_2",   category: "security",    name: "Shield Nashville",          contactName: "Marcus Bell",     contactEmail: "marcus@shieldnashville.com" },
  { id: "mv_sec_3",   category: "security",    name: "Vanguard Crowd Control",    contactName: "Tanya Forbes",    contactEmail: "tanya@vanguardcc.com" },

  // Other (3)
  { id: "mv_other_1", category: "other",       name: "Crescent General Services", contactName: "Will Harte",      contactEmail: "will@crescentservices.com" },
  { id: "mv_other_2", category: "other",       name: "Nashville Venue Supply",    contactName: "Grace Monroe",    contactEmail: "grace@nvs.com" },
  { id: "mv_other_3", category: "other",       name: "The House Account",         contactName: "Ben Carr",        contactEmail: "ben@thehouseaccount.com" },
] as const;

// ── Show-specific assignments (confirmed vendors for recent shows) ───────────

const SHOW_ASSIGNMENTS = [
  // Hospital Corners - show_0264
  { showId: "show_0264", masterId: "mv_sound_1"  },
  { showId: "show_0264", masterId: "mv_lights_1" },
  { showId: "show_0264", masterId: "mv_prod_1"   },
  { showId: "show_0264", masterId: "mv_hosp_1"   },
  { showId: "show_0264", masterId: "mv_mkt_1"    },
  { showId: "show_0264", masterId: "mv_back_1"   },

  // Lake Effect - show_0005
  { showId: "show_0005", masterId: "mv_sound_2"  },
  { showId: "show_0005", masterId: "mv_lights_2" },
  { showId: "show_0005", masterId: "mv_prod_2"   },
  { showId: "show_0005", masterId: "mv_hosp_2"   },
  { showId: "show_0005", masterId: "mv_mkt_2"    },
  { showId: "show_0005", masterId: "mv_back_2"   },

  // The Quiet Houses - show_0375
  { showId: "show_0375", masterId: "mv_sound_3"  },
  { showId: "show_0375", masterId: "mv_lights_3" },
  { showId: "show_0375", masterId: "mv_prod_3"   },
  { showId: "show_0375", masterId: "mv_hosp_3"   },
  { showId: "show_0375", masterId: "mv_mkt_3"    },

  // Sunday Drivers - show_0426 (has security)
  { showId: "show_0426", masterId: "mv_sound_1"  },
  { showId: "show_0426", masterId: "mv_lights_4" },
  { showId: "show_0426", masterId: "mv_prod_4"   },
  { showId: "show_0426", masterId: "mv_hosp_4"   },
  { showId: "show_0426", masterId: "mv_mkt_4"    },
  { showId: "show_0426", masterId: "mv_back_3"   },
  { showId: "show_0426", masterId: "mv_sec_1"    },
] as const;

async function seedVendors() {
  // Clear existing vendor entries
  await db.run(sql`DELETE FROM vendors`);
  console.log("🗑️  Cleared existing vendors");

  // Insert master vendors (show_id = null)
  const masterRows: typeof vendors.$inferInsert[] = MASTER_VENDORS.map((v) => ({
    id: v.id,
    showId: null,
    name: v.name,
    category: v.category,
    contactName: v.contactName,
    contactEmail: v.contactEmail,
    createdAt: new Date(),
  }));

  await db.insert(vendors).values(masterRows);
  console.log(`✅ Seeded ${masterRows.length} master vendors (global pool)`);

  // Insert show-specific assignments
  const showRows: typeof vendors.$inferInsert[] = SHOW_ASSIGNMENTS.map((a) => {
    const master = MASTER_VENDORS.find((v) => v.id === a.masterId)!;
    return {
      id: `sv_${a.showId}_${a.masterId}`,
      showId: a.showId,
      name: master.name,
      category: master.category,
      contactName: master.contactName,
      contactEmail: master.contactEmail,
      createdAt: new Date(),
    };
  });

  await db.insert(vendors).values(showRows);
  console.log(`✅ Seeded ${showRows.length} show-specific vendor assignments`);
  console.log("\nShow assignments:");
  SHOW_ASSIGNMENTS.forEach((a) => {
    const master = MASTER_VENDORS.find((v) => v.id === a.masterId)!;
    console.log(`   ${a.showId} · ${master.category} · ${master.name}`);
  });
}

seedVendors().catch(console.error);
