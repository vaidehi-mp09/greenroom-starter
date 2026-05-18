"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { formatMoney } from "@/lib/format";
import type { Deal } from "@/db/schema";

const EXPENSE_LABELS: Record<string, string> = {
  sound: "Sound", lights: "Lights", production: "Production",
  hospitality: "Hospitality", marketing: "Marketing",
  backline: "Backline", security: "Security", other: "Other",
};

const HOSP_OVERAGE_SHORT: Record<string, string> = {
  venue_absorbs:  "venue absorbs overage",
  artist_absorbs: "charged to artist",
  split:          "split 50/50",
};

export interface ExpenseCategory {
  category: string;
  amount: number;
}

interface Props {
  categories: ExpenseCategory[];
  deal: Deal;
  totalExpenses: number;
  cappedExpenses: number;
  forceExpanded?: boolean; // used by print/export
}

export function ExpenseBreakdown({
  categories,
  deal,
  totalExpenses,
  cappedExpenses,
  forceExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const isExpanded = expanded || forceExpanded;
  const isCapped   = deal.expenseCap != null && totalExpenses > deal.expenseCap;

  return (
    <>
      {/* ── Summary row — always visible ───────────────────────────── */}
      <tr
        className="cursor-pointer hover:bg-ink-50/40 transition-colors group"
        onClick={() => setExpanded((e) => !e)}
      >
        <td className="px-5 py-2.5 text-ink-700">
          <span className="flex items-center gap-1.5">
            <ChevronRight
              className={`h-3 w-3 text-ink-400 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
            />
            Expenses
            <span className="text-[11px] text-ink-400">
              · {categories.length} item{categories.length !== 1 ? "s" : ""}
            </span>
          </span>
        </td>
        <td className="px-5 py-2.5 text-ink-400 text-[11.5px]">
          {deal.expenseCap != null
            ? `Cap ${formatMoney(deal.expenseCap)}`
            : "Passed through"}
        </td>
        <td className="px-5 py-2.5 text-right font-mono tabular text-rose-600">
          − {formatMoney(cappedExpenses)}
        </td>
      </tr>

      {/* ── Expanded category rows ──────────────────────────────────── */}
      {isExpanded && (
        <>
          {categories.map(({ category, amount }) => {
            const isHosp  = category === "hospitality";
            const hospCap = deal.hospitalityCap;
            const over    = isHosp && hospCap ? Math.max(0, amount - hospCap) : 0;
            const agreedStr = isHosp && hospCap
              ? `Cap ${formatMoney(hospCap)}${deal.hospitalityOverageRule
                  ? ` · ${HOSP_OVERAGE_SHORT[deal.hospitalityOverageRule]}`
                  : ""}`
              : "Passed through";

            return (
              <tr key={category} className="bg-ink-50/30">
                <td className="px-5 py-2 pl-10 text-ink-600 text-[12px]">
                  <span className="text-ink-300 mr-1.5">└</span>
                  {EXPENSE_LABELS[category] ?? category}
                </td>
                <td className="px-5 py-2 text-ink-400 text-[11px] leading-snug">
                  {agreedStr}
                </td>
                <td className="px-5 py-2 text-right font-mono tabular text-[12px]">
                  <span className="flex flex-col items-end gap-0.5">
                    <span className="text-rose-500">− {formatMoney(amount)}</span>
                    {over > 0 && (
                      <span className="text-[10px] text-amber-600 font-medium">
                        {formatMoney(over)} over cap
                      </span>
                    )}
                  </span>
                </td>
              </tr>
            );
          })}

          {/* Cap applied note */}
          {isCapped && (
            <tr className="bg-amber-50/40">
              <td className="px-5 py-1.5 pl-10 text-[11px] text-amber-700" colSpan={2}>
                Expense cap applied · actual {formatMoney(totalExpenses)} → capped at {formatMoney(deal.expenseCap!)}
              </td>
              <td className="px-5 py-1.5 text-right font-mono tabular text-[11px] text-amber-700">
                saved {formatMoney(totalExpenses - cappedExpenses)}
              </td>
            </tr>
          )}
        </>
      )}
    </>
  );
}
