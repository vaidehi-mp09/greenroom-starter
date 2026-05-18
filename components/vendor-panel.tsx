"use client";

import { useState, useTransition } from "react";
import { Plus, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlainBadge } from "@/components/ui/badge";
import type { Vendor } from "@/db/schema";
import { addVendor } from "@/app/actions/vendors";

const CATEGORY_LABELS: Record<string, string> = {
  production: "Production",
  sound: "Sound",
  lights: "Lights",
  hospitality: "Hospitality",
  marketing: "Marketing",
  backline: "Backline",
  security: "Security",
  other: "Other",
};

const CATEGORY_COLORS: Record<string, string> = {
  sound: "bg-blue-50 text-blue-700 ring-blue-200/60",
  lights: "bg-yellow-50 text-yellow-700 ring-yellow-200/60",
  hospitality: "bg-green-50 text-green-700 ring-green-200/60",
  marketing: "bg-purple-50 text-purple-700 ring-purple-200/60",
  production: "bg-orange-50 text-orange-700 ring-orange-200/60",
  backline: "bg-indigo-50 text-indigo-700 ring-indigo-200/60",
  security: "bg-red-50 text-red-700 ring-red-200/60",
  other: "bg-ink-50 text-ink-600 ring-ink-200/60",
};

interface Props {
  showId: string;
  vendors: Vendor[];
  // compact = true → no card wrapper, no vendor list (already rendered as Fields above)
  // only shows Add vendor form + per-vendor Upload receipt buttons
  compact?: boolean;
}

export function VendorPanel({ showId, vendors, compact = false }: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // ── Add vendor ────────────────────────────────────────────────────────────
  function handleAddVendor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    data.set("showId", showId);

    startTransition(async () => {
      const result = await addVendor(data);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: "Vendor added." });
        setShowAddForm(false);
        form.reset();
      }
      setTimeout(() => setMessage(null), 3000);
    });
  }


  const inner = (
    <div className="space-y-3">
      {/* Status message */}
      {message && (
        <div className={`flex items-center gap-2 text-[12px] rounded-lg px-3 py-2 ${
          message.type === "success"
            ? "bg-green-50 text-green-700 ring-1 ring-green-200/60"
            : "bg-rose-50 text-rose-700 ring-1 ring-rose-200/60"
        }`}>
          {message.type === "success"
            ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            : <XCircle className="h-3.5 w-3.5 shrink-0" />}
          {message.text}
        </div>
      )}

      {/* Upload receipt is handled per expense row in the expenses table */}

      {/* Add vendor form */}
      {showAddForm && (
        <form onSubmit={handleAddVendor} className="rounded-lg ring-1 ring-brand-200/40 bg-brand-50/20 p-3 space-y-2">
          <div className="text-[10px] eyebrow text-brand-800 mb-2">Add vendor</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="text-[10px] text-ink-500 block mb-1">Vendor name *</label>
              <input name="name" required placeholder="e.g. Nashville Sound Co."
                className="w-full text-[12px] rounded-md ring-1 ring-ink-200/60 bg-white px-3 py-1.5 text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-brand-400" />
            </div>
            <div>
              <label className="text-[10px] text-ink-500 block mb-1">Category *</label>
              <select name="category" required
                className="w-full text-[12px] rounded-md ring-1 ring-ink-200/60 bg-white px-3 py-1.5 text-ink-800 focus:outline-none focus:ring-brand-400">
                {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-ink-500 block mb-1">Contact name</label>
              <input name="contactName" placeholder="e.g. Jake Torres"
                className="w-full text-[12px] rounded-md ring-1 ring-ink-200/60 bg-white px-3 py-1.5 text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-brand-400" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-ink-500 block mb-1">Contact email</label>
              <input name="contactEmail" type="email" placeholder="e.g. jake@nashvillesound.com"
                className="w-full text-[12px] rounded-md ring-1 ring-ink-200/60 bg-white px-3 py-1.5 text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-brand-400" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" variant="brand" disabled={isPending}>
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Add vendor
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {!showAddForm && (
        <button onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 text-[11px] text-brand-600 hover:text-brand-900 font-medium transition-colors">
          <Plus className="h-3.5 w-3.5" /> Add vendor
        </button>
      )}
    </div>
  );

  if (compact) return inner;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Vendors</CardTitle>
          <CardDescription>Service providers for this show.</CardDescription>
        </div>
        <PlainBadge variant="default">{vendors.length} registered</PlainBadge>
      </CardHeader>
      <CardContent className="space-y-3">{inner}</CardContent>
    </Card>
  );
}
