"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Camera, Loader2, CheckCircle2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseReceiptAndCreateExpense } from "@/app/actions/vendors";
import type { Vendor } from "@/db/schema";

interface Props {
  expenseId?: string;
  showId: string;
  vendor: Vendor | null;
  showVendors: Vendor[];
  alreadyParsed: boolean;
}

export function ExpenseReceiptUpload({
  showId,
  vendor,
  showVendors,
  alreadyParsed,
}: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  // Calculate fixed position when opening so popup escapes card overflow
  function handleOpen() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: Math.max(8, r.left - 200) });
    }
    setOpen((o) => !o);
  }

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      const target = e.target as Node;
      const popup = document.getElementById("receipt-upload-popup");
      if (popup && !popup.contains(target) && !btnRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const effectiveVendor = vendor ?? showVendors[0] ?? null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!effectiveVendor) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    data.set("showId", showId);
    data.set("vendorId", effectiveVendor.id);

    const fileInput = form.querySelector<HTMLInputElement>('input[type="file"]');
    const file = fileInput?.files?.[0];

    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        data.set("receiptBase64", base64);
        data.set("mediaType", file.type);
        submit(data, form);
      };
      reader.readAsDataURL(file);
    } else {
      submit(data, form);
    }
  }

  function submit(data: FormData, form: HTMLFormElement) {
    startTransition(async () => {
      const result = await parseReceiptAndCreateExpense(data);
      if (result.success) {
        setSuccess(true);
        setOpen(false);
        form.reset();
        setTimeout(() => setSuccess(false), 4000);
      }
    });
  }

  if (alreadyParsed || success) {
    return (
      <span title="Receipt uploaded" className="flex justify-center">
        <CheckCircle2 className="h-3.5 w-3.5 text-brand-500" />
      </span>
    );
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        title="Upload receipt"
        className="flex justify-center w-full text-ink-300 hover:text-brand-600 transition-colors"
      >
        {isPending
          ? <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-500" />
          : <Camera className="h-3.5 w-3.5" />}
      </button>

      {/* Fixed-position popup — escapes card overflow */}
      {open && (
        <div
          id="receipt-upload-popup"
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
          className="w-64 rounded-lg bg-white ring-1 ring-ink-200/60 shadow-xl p-3 space-y-2"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="text-[10px] eyebrow text-ink-500 uppercase tracking-wider">
              Upload receipt{effectiveVendor ? ` · ${effectiveVendor.name}` : ""}
            </div>
            <button onClick={() => setOpen(false)} className="text-ink-300 hover:text-ink-600">
              <X className="h-3 w-3" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-2">
            <div>
              <label className="text-[10px] text-ink-400 block mb-1">Image or PDF</label>
              <input
                type="file"
                accept="image/*,.pdf"
                className="text-[11px] text-ink-600 w-full file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
              />
            </div>
            <div>
              <label className="text-[10px] text-ink-400 block mb-1">Or paste receipt text</label>
              <textarea
                name="receiptText"
                rows={3}
                placeholder="Paste invoice text here…"
                className="w-full text-[11px] rounded-md ring-1 ring-ink-200/60 bg-white px-2 py-1.5 text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-brand-400 resize-none"
              />
            </div>
            <Button type="submit" size="sm" variant="brand" disabled={isPending} className="w-full">
              {isPending
                ? <><Loader2 className="h-3 w-3 animate-spin" /> Parsing…</>
                : <><Upload className="h-3 w-3" /> Parse & log</>}
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
