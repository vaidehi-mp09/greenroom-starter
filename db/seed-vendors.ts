/**
 * Vendor seed script.
 * Seeds a pool of realistic Nashville-area vendors into the vendors table,
 * linked to recent shows. Each vendor matches the expense categories already
 * present on those shows so the data feels coherent.
 *
 * Run with: npx tsx db/seed-vendors.ts
 */

import { db } from "./index";
import { vendors } from "./schema";

const VENDOR_POOL = [
  // Sound
  { name: "Nashville Sound Co.",       category: "sound",       contactName: "Jake Torres",    contactEmail: "jake@nashvillesound.com" },
  { name: "SoundWave Productions",     category: "sound",       contactName: "Carla Meeks",    contactEmail: "carla@soundwavepro.com" },
  // Lights
  { name: "Music City Lighting",       category: "lights",      contactName: "Devon Park",     contactEmail: "devon@mclighting.com" },
  { name: "Stagecraft Illumination",   category: "lights",      contactName: "Priya Anand",    contactEmail: "priya@stagecraftlight.com" },
  // Production
  { name: "Third Coast Production",    category: "production",  contactName: "Marcus Webb",    contactEmail: "marcus@thirdcoastprod.com" },
  { name: "Crescent Stage Crew",       category: "production",  contactName: "Amy Liu",        contactEmail: "amy@crescentcrew.com" },
  // Hospitality
  { name: "Green Room Catering",       category: "hospitality", contactName: "Sofia Reyes",    contactEmail: "sofia@greenroomcatering.com" },
  { name: "The Rider Co.",             category: "hospitality", contactName: "Tom Nash",       contactEmail: "tom@theriderco.com" },
  // Marketing
  { name: "Broad Street Media",        category: "marketing",   contactName: "Jess Holloway",  contactEmail: "jess@broadstmedia.com" },
  { name: "Indie Poster House",        category: "marketing",   contactName: "Ravi Mehta",     contactEmail: "ravi@indieposter.com" },
  // Backline
  { name: "Music Row Backline",        category: "backline",    contactName: "Chris Ola",      contactEmail: "chris@musicrowbackline.com" },
  // Security
  { name: "Frontline Event Security",  category: "security",    contactName: "Dana Scott",     contactEmail: "dana@frontlinesecurity.com" },
] as const;

// Recent shows to attach vendors to
const TARGET_SHOWS: { showId: string; categories: string[] }[] = [
  { showId: "show_0264", categories: ["sound","lights","production","hospitality","marketing","backline"] },
  { showId: "show_0005", categories: ["sound","lights","production","hospitality","marketing","backline"] },
  { showId: "show_0375", categories: ["sound","lights","production","hospitality","marketing"] },
  { showId: "show_0426", categories: ["sound","lights","production","hospitality","marketing","backline","security"] },
  { showId: "show_0060", categories: ["sound","lights","production","hospitality","marketing","backline"] },
  { showId: "show_0008", categories: ["sound","lights","production","hospitality","marketing","backline"] },
  { showId: "show_0114", categories: ["sound","lights","production","hospitality","marketing","backline"] },
  { showId: "show_0082", categories: ["sound","lights","production","hospitality","marketing"] },
  { showId: "show_0423", categories: ["sound","lights","production","hospitality","marketing"] },
  { showId: "show_0303", categories: ["sound","lights","production","hospitality","security"] },
];

// Pick one vendor per category per show — rotate through the pool
const categoryIndex: Record<string, number> = {};

async function seedVendors() {
  const rows: typeof vendors.$inferInsert[] = [];

  for (const show of TARGET_SHOWS) {
    for (const category of show.categories) {
      // Find all vendors in this category
      const pool = VENDOR_POOL.filter((v) => v.category === category);
      if (pool.length === 0) continue;

      // Rotate so different shows get different vendors
      const idx = (categoryIndex[category] ?? 0) % pool.length;
      categoryIndex[category] = idx + 1;
      const vendor = pool[idx];

      rows.push({
        id: `vendor_${show.showId}_${category}`,
        showId: show.showId,
        name: vendor.name,
        category: vendor.category,
        contactName: vendor.contactName,
        contactEmail: vendor.contactEmail,
        createdAt: new Date(),
      });
    }
  }

  await db.insert(vendors).values(rows);
  console.log(`✅ Seeded ${rows.length} vendors across ${TARGET_SHOWS.length} shows`);
  rows.forEach((r) => console.log(`   ${r.showId} · ${r.category} · ${r.name}`));
}

seedVendors().catch(console.error);
