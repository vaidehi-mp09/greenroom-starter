"use client";

import { useState, useCallback } from "react";
import { SettlementExport } from "@/components/settlement-export";
import type { SettlementExportData } from "@/components/settlement-export";

interface Props {
  children: React.ReactNode;
  exportData: SettlementExportData;
}

/**
 * Thin client shell around the settlement worksheet.
 * Manages:
 *   1. forceExpanded state — passed down to ExpenseBreakdown for PDF print
 *   2. onPrint handler — expands expenses then triggers window.print()
 *   3. Renders the SettlementExport bar below the worksheet Card
 */
export function WorksheetClientShell({ children, exportData }: Props) {
  const [, setForceExpanded] = useState(false);

  const handlePrint = useCallback(() => {
    setForceExpanded(true);
    // Give React a tick to re-render with expanded state before print dialog
    setTimeout(() => {
      window.print();
      setForceExpanded(false);
    }, 120);
  }, []);

  return (
    <div className="print:shadow-none">
      {children}
      <SettlementExport data={exportData} onPrint={handlePrint} />
    </div>
  );
}
