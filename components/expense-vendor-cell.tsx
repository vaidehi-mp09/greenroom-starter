"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Plus, Receipt, Loader2, ChevronDown } from "lucide-react";
import type { Vendor } from "@/db/schema";
import { assignVendorToExpense } from "@/app/actions/vendors";

interface Props {
  expenseId: string;
  showId: string;
  category: string;
  vendor: Vendor | null;
  showVendors: Vendor[]; // all vendors for this show
}

export function ExpenseVendorCell({
  expenseId,
  showId,
  category,
  vendor,
  showVendors,
}: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // Vendors matching this expense's category
  const matching = showVendors.filter((v) => v.category === category);

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

  // ── Vendor already linked ─────────────────────────────────────────────────
  if (vendor) {
    return (
      <span className="flex items-center gap-1 text-ink-700">
        {vendor.name}
        {/* receipt icon shown if parsed via OCR */}
      </span>
    );
  }

  // ── No vendor linked yet ──────────────────────────────────────────────────
  return (
    <div ref={ref} className="relative inline-block">
      {isPending ? (
        <span className="flex items-center gap-1 text-ink-400 text-[11px]">
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving…
        </span>
      ) : (
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 text-[11px] text-brand-600 hover:text-brand-900 font-medium transition-colors group"
        >
          <Plus className="h-3 w-3" />
          Add vendor
          {matching.length > 0 && (
            <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
          )}
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] rounded-lg bg-white ring-1 ring-ink-200/60 shadow-lg py-1">
          {matching.length === 0 ? (
            <div className="px-3 py-2 text-[11px] text-ink-400">
              No {category} vendors registered for this show yet.
              <br />
              <span className="text-ink-300">Add one in the Vendors panel above.</span>
            </div>
          ) : (
            <>
              <div className="px-3 py-1.5 text-[9px] eyebrow text-ink-400 border-b border-ink-100/80">
                {category} vendors for this show
              </div>
              {matching.map((v) => (
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
