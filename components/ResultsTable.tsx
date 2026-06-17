import { CATEGORY_LABELS, ReceiptResult } from "@/lib/types";
import { buildViolationsSummary } from "@/lib/policy";
import VerdictBadge from "./VerdictBadge";

interface ResultsTableProps {
  receipts: ReceiptResult[];
  onSelect: (receipt: ReceiptResult) => void;
}

const ROW_BG: Record<string, string> = {
  compliant: "hover:bg-green-50",
  exceeds: "hover:bg-red-50",
  needs_review: "hover:bg-orange-50",
};

export default function ResultsTable({ receipts, onSelect }: ResultsTableProps) {
  if (receipts.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <table className="w-full text-right">
        <thead className="bg-gray-50 text-gray-500 text-sm">
          <tr>
            <th className="px-4 py-3 font-medium">ספק</th>
            <th className="px-4 py-3 font-medium">קטגוריה</th>
            <th className="px-4 py-3 font-medium">תאריך</th>
            <th className="px-4 py-3 font-medium">סכום</th>
            <th className="px-4 py-3 font-medium">פסיקה</th>
            <th className="px-4 py-3 font-medium">סיבה עיקרית</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {receipts.map((r) => (
            <tr
              key={r.id}
              onClick={() => onSelect(r)}
              className={`cursor-pointer transition-colors ${ROW_BG[r.verdict]}`}
            >
              <td className="px-4 py-3">{r.vendor ?? "—"}</td>
              <td className="px-4 py-3">{CATEGORY_LABELS[r.category]}</td>
              <td className="px-4 py-3">{r.date ?? "—"}</td>
              <td className="px-4 py-3">{r.total !== null ? `₪${r.total.toLocaleString()}` : "—"}</td>
              <td className="px-4 py-3">
                <VerdictBadge verdict={r.verdict} />
              </td>
              <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                {buildViolationsSummary(r.violations)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
