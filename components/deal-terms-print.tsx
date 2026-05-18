"use client";

import { FileDown } from "lucide-react";

export interface DealTermsPrintData {
  // Show
  showDate: string;
  venueName: string;
  venueCity: string;
  venueCapacity: number;
  // Artist & agent
  artistName: string;
  artistGenre: string | null;
  priorShowCount: number;
  agentName: string | null;
  agencyName: string | null;
  agentEmail: string | null;
  agentPreferencesNotes: string | null;
  // Deal terms
  dealType: string;
  guaranteeAmount: number | null;
  percentage: number | null;
  percentageBasis: string | null;
  expenseCap: number | null;
  hospitalityCap: number | null;
  recoupBasis: string | null;
  hospitalityOverageRule: string | null;
  bonusesJson: string | null;
  dealNotesFreetext: string | null;
}

const DEAL_TYPE_LABELS: Record<string, string> = {
  flat:               "Flat guarantee",
  percentage_of_gross:"Percentage of gross",
  percentage_of_net:  "Percentage of net",
  vs:                 "Vs deal (guarantee vs %)",
  door:               "Door deal",
};

const RECOUP_BASIS_LABELS: Record<string, string> = {
  against_gross: "Deducted from gross (before % calculation)",
  outside_cap:   "Outside expense cap (separate deduction)",
  inside_cap:    "Inside expense cap (counts toward cap ceiling)",
};

const HOSP_OVERAGE_LABELS: Record<string, string> = {
  venue_absorbs:  "Venue absorbs overage",
  artist_absorbs: "Artist absorbs overage (deducted from payout)",
  split:          "Split 50/50 between venue and artist",
};

function fmt(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildHtml(data: DealTermsPrintData): string {
  // Parse bonuses
  let bonusLines = "";
  if (data.bonusesJson) {
    try {
      const bonuses = JSON.parse(data.bonusesJson) as Array<{ label: string }>;
      if (Array.isArray(bonuses) && bonuses.length > 0) {
        bonusLines = bonuses.map((b) => `<li>${b.label}</li>`).join("");
      }
    } catch {/* ignore */}
  }

  const row = (label: string, value: string) =>
    `<tr><td class="label">${label}</td><td class="value">${value}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Deal Terms — ${data.artistName} · ${data.showDate}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 11pt;
      color: #1a1814;
      background: white;
      padding: 2cm;
    }
    .header { margin-bottom: 28px; border-bottom: 2px solid #1a1814; padding-bottom: 16px; }
    .header h1 { font-size: 22pt; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 4px; }
    .header .meta { font-size: 10pt; color: #666; }
    .section { margin-bottom: 24px; }
    .section-title {
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #2d7a4f;
      margin-bottom: 10px;
      padding-bottom: 4px;
      border-bottom: 1px solid #e5e2d9;
    }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 5px 0; vertical-align: top; }
    td.label {
      font-size: 8pt;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #888;
      width: 38%;
      padding-right: 16px;
    }
    td.value { font-size: 10.5pt; color: #1a1814; }
    .freetext {
      font-size: 10pt;
      color: #3a3630;
      font-style: italic;
      background: #faf7f0;
      border: 1px solid #e5e2d9;
      border-radius: 6px;
      padding: 12px;
      margin-top: 6px;
      line-height: 1.6;
    }
    .bonuses { margin-top: 6px; padding-left: 16px; }
    .bonuses li { font-size: 10pt; color: #1a1814; margin-bottom: 3px; }
    .badge {
      display: inline-block;
      font-size: 8pt;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
      background: #f0faf5;
      color: #2d7a4f;
      border: 1px solid #b8e0c8;
    }
    .footer {
      margin-top: 36px;
      padding-top: 12px;
      border-top: 1px solid #e5e2d9;
      font-size: 8.5pt;
      color: #aaa;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { padding: 1.2cm; }
      @page { margin: 1cm; }
    }
  </style>
</head>
<body>

  <div class="header">
    <h1>${data.artistName}</h1>
    <div class="meta">
      ${data.showDate} &nbsp;·&nbsp;
      ${data.venueName}, ${data.venueCity} &nbsp;·&nbsp;
      ${data.venueCapacity.toLocaleString()} cap &nbsp;·&nbsp;
      <span class="badge">${DEAL_TYPE_LABELS[data.dealType] ?? data.dealType}</span>
    </div>
  </div>

  <!-- Artist & Agent -->
  <div class="section">
    <div class="section-title">Artist &amp; Agent</div>
    <table>
      ${row("Artist", data.artistName)}
      ${data.artistGenre ? row("Genre", data.artistGenre.charAt(0).toUpperCase() + data.artistGenre.slice(1)) : ""}
      ${row("Prior shows here", String(data.priorShowCount))}
      ${data.agentName ? row("Agent", `${data.agentName}${data.agencyName ? ` · ${data.agencyName}` : ""}`) : ""}
      ${data.agentEmail ? row("Agent email", data.agentEmail) : ""}
    </table>
    ${data.agentPreferencesNotes
      ? `<div class="freetext">${data.agentPreferencesNotes}</div>`
      : ""}
  </div>

  <!-- Deal Terms -->
  <div class="section">
    <div class="section-title">Deal Terms</div>
    <table>
      ${row("Deal type", DEAL_TYPE_LABELS[data.dealType] ?? data.dealType)}
      ${row("Guarantee", data.guaranteeAmount != null ? fmt(data.guaranteeAmount) : "—")}
      ${row("Percentage", data.percentage != null
          ? `${(data.percentage * 100).toFixed(0)}% of ${data.percentageBasis ?? "gross"}`
          : "—")}
      ${row("Expense cap", data.expenseCap != null ? fmt(data.expenseCap) : "—")}
      ${row("Hospitality cap", data.hospitalityCap != null ? fmt(data.hospitalityCap) : "—")}
      ${row(
          "Marketing recoup",
          data.recoupBasis
            ? RECOUP_BASIS_LABELS[data.recoupBasis] ?? data.recoupBasis
            : '<span style="color:#b45309;font-weight:600">⚠ Not agreed — clarify before settlement</span>'
        )}
      ${row(
          "Hospitality overage",
          data.hospitalityOverageRule
            ? HOSP_OVERAGE_LABELS[data.hospitalityOverageRule] ?? data.hospitalityOverageRule
            : '<span style="color:#b45309;font-weight:600">⚠ Not agreed — clarify before settlement</span>'
        )}
    </table>

    ${bonusLines
      ? `<div style="margin-top:12px">
           <div class="section-title" style="margin-bottom:6px">Bonuses &amp; Escalators</div>
           <ul class="bonuses">${bonusLines}</ul>
         </div>`
      : ""}

    ${data.dealNotesFreetext
      ? `<div style="margin-top:12px">
           <div class="section-title" style="margin-bottom:6px">Deal Notes</div>
           <div class="freetext">${data.dealNotesFreetext}</div>
         </div>`
      : ""}
  </div>

  <div class="footer">
    <span>Generated by Greenroom &nbsp;·&nbsp; ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
    <span>Confidential — for internal use</span>
  </div>

</body>
</html>`;
}

interface Props {
  data: DealTermsPrintData;
}

export function DealTermsPrint({ data }: Props) {
  function handlePrint() {
    const html = buildHtml(data);
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    // Small delay so the browser renders the content before print dialog
    setTimeout(() => {
      win.print();
    }, 250);
  }

  return (
    <button
      onClick={handlePrint}
      className="flex items-center gap-1.5 text-[11px] text-ink-500 hover:text-ink-900 font-medium transition-colors"
    >
      <FileDown className="h-3.5 w-3.5" />
      Download deal terms PDF
    </button>
  );
}
