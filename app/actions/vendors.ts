"use server";

import { db } from "@/db";
import { vendors, expenses } from "@/db/schema";
import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Add a vendor to a show ──────────────────────────────────────────────────

export async function addVendor(formData: FormData) {
  const showId = formData.get("showId") as string;
  const name = formData.get("name") as string;
  const category = formData.get("category") as string;
  const contactName = formData.get("contactName") as string | null;
  const contactEmail = formData.get("contactEmail") as string | null;

  if (!showId || !name || !category) {
    return { error: "Missing required fields" };
  }

  const id = `vendor_${showId}_${Date.now()}`;

  await db.insert(vendors).values({
    id,
    showId,
    name,
    category: category as typeof vendors.$inferInsert["category"],
    contactName: contactName || null,
    contactEmail: contactEmail || null,
    createdAt: new Date(),
  });

  revalidatePath(`/shows/${showId}`);
  return { success: true, vendorId: id };
}

// ── Parse receipt with Anthropic API and create expense ────────────────────

export async function parseReceiptAndCreateExpense(formData: FormData) {
  const showId = formData.get("showId") as string;
  const vendorId = formData.get("vendorId") as string;
  const receiptText = formData.get("receiptText") as string | null;
  const receiptBase64 = formData.get("receiptBase64") as string | null;
  const rawMediaType = (formData.get("mediaType") as string | null) ?? "image/jpeg";
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
  type AllowedMediaType = typeof allowedTypes[number];
  const mediaType: AllowedMediaType = (allowedTypes as readonly string[]).includes(rawMediaType)
    ? (rawMediaType as AllowedMediaType)
    : "image/jpeg";

  if (!showId || !vendorId) {
    return { error: "Missing showId or vendorId" };
  }
  if (!receiptText && !receiptBase64) {
    return { error: "Provide either receipt text or an image" };
  }

  // Build message content for Claude
  type ContentBlock =
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: AllowedMediaType; data: string } };

  const content: ContentBlock[] = [];

  if (receiptBase64) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType,
        data: receiptBase64,
      },
    });
  }

  const promptText = receiptText
    ? `Here is the receipt text:\n\n${receiptText}\n\n`
    : "";

  content.push({
    type: "text",
    text: `${promptText}You are parsing a vendor receipt for a live music venue called The Crescent.

Extract the following information and respond with ONLY a valid JSON object — no markdown, no explanation:

{
  "vendor_name": "string — the vendor or company name on the receipt",
  "total_amount": number — the total amount to be charged (numeric, no $ sign),
  "description": "string — a brief one-line description of what was purchased",
  "category": "one of: production | sound | lights | hospitality | marketing | backline | security | other",
  "line_items": [{ "description": "string", "amount": number }]
}

If any field cannot be determined, use null. Always return valid JSON.`,
  });

  let parsed: {
    vendor_name: string | null;
    total_amount: number | null;
    description: string | null;
    category: string | null;
    line_items: { description: string; amount: number }[] | null;
  };

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    // Strip markdown code fences if present
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("Anthropic parse error:", err);
    return { error: "Failed to parse receipt. Please check your API key or try again." };
  }

  // Validate we got an amount
  if (!parsed.total_amount || parsed.total_amount <= 0) {
    return { error: "Could not extract a valid amount from the receipt." };
  }

  const validCategories = [
    "production", "sound", "lights", "hospitality",
    "marketing", "backline", "security", "other",
  ];
  const category = validCategories.includes(parsed.category ?? "")
    ? (parsed.category as typeof expenses.$inferInsert["category"])
    : "other";

  const expenseId = `exp_receipt_${showId}_${Date.now()}`;

  await db.insert(expenses).values({
    id: expenseId,
    showId,
    vendorId,
    category,
    amount: parsed.total_amount,
    description: parsed.description ?? parsed.vendor_name ?? "Receipt upload",
    approved: true,
    absorbedByVenue: false,
    receiptRaw: receiptText ?? `[image:${mediaType}]`,
    receiptParsed: true,
    enteredAt: new Date(),
  });

  revalidatePath(`/shows/${showId}`);

  return {
    success: true,
    expense: {
      id: expenseId,
      amount: parsed.total_amount,
      description: parsed.description,
      category,
      vendor_name: parsed.vendor_name,
      line_items: parsed.line_items,
    },
  };
}
