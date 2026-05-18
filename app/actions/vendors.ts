"use server";

import { db } from "@/db";
import { vendors, expenses } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { createWorker } from "tesseract.js";
// pdf-parse is CJS only — use require to avoid ESM default-export mismatch
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;

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

// ── OCR: extract text from image using Tesseract.js ────────────────────────

async function ocrImage(base64: string): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(buffer);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

// ── Extract text from PDF ───────────────────────────────────────────────────

async function extractPdfText(base64: string): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  const result = await pdfParse(buffer);
  return result.text as string;
}

// ── Parse extracted text into structured expense fields ────────────────────

type ParsedReceipt = {
  vendor_name: string | null;
  total_amount: number | null;
  description: string | null;
  category: string;
  line_items: { description: string; amount: number }[];
};

function parseReceiptText(raw: string): ParsedReceipt {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Vendor name — first non-trivial line
  const vendor_name = lines.find((l) => l.length > 2) ?? null;

  // All dollar amounts in the text
  const amountRegex = /\$?\s*(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/g;
  const allAmounts: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = amountRegex.exec(raw)) !== null) {
    const val = parseFloat(m[1].replace(/,/g, ""));
    if (val > 0) allAmounts.push(val);
  }

  // Prefer a line explicitly labelled "total / amount due / balance"
  let total_amount: number | null = null;
  const totalLine = lines.find((l) =>
    /\b(total|amount due|balance due|grand total|subtotal)\b/i.test(l)
  );
  if (totalLine) {
    const tm = totalLine.match(/\$?\s*(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/);
    if (tm) total_amount = parseFloat(tm[1].replace(/,/g, ""));
  }
  // Fallback: largest amount found
  if (!total_amount && allAmounts.length > 0) {
    total_amount = Math.max(...allAmounts);
  }

  // Category: keyword matching
  const t = raw.toLowerCase();
  let category = "other";
  if (/\b(sound|audio|pa system|speaker|microphone|mic|mixing|monitor)\b/.test(t))
    category = "sound";
  else if (/\b(light|lighting|led|spotlight|fixture|truss|rigging)\b/.test(t))
    category = "lights";
  else if (
    /\b(food|beverage|catering|hospitality|rider|alcohol|beer|wine|spirits|water|snack)\b/.test(t)
  )
    category = "hospitality";
  else if (
    /\b(marketing|advertising|instagram|facebook|google|promotion|poster|flyer|digital ad)\b/.test(t)
  )
    category = "marketing";
  else if (
    /\b(backline|guitar|amp|amplifier|drum|keyboard|instrument|bass)\b/.test(t)
  )
    category = "backline";
  else if (/\b(security|guard|bouncer|door staff)\b/.test(t))
    category = "security";
  else if (/\b(production|stage|crew|stagehand|load.?in|load.?out)\b/.test(t))
    category = "production";

  // Line items: lines that contain a dollar amount
  const lineItemRegex = /\$?\s*(\d{1,6}(?:,\d{3})*\.\d{2})/;
  const line_items = lines
    .filter((l) => lineItemRegex.test(l))
    .map((l) => {
      const am = l.match(lineItemRegex);
      const amount = am ? parseFloat(am[1].replace(/,/g, "")) : 0;
      const description = l.replace(lineItemRegex, "").replace(/\$/g, "").trim();
      return { description, amount };
    })
    .filter((item) => item.amount > 0 && item.description.length > 1);

  // Short description: first 3 lines joined
  const description = lines.slice(0, 3).join(" ").substring(0, 120);

  return { vendor_name, total_amount, description, category, line_items };
}

// ── Main action: upload receipt → parse → write expense ────────────────────

export async function parseReceiptAndCreateExpense(formData: FormData) {
  const showId = formData.get("showId") as string;
  const vendorId = formData.get("vendorId") as string;
  const receiptText = formData.get("receiptText") as string | null;
  const receiptBase64 = formData.get("receiptBase64") as string | null;
  const mediaType = (formData.get("mediaType") as string | null) ?? "image/jpeg";

  if (!showId || !vendorId) return { error: "Missing showId or vendorId" };
  if (!receiptText && !receiptBase64)
    return { error: "Provide either receipt text or an image" };

  // 1 — Extract raw text from whatever input we got
  let rawText = "";

  if (receiptText?.trim()) {
    // Plain text paste — use directly
    rawText = receiptText.trim();
  } else if (receiptBase64) {
    try {
      if (mediaType === "application/pdf") {
        rawText = await extractPdfText(receiptBase64);
      } else {
        // Image — run Tesseract OCR
        rawText = await ocrImage(receiptBase64);
      }
    } catch (err) {
      console.error("OCR/PDF error:", err);
      return { error: "Could not read the file. Try pasting the receipt text instead." };
    }
  }

  if (!rawText.trim()) {
    return { error: "No readable text found in the receipt." };
  }

  // 2 — Parse the raw text into structured fields
  const parsed = parseReceiptText(rawText);

  if (!parsed.total_amount || parsed.total_amount <= 0) {
    return {
      error:
        "Could not find a total amount in the receipt. Try pasting the text manually.",
    };
  }

  const validCategories = [
    "production","sound","lights","hospitality",
    "marketing","backline","security","other",
  ];
  const category = validCategories.includes(parsed.category)
    ? (parsed.category as typeof expenses.$inferInsert["category"])
    : "other";

  // 3 — Write the expense to the DB
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
    receiptRaw: rawText.substring(0, 2000), // store first 2000 chars for traceability
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
