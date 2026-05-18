"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Plus, Loader2, ChevronDown } from "lucide-react";
import type { Vendor } from "@/db/schema";
import { assignVendorToExpense } from "@/app/actions/vendors";

interface Props {
  expenseId: string;
  showId: string;
  category: string;
  linkedVendor: Vendor | null;       // vendor already on this expense row (via vendor_id)
  showVendors: Vendor[];             // vendors confirmed for this show
  masterVendors: Vendor[];           // global pre-onboarded pool (show_id = null)
}

export function ExpenseVendorCell({
  expenseId,
  showId,
  category,
  linkedVendor,
  showVendors,
  masterVendors,
}: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // Auto-match: if no explicit vendor_id, check if the show has exactly one
  // vendor for this category — if so, display them automatically.
  const showCategoryVendors = showVendors.filter((v) => v.category === category);
  const autoVendor =
    !linkedVendor && showCategoryVendors.length === 1
      ? showCategoryVendors[0]
      : null;

  // The vendor to display (explicit assignment wins, then auto-match)
  const displayVendor = linkedVendor ?? autoVendor;

  // If multiple show vendors for this category, show all names
  const multipleShowVendors =
    !linkedVendor && showCategoryVendors.length > 1 ? showCategoryVendors : [];

  // Master vendors for the dropdown — filtered by category
  const dropdownVendors = masterVendors.filter((v) => v.category === category);

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  // ── Single vendor confirmed for this show (auto or explicit) ─────────────
  if (displayVendor) {
    return (
      <span className="text-ink-700 text-[12.5px]">{displayVendor.name}</span>
    );
  }

  // ── Multiple show vendors for this category (each added their own expense) ─
  if (multipleShowVendors.length > 1) {
    return (
      <span className="text-ink-700 text-[12.5px]">
        {multipleShowVendors.map((v) => v.name).join(", ")}
      </span>
    );
  }

  // ── No vendor decided yet — show dropdown from master pool ────────────────
  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[11px] text-brand-600 hover:text-brand-900 font-medium transition-colors"
      >
        <Plus className="h-3 w-3" />
        Add vendor
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[220px] rounded-lg bg-white ring-1 ring-ink-200/60 shadow-lg py-1">
          {dropdownVendors.length === 0 ? (
            <div className="px-3 py-2.5 text-[11px] text-ink-400 leading-relaxed">
              No pre-onboarded {category} vendors found.
            </div>
          ) : (
            <>
              <div className="px-3 py-1.5 text-[9px] eyebrow text-ink-400 border-b border-ink-100/80">
                {category} vendors — select to assign
              </div>
              {dropdownVendors.map((v) => (
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
