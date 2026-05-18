"use client";

import { useState, useTransition } from "react";
import { Plus, Loader2, CheckCircle2, XCircle, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlainBadge } from "@/components/ui/badge";
import type { Vendor } from "@/db/schema";
import { addVendor } from "@/app/actions/vendors";

const CATEGORY_LABELS: Record<string, string> = {
  sound:       "Sound",
  lights:      "Lights",
  production:  "Production",
  hospitality: "Hospitality",
  marketing:   "Marketing",
  backline:    "Backline",
  security:    "Security",
  other:       "Other",
};

const CATEGORY_ORDER = [
  "sound","lights","production","hospitality","marketing","backline","security","other",
];

interface Props {
  showId: string;
  vendors: Vendor[];        // confirmed for this show
  masterVendors: Vendor[];  // global pre-onboarded pool (show_id = null)
}

export function VendorPanel({ showId, vendors, masterVendors }: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedMasterId, setSelectedMasterId] = useState("");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Master vendors available for the selected category
  const availableVendors = masterVendors.filter(
    (v) => v.category === selectedCategory
  );

  // Categories that already have a vendor on this show (prevent duplicates)
  const usedCategories = new Set(vendors.map((v) => v.category));

  function handleCategoryChange(cat: string) {
    setSelectedCategory(cat);
    setSelectedMasterId(""); // reset vendor selection when category changes
  }

  function handleAddVendor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const master = masterVendors.find((v) => v.id === selectedMasterId);
    if (!master) {
      setMessage({ type: "error", text: "Select a vendor from the list." });
      return;
    }

    const data = new FormData();
    data.set("showId", showId);
    data.set("name", master.name);
    data.set("category", master.category);
    data.set("contactName", master.contactName ?? "");
    data.set("contactEmail", master.contactEmail ?? "");

    startTransition(async () => {
      const result = await addVendor(data);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: `${master.name} added.` });
        setShowAddForm(false);
        setSelectedCategory("");
        setSelectedMasterId("");
      }
      setTimeout(() => setMessage(null), 3000);
    });
  }

  // Sort confirmed vendors by category order
  const sortedVendors = [...vendors].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
  );

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Vendors</CardTitle>
          <CardDescription>
            Confirmed service providers for this show.
          </CardDescription>
        </div>
        {vendors.length > 0 && (
          <PlainBadge variant="default">{vendors.length}</PlainBadge>
        )}
      </CardHeader>

      <CardContent className="space-y-4">

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

        {/* Vendor list — Field format */}
        {vendors.length === 0 && !showAddForm ? (
          <p className="text-[12.5px] text-ink-400">
            No vendors registered yet.
          </p>
        ) : (
          <div className="space-y-4">
            {sortedVendors.map((v) => (
              <Field
                key={v.id}
                label={CATEGORY_LABELS[v.category] ?? v.category}
                value={
                  v.contactName ? `${v.name} · ${v.contactName}` : v.name
                }
              />
            ))}
          </div>
        )}

        {/* Add vendor form */}
        {showAddForm && (
          <form
            onSubmit={handleAddVendor}
            className="rounded-lg ring-1 ring-brand-200/40 bg-brand-50/20 p-3 space-y-3 mt-2"
          >
            <div className="eyebrow text-[10px] text-brand-800">Add vendor</div>

            {/* Category select */}
            <div>
              <label className="text-[10px] text-ink-500 block mb-1">Category</label>
              <div className="relative">
                <select
                  value={selectedCategory}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  required
                  className="w-full appearance-none text-[12px] rounded-md ring-1 ring-ink-200/60 bg-white px-3 py-1.5 pr-7 text-ink-800 focus:outline-none focus:ring-brand-400"
                >
                  <option value="">Select category…</option>
                  {CATEGORY_ORDER.map((cat) => (
                    <option
                      key={cat}
                      value={cat}
                      disabled={usedCategories.has(cat)}
                    >
                      {CATEGORY_LABELS[cat]}{usedCategories.has(cat) ? " (already added)" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-400" />
              </div>
            </div>

            {/* Vendor name — filtered dropdown from master pool */}
            <div>
              <label className="text-[10px] text-ink-500 block mb-1">Vendor</label>
              <div className="relative">
                <select
                  value={selectedMasterId}
                  onChange={(e) => setSelectedMasterId(e.target.value)}
                  required
                  disabled={!selectedCategory}
                  className="w-full appearance-none text-[12px] rounded-md ring-1 ring-ink-200/60 bg-white px-3 py-1.5 pr-7 text-ink-800 focus:outline-none focus:ring-brand-400 disabled:text-ink-300 disabled:bg-ink-50"
                >
                  <option value="">
                    {selectedCategory
                      ? availableVendors.length === 0
                        ? "No vendors for this category"
                        : "Select vendor…"
                      : "Select a category first"}
                  </option>
                  {availableVendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}{v.contactName ? ` · ${v.contactName}` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-400" />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                type="submit"
                size="sm"
                variant="brand"
                disabled={isPending || !selectedMasterId}
              >
                {isPending
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Plus className="h-3 w-3" />}
                Add
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowAddForm(false);
                  setSelectedCategory("");
                  setSelectedMasterId("");
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {/* Add vendor trigger */}
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 text-[11px] text-brand-600 hover:text-brand-900 font-medium transition-colors pt-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add vendor
          </button>
        )}
      </CardContent>
    </Card>
  );
}
