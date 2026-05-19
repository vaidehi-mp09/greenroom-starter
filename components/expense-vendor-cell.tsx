"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Loader2, ChevronDown } from "lucide-react";
import type { Vendor } from "@/db/schema";
import { assignVendorToExpense } from "@/app/actions/vendors";

interface Props {
  expenseId: string;
  showId: string;
  showDate: string;         // YYYY-MM-DD — used to lock past shows
  category: string;
  linkedVendor: Vendor | null;
  showVendors: Vendor[];    // vendors confirmed for this show only
}

export function ExpenseVendorCell({
  expenseId,
  showId,
  showDate,
  category,
  linkedVendor,
  showVendors,
}: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const today = new Date().toISOString().slice(0, 10);
  const isPastShow = showDate < today;

  // Vendors registered for this show matching this category
  const showCategoryVendors = showVendors.filter((v) => v.category === category);

  // Auto-match: one show vendor for this category → display automatically
  const autoVendor = !linkedVendor && showCategoryVendors.length === 1
    ? showCategoryVendors[0]
    : null;

  const displayVendor = linkedVendor ?? autoVendor;

  const multipleShowVendors = !linkedVendor && showCategoryVendors.length > 1
    ? showCategoryVendors
    : [];

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function handleSelect(vendorId: string) {
    const data = new FormData();
    data.set("expenseId", expenseId);
    data.set("vendorId", vendorId);
    data.set("showId", showId);
    startTransition(async () => {
      await assignVendorToExpense(data);
      setOpen(false);
    });
  }

  if (isPending) {
    return (
      <span className="flex items-center gap-1 text-ink-400 text-[11px]">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving…
      </span>
    );
  }

  // ── Vendor name to display ────────────────────────────────────────────────
  if (displayVendor) {
    return <span className="text-ink-700 text-[12.5px]">{displayVendor.name}</span>;
  }

  if (multipleShowVendors.length > 1) {
    return (
      <span className="text-ink-700 text-[12.5px]">
        {multipleShowVendors.map((v) => v.name).join(", ")}
      </span>
    );
  }

  // ── Past show — no vendor registered and can't add ───────────────────────
  if (isPastShow) {
    return <span className="text-ink-300 text-[11px]">—</span>;
  }

  // ── Future show — no show vendor for this category yet ───────────────────
  // Only show dropdown if there are show vendors to pick from
  if (showCategoryVendors.length === 0) {
    return (
      <span className="text-[11px] text-ink-400 italic">
        Add via Vendors panel
      </span>
    );
  }

  // ── Multiple show vendors, none linked yet — let Mariana pick ─────────────
  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[11px] text-brand-600 hover:text-brand-900 font-medium transition-colors"
      >
        Assign vendor
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[220px] rounded-lg bg-white ring-1 ring-ink-200/60 shadow-lg py-1">
          <div className="px-3 py-1.5 text-[9px] eyebrow text-ink-400 border-b border-ink-100/80">
            {category} vendors registered for this show
          </div>
          {showCategoryVendors.map((v) => (
            <button
              key={v.id}
              onClick={() => handleSelect(v.id)}
              className="w-full text-left px-3 py-2 text-[12px] text-ink-800 hover:bg-brand-50/60 transition-colors flex flex-col"
            >
              <span className="font-medium">{v.name}</span>
              {v.contactName && (
                <span className="text-[10px] text-ink-400">{v.contactName}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
