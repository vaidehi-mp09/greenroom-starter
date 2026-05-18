import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  AlertTriangle,
  Mail,
  Pencil,
  XCircle,
  Wallet,
  TrendingUp,
  Info,
} from "lucide-react";
import { getShowById } from "@/lib/queries";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Field,
} from "@/components/ui/card";
import { StatusBadge, DealTypeBadge, PlainBadge } from "@/components/ui/badge";
import { calculateSettlement } from "@/lib/dealMath";
import {
  formatMoney,
  formatShowDateFull,
} from "@/lib/format";
import type { Settlement, Recoup, Deal, Expense, TicketSale } from "@/db/schema";
import { Logomark } from "@/components/brand/logo";
import { WorksheetClientShell } from "@/components/worksheet-client-shell";
import { ExpenseBreakdown } from "@/components/expense-breakdown";
import type { ExpenseCategory } from "@/components/expense-breakdown";
import { SettlementExport } from "@/components/settlement-export";
import type { SettlementExportData } from "@/components/settlement-export";

const RECOUP_LABELS: Record<Recoup["category"], string> = {
  marketing: "Marketing",
  hospitality_overage: "Hospitality overage",
  production_overage: "Production overage",
  prior_advance: "Prior advance",
  damages: "Damages",
  other: "Other",
};

export default async function SettlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getShowById(id);
  if (!data) notFound();

  const { show, artist, deal, ticketSales, expenses: expenseRows, settlement, recoups } =
    data;

  // Flatten to plain expense objects for settlement calculation
  const expenses = expenseRows.map((r) => r.expense);

  if (!deal) {
    return (
      <div className="px-12 py-10 max-w-4xl">
        <BackLink showId={show.id} />
        <div className="text-[13px] text-ink-400">
          No deal entered for this show. Settlement can&apos;t run yet.
        </div>
      </div>
    );
  }

  const calc = calculateSettlement({
    deal,
    ticketSales,
    expenses,
    venueCapacity: data.venue?.capacity ?? undefined,
  });
  const grossSoFar = ticketSales.reduce((sum, t) => sum + t.gross, 0);
  const totalFees = ticketSales.reduce((sum, t) => sum + t.fees, 0);
  const totalExpenses = expenses
    .filter((e) => !e.absorbedByVenue)
    .reduce((sum, e) => sum + e.amount, 0);

  const disputedRecoups = recoups.filter((r) => r.status === "disputed");
  const isDisputed = settlement?.status === "disputed" || settlement?.status === "revised" || !!settlement?.disputedAt;
  const disputedRecoupValue = disputedRecoups.reduce((s, r) => s + r.amount, 0);

  return (
    <div className={`px-12 py-10 max-w-7xl ${isDisputed ? "bg-gradient-to-b from-rose-50/30 via-canvas to-canvas" : ""}`}>
      <BackLink showId={show.id} />

      <div className="mb-20">
        <div className="flex items-center gap-1.5 mb-4">
          <StatusBadge status={show.status} />
          <DealTypeBadge type={deal.dealType} />
          {settlement?.status === "disputed" && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10.5px] font-medium ring-1 ring-inset bg-rose-50 text-rose-800 ring-rose-200/80">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" />
              </span>
              Disputed
            </span>
          )}
          {settlement?.status === "voided" && (
            <PlainBadge variant="default">Voided</PlainBadge>
          )}
        </div>
        <h1 className="font-display text-[48px] font-medium text-ink-900 leading-[1.05]" style={{ letterSpacing: "-0.02em", fontOpticalSizing: "auto" }}>
          Settlement · {artist?.name}
        </h1>
        <div className="text-[14px] text-ink-400 mt-3">
          {formatShowDateFull(show.date)}
        </div>
      </div>

      {/* Disputed callout */}
      {isDisputed && disputedRecoupValue > 0 && (
        <div className="mb-8 rounded-lg border border-rose-200/60 bg-rose-50/40 p-5 flex gap-3">
          <AlertTriangle className="h-4 w-4 text-rose-700 mt-0.5 shrink-0" />
          <div>
            <div className="text-[13px] font-semibold text-rose-800">
              {disputedRecoups.length} recoup{disputedRecoups.length === 1 ? "" : "s"} in dispute · {formatMoney(disputedRecoupValue)} contested
            </div>
            <p className="text-[12.5px] text-ink-600 mt-1 leading-relaxed">
              The artist team has flagged recoup line items. This settlement cannot be finalized until the dispute is resolved.
            </p>
          </div>
        </div>
      )}

      {settlement && (
        <LifecycleBar settlement={settlement} disputedRecoups={disputedRecoups.length} />
      )}

      <div className="space-y-6 mt-6">
        <SettlementWorksheet
          deal={deal}
          expenses={expenses}
          ticketSales={ticketSales}
          calc={calc}
          settlement={settlement}
          venueCapacity={data.venue?.capacity ?? undefined}
          artist={artist?.name ?? "Unknown artist"}
          showDate={show.date}
        />

        {recoups.length > 0 && <RecoupsSection recoups={recoups} />}

        {settlement && (settlement.signoffText || settlement.notes) && (
          <SignoffSection settlement={settlement} />
        )}
      </div>

      <div className="mt-16 pt-10 border-t border-ink-200/60">
        <div className="flex gap-4 items-start max-w-3xl">
          <Logomark size={40} className="shrink-0" />
          <div>
            <h2 className="font-display text-[20px] font-medium text-ink-900 mb-2" style={{ letterSpacing: "-0.02em" }}>
              You&apos;re looking at the seam this case study is about.
            </h2>
            <p className="text-[13px] text-ink-500 leading-relaxed">
              Greenroom&apos;s in-app settlement tool was built early in the
              company&apos;s history, when most deals were flat guarantees.
              About 18% of customers actively use it; the other 82% — including
              most of the larger venues — default to spreadsheets. The CEO has
              flagged this as the company&apos;s biggest craft gap.{" "}
              <Link
                href="/context"
                className="text-brand-700 font-medium hover:text-brand-800 hover:underline inline-flex items-center gap-0.5"
              >
                Where to start <ArrowRight className="h-3 w-3" />
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BackLink({ showId }: { showId: string }) {
  return (
    <Link
      href={`/shows/${showId}`}
      className="inline-flex items-center gap-1 text-[12px] text-ink-400 hover:text-ink-900 mb-8 transition-colors"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Back to show
    </Link>
  );
}

type Stage = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  timestamp?: Date | null;
};

function LifecycleBar({
  settlement,
  disputedRecoups,
}: {
  settlement: Settlement;
  disputedRecoups: number;
}) {
  if (settlement.status === "voided") {
    return (
      <div className="rounded-lg border border-ink-200/80 bg-white px-5 py-4 flex items-center gap-3">
        <XCircle className="h-4 w-4 text-ink-400" />
        <div>
          <div className="text-[13px] font-medium text-ink-900">
            Settlement voided
          </div>
          <div className="text-[11.5px] text-ink-400 mt-0.5">
            The show was cancelled or the settlement was scrapped.
          </div>
        </div>
      </div>
    );
  }

  const stages: Stage[] = [
    {
      key: "draft",
      label: "Drafted",
      icon: Pencil,
      timestamp: settlement.draftedAt,
    },
    {
      key: "submitted",
      label: "Submitted",
      icon: Mail,
      timestamp: settlement.submittedAt,
    },
    {
      key: "review",
      label: "Reviewed",
      icon: TrendingUp,
      timestamp: settlement.reviewStartedAt,
    },
    {
      key: "signed",
      label: settlement.disputedAt ? "Finalized" : "Signed",
      icon: Check,
      timestamp: settlement.finalizedAt ?? settlement.signedAt,
    },
    {
      key: "paid",
      label: "Paid",
      icon: Wallet,
      timestamp: settlement.paidAt,
    },
  ];

  const currentIndex = (() => {
    switch (settlement.status) {
      case "draft":
        return 0;
      case "submitted":
        return 1;
      case "in_review":
        return 2;
      case "disputed":
      case "signed":
      case "revised":
      case "finalized":
        return 3;
      case "paid":
        return 4;
      default:
        return 0;
    }
  })();

  const isDisputed =
    settlement.status === "disputed" ||
    settlement.status === "revised" ||
    !!settlement.disputedAt;

  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-center justify-between mb-4">
          <div className="eyebrow text-[10px] text-ink-400">
            Settlement lifecycle
          </div>
          {isDisputed && (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-rose-700">
              <AlertTriangle className="h-3 w-3" />
              {settlement.status === "disputed"
                ? "In dispute"
                : settlement.status === "revised"
                  ? "Revision sent"
                  : "Resolved after dispute"}
              {disputedRecoups > 0 && (
                <span className="text-rose-600">
                  · {disputedRecoups} disputed recoup
                  {disputedRecoups === 1 ? "" : "s"}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-5 gap-1 relative">
          <div className="absolute top-3.5 left-[10%] right-[10%] h-px bg-ink-200/60" />

          {stages.map((stage, i) => {
            const isComplete = i < currentIndex;
            const isCurrent = i === currentIndex;
            const isFuture = i > currentIndex;
            const Icon = stage.icon;

            const stageDot = (() => {
              if (isComplete) {
                return "bg-brand-700 ring-brand-700 text-white";
              }
              if (isCurrent) {
                return isDisputed
                  ? "bg-rose-50 ring-rose-500 text-rose-700"
                  : "bg-brand-50 ring-brand-700 text-brand-700";
              }
              return "bg-white ring-ink-200/80 text-ink-300";
            })();

            return (
              <div
                key={stage.key}
                className="flex flex-col items-center text-center"
              >
                <div
                  className={`relative z-10 w-7 h-7 rounded-full ring-2 flex items-center justify-center ${stageDot}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div
                  className={`mt-2.5 text-[11px] font-medium leading-tight ${
                    isFuture ? "text-ink-300" : "text-ink-900"
                  }`}
                >
                  {stage.label}
                </div>
                <div className="text-[10px] text-ink-400 mt-0.5 font-mono tabular leading-tight min-h-[12px]">
                  {stage.timestamp
                    ? new Date(stage.timestamp).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    : ""}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Unified two-column settlement worksheet (all deal types) ─────────────────

const EXPENSE_LABELS: Record<string, string> = {
  sound: "Sound", lights: "Lights", production: "Production",
  hospitality: "Hospitality", marketing: "Marketing",
  backline: "Backline", security: "Security", other: "Other",
};

const RECOUP_BASIS_SHORT: Record<string, string> = {
  against_gross: "deducted from gross",
  outside_cap:   "outside expense cap",
  inside_cap:    "inside expense cap",
};

const HOSP_OVERAGE_SHORT: Record<string, string> = {
  venue_absorbs:  "venue absorbs overage",
  artist_absorbs: "charged to artist",
  split:          "split 50/50",
};

const DEAL_TYPE_LABEL: Record<string, string> = {
  flat:               "Flat guarantee",
  percentage_of_gross:"Percentage of gross",
  percentage_of_net:  "Percentage of net",
  vs:                 "Vs deal",
  door:               "Door deal",
};

function SettlementWorksheet({
  deal,
  expenses,
  ticketSales,
  calc,
  settlement,
  artist,
  showDate,
}: {
  deal: Deal;
  expenses: Expense[];
  ticketSales: TicketSale[];
  calc: ReturnType<typeof calculateSettlement>;
  settlement: Settlement | null;
  venueCapacity?: number;
  artist: string;
  showDate: string;
}) {
  const grossBoxOffice  = ticketSales.reduce((s, t) => s + t.gross, 0);
  const totalFees       = ticketSales.reduce((s, t) => s + t.fees, 0);
  const netBoxOffice    = grossBoxOffice - totalFees;

  const passedThrough   = expenses.filter((e) => !e.absorbedByVenue);
  const totalExpenses   = passedThrough.reduce((s, e) => s + e.amount, 0);
  const cappedExpenses  = deal.expenseCap
    ? Math.min(totalExpenses, deal.expenseCap)
    : totalExpenses;
  const netAfterExp     = netBoxOffice - cappedExpenses;

  // Per-category expense breakdown
  const byCategory: Record<string, number> = {};
  for (const e of passedThrough) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
  }
  const expenseCategories: ExpenseCategory[] = Object.entries(byCategory).map(
    ([category, amount]) => ({ category, amount })
  );
  const hospActual  = byCategory.hospitality ?? 0;
  const hospOverage = deal.hospitalityCap
    ? Math.max(0, hospActual - deal.hospitalityCap)
    : 0;
  void hospOverage; // used in export data

  // Final total: prefer the system-calculated value; fall back to manually entered
  const calcTotal = calc.supported ? calc.totalToArtist : null;
  const finalTotal = calcTotal ?? settlement?.totalToArtist ?? null;

  // Agreed column strings
  const agreedCalc = (() => {
    switch (deal.dealType) {
      case "flat":
        return deal.guaranteeAmount != null
          ? `Flat guarantee · ${formatMoney(deal.guaranteeAmount)}`
          : "Flat guarantee";
      case "percentage_of_gross":
        return deal.percentage != null
          ? `${(deal.percentage * 100).toFixed(0)}% of gross`
          : "% of gross";
      case "percentage_of_net":
        return deal.percentage != null
          ? `${(deal.percentage * 100).toFixed(0)}% of net after expenses`
          : "% of net";
      case "vs":
        return deal.guaranteeAmount != null && deal.percentage != null
          ? `${formatMoney(deal.guaranteeAmount)} guarantee vs ${(deal.percentage * 100).toFixed(0)}% of net — whichever greater`
          : "Guarantee vs % of net";
      case "door":
        return "Artist receives gross minus capped expenses";
      default:
        return "—";
    }
  })();

  // Actual calculation detail for artist row
  const actualCalcDetail = (() => {
    if (!calc.supported) return settlement?.totalToArtist != null
      ? `${formatMoney(settlement.totalToArtist)} (settled off-platform)`
      : "— (calculated off-platform)";
    if (deal.dealType === "vs") {
      const pct    = netAfterExp * (deal.percentage ?? 0);
      const gtee   = deal.guaranteeAmount ?? 0;
      const winner = pct >= gtee ? "% wins" : "guarantee wins";
      return `${formatMoney(Math.max(pct, gtee))} · ${winner}`;
    }
    return formatMoney(calc.totalToArtist);
  })();

  const bonusesNotTriggered = calc.supported ? calc.bonusesNotTriggered : [];
  const bonusesApplied      = calc.supported ? calc.bonusesApplied      : [];

  // ── Build flat export rows (expenses always expanded) ──────────────────────
  const exportRows: SettlementExportData["rows"] = [
    { lineItem: "Gross box office", agreed: "From integrated ticketing", actual: `$${grossBoxOffice.toFixed(2)}`, actualNum: grossBoxOffice },
    { lineItem: "Platform fees",    agreed: "Per ticketing agreement",   actual: `− $${totalFees.toFixed(2)}`,  actualNum: -totalFees },
    { lineItem: "Net box office",   agreed: "—",                         actual: `$${netBoxOffice.toFixed(2)}`, actualNum: netBoxOffice },
    ...expenseCategories.map(({ category, amount }) => ({
      lineItem: `  ${EXPENSE_LABELS[category] ?? category}`,
      agreed: category === "hospitality" && deal.hospitalityCap
        ? `Cap $${deal.hospitalityCap} · ${deal.hospitalityOverageRule ?? ""}`
        : deal.expenseCap ? `Within cap $${deal.expenseCap}` : "Passed through",
      actual: `− $${amount.toFixed(2)}`,
      actualNum: -amount,
    })),
    { lineItem: "Net after expenses", agreed: "—", actual: `$${netAfterExp.toFixed(2)}`, actualNum: netAfterExp },
    { lineItem: "Artist calculation", agreed: agreedCalc, actual: actualCalcDetail },
    ...bonusesApplied.map((b) => ({ lineItem: b.label, agreed: "Bonus triggered", actual: `+ $${b.amount.toFixed(2)}`, actualNum: b.amount })),
    ...bonusesNotTriggered.map((b) => ({ lineItem: b.label, agreed: b.reason, actual: "— not triggered" })),
    ...(deal.recoupBasis ? [{ lineItem: "Marketing recoup", agreed: RECOUP_BASIS_SHORT[deal.recoupBasis] ?? deal.recoupBasis, actual: "see recoups section" }] : []),
  ];

  const exportData: SettlementExportData = {
    artistName:         artist,
    showDate,
    dealType:           DEAL_TYPE_LABEL[deal.dealType] ?? deal.dealType,
    rows:               exportRows,
    totalToArtist:      finalTotal,
    settledOffPlatform: !calc.supported,
  };

  return (
    <>
      {/* Hero number — kept exactly as before */}
      <div className="text-center py-10 mb-2">
        <div className="eyebrow text-[10px] text-ink-400 mb-3">Total to artist</div>
        <div className="text-[72px] font-mono tabular font-bold text-ink-900 leading-none"
          style={{ letterSpacing: "-0.03em" }}>
          {finalTotal != null ? formatMoney(finalTotal) : "—"}
        </div>
        {settlement && (
          <div className="mt-3 flex items-center justify-center gap-2">
            {settlement.status === "paid"      && <PlainBadge variant="brand">Paid</PlainBadge>}
            {(settlement.status === "signed" || settlement.status === "finalized") && <PlainBadge variant="brand">Signed</PlainBadge>}
            {settlement.status === "disputed"  && <PlainBadge variant="rose">Disputed</PlainBadge>}
            {!calc.supported && (
              <span className="text-[11px] text-ink-400 flex items-center gap-1">
                <Info className="h-3 w-3" />
                {DEAL_TYPE_LABEL[deal.dealType] ?? deal.dealType} · settled off-platform
              </span>
            )}
          </div>
        )}
      </div>

      {/* Two-column worksheet — wrapped in client shell for print/expand state */}
      <WorksheetClientShell exportData={exportData}>
      <Card accent="brand">
        <CardHeader>
          <div>
            <CardTitle>Settlement worksheet</CardTitle>
            <CardDescription>
              Agreed deal terms alongside actual show numbers — line by line.
            </CardDescription>
          </div>
          <DealTypeBadge type={deal.dealType} />
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-ink-100/80">
                <th className="px-5 py-2.5 text-left eyebrow text-[9px] text-ink-400 font-semibold w-[38%]">Line item</th>
                <th className="px-5 py-2.5 text-left eyebrow text-[9px] text-ink-400 font-semibold w-[35%]">Agreed</th>
                <th className="px-5 py-2.5 text-right eyebrow text-[9px] text-ink-400 font-semibold w-[27%]">Actual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100/60">

              {/* ── Box office ─────────────────────────────────── */}
              <WRow label="Gross box office"
                agreed="From integrated ticketing"
                actual={<span className="text-green-700 font-medium">+ {formatMoney(grossBoxOffice)}</span>} />
              <WRow label="Platform fees"
                agreed="Per ticketing agreement"
                actual={<span className="text-rose-600">− {formatMoney(totalFees)}</span>} />
              <WRowTotal label="Net box office" value={formatMoney(netBoxOffice)} />

              {/* ── Expenses — collapsible client component ─────── */}
              <ExpenseBreakdown
                categories={expenseCategories}
                deal={deal}
                totalExpenses={totalExpenses}
                cappedExpenses={cappedExpenses}
              />
              <WRowTotal label="Net after expenses" value={formatMoney(netAfterExp)} />

              {/* ── Artist calculation ─────────────────────────── */}
              <WRow label="Artist calculation"
                agreed={agreedCalc}
                actual={<span className="font-medium text-ink-900">{actualCalcDetail}</span>} />

              {/* ── Bonuses ────────────────────────────────────── */}
              {bonusesApplied.map((b, i) => (
                <WRow key={`ba-${i}`}
                  label={b.label}
                  agreed="Bonus triggered ✅"
                  actual={<span className="text-green-700 font-medium">+ {formatMoney(b.amount)}</span>} />
              ))}
              {bonusesNotTriggered.map((b, i) => (
                <WRow key={`bn-${i}`}
                  label={b.label}
                  agreed={b.reason}
                  actual={<span className="text-ink-300 line-through">{formatMoney(b.amount)}</span>} />
              ))}

              {/* ── Marketing recoup — always shown ────────────── */}
              {(() => {
                const agreedText = deal.recoupBasis
                  ? RECOUP_BASIS_SHORT[deal.recoupBasis] ?? deal.recoupBasis
                  : null;

                // Parse actual recoup from settlement
                let recoupActual: React.ReactNode = <span className="text-ink-400">—</span>;
                if (settlement?.recoupsJson) {
                  try {
                    const recs = JSON.parse(settlement.recoupsJson);
                    const mkt  = Array.isArray(recs)
                      ? recs.filter((r: Recoup) => r.category === "marketing")
                      : [];
                    const total = mkt.reduce((s: number, r: Recoup) => s + r.amount, 0);
                    if (total > 0) {
                      const disputed = mkt.some((r: Recoup) => r.status === "disputed");
                      recoupActual = (
                        <span className={`flex flex-col items-end gap-0.5 ${disputed ? "text-rose-600" : "text-rose-500"}`}>
                          <span>− {formatMoney(total)}</span>
                          {disputed && <span className="text-[10px] font-medium">disputed</span>}
                        </span>
                      );
                    }
                  } catch {/* ignore */}
                }

                return (
                  <WRow
                    label="Marketing recoup"
                    agreed={
                      agreedText
                        ? agreedText
                        : <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                            Not agreed — clarify with agent
                          </span>
                    }
                    actual={recoupActual}
                  />
                );
              })()}

              {/* ── Hospitality overage — always shown ─────────── */}
              {(() => {
                const agreedText = deal.hospitalityOverageRule
                  ? HOSP_OVERAGE_SHORT[deal.hospitalityOverageRule] ?? deal.hospitalityOverageRule
                  : null;
                return (
                  <WRow
                    label="Hosp. overage rule"
                    agreed={
                      agreedText
                        ? agreedText
                        : <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                            Not agreed — clarify with agent
                          </span>
                    }
                    actual={
                      deal.hospitalityCap != null
                        ? <span className="text-ink-500 text-[11.5px]">cap {formatMoney(deal.hospitalityCap)}</span>
                        : <span className="text-ink-400">—</span>
                    }
                  />
                );
              })()}

            </tbody>
            {/* ── Total row ──────────────────────────────────────── */}
            <tfoot>
              <tr className="border-t-2 border-ink-200/80 bg-canvas-soft/50">
                <td className="px-5 py-4 text-[13.5px] font-semibold text-ink-900">Total to artist</td>
                <td className="px-5 py-4 text-[11px] text-ink-400">
                  {calc.supported ? "Calculated by system" : "Entered off-platform"}
                </td>
                <td className="px-5 py-4 text-right font-mono tabular font-bold text-[18px] text-ink-900">
                  {finalTotal != null ? formatMoney(finalTotal) : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>
      </WorksheetClientShell>
    </>
  );
}

// ── Worksheet row components ──────────────────────────────────────────────────

function WRow({
  label, agreed, actual, indent = false,
}: {
  label: string;
  agreed: React.ReactNode;
  actual: React.ReactNode;
  indent?: boolean;
}) {
  return (
    <tr className="hover:bg-ink-50/30 transition-colors">
      <td className={`px-5 py-2.5 text-ink-700 ${indent ? "pl-8" : ""}`}>
        {indent && <span className="text-ink-300 mr-1.5">└</span>}{label}
      </td>
      <td className="px-5 py-2.5 text-ink-400 text-[11.5px] leading-snug">{agreed}</td>
      <td className="px-5 py-2.5 text-right font-mono tabular">{actual}</td>
    </tr>
  );
}

function WRowTotal({ label, value }: { label: string; value: string }) {
  return (
    <tr className="bg-ink-50/40">
      <td className="px-5 py-2.5 text-[12.5px] font-semibold text-ink-900" colSpan={2}>{label}</td>
      <td className="px-5 py-2.5 text-right font-mono tabular font-semibold text-[13.5px] text-ink-900">{value}</td>
    </tr>
  );
}

function RecoupsSection({ recoups }: { recoups: Recoup[] }) {
  const total = recoups.reduce((s, r) => s + r.amount, 0);
  const disputedTotal = recoups
    .filter((r) => r.status === "disputed")
    .reduce((s, r) => s + r.amount, 0);
  const hasDisputed = disputedTotal > 0;

  return (
    <Card accent={hasDisputed ? "rose" : undefined}>
      <CardHeader>
        <div>
          <CardTitle>Recoups</CardTitle>
          <CardDescription>
            Venue costs taken off the top before artist payment. Often the
            disputed line items in a settlement.
          </CardDescription>
        </div>
        <PlainBadge variant={hasDisputed ? "rose" : "default"}>
          {formatMoney(total)} total
        </PlainBadge>
      </CardHeader>
      <CardContent className="divide-y divide-ink-100/80">
        {recoups.map((r) => (
          <div
            key={r.id}
            className="py-3.5 grid grid-cols-[1fr_auto_auto] items-center gap-3"
          >
            <div className="min-w-0">
              <div className="text-[13px] text-ink-900 leading-tight">
                {r.label}
              </div>
              <div className="text-[11.5px] text-ink-400 mt-0.5">
                {RECOUP_LABELS[r.category]}
              </div>
            </div>
            <div>
              {r.status === "disputed" ? (
                <PlainBadge variant="rose">Disputed</PlainBadge>
              ) : r.status === "withdrawn" ? (
                <PlainBadge variant="default">Withdrawn</PlainBadge>
              ) : (
                <PlainBadge variant="brand">Agreed</PlainBadge>
              )}
            </div>
            <div className="text-[13.5px] font-mono tabular text-ink-900 text-right min-w-[80px]">
              {formatMoney(r.amount)}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SignoffSection({ settlement }: { settlement: Settlement }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign-off & notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {settlement.signoffText && (
          <div>
            <div className="eyebrow text-[10px] text-ink-500 mb-2">
              From the artist team
            </div>
            <div className="text-[13px] text-ink-800 bg-canvas-soft rounded-lg p-4 ring-1 ring-ink-200/60 leading-relaxed">
              &ldquo;{settlement.signoffText}&rdquo;
            </div>
          </div>
        )}
        {settlement.notes && (
          <div>
            <div className="eyebrow text-[10px] text-ink-500 mb-2">
              Mariana&apos;s settlement notes
            </div>
            <div className="text-[12.5px] text-ink-800 bg-canvas-soft rounded-lg p-4 ring-1 ring-ink-200/60 leading-relaxed">
              {settlement.notes}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

