import { ReceiptResult } from "@/lib/types";

export default function SummaryCards({ receipts }: { receipts: ReceiptResult[] }) {
  const total = receipts.length;
  const compliant = receipts.filter((r) => r.verdict === "compliant").length;
  const exceeds = receipts.filter((r) => r.verdict === "exceeds").length;
  const needsReview = receipts.filter((r) => r.verdict === "needs_review").length;
  const totalAmount = receipts.reduce((acc, r) => acc + (r.total ?? 0), 0);

  const cards = [
    { label: "סך קבלות", value: total, color: "text-gray-800" },
    { label: "תואם", value: compliant, color: "text-compliant" },
    { label: "חורג", value: exceeds, color: "text-exceeds" },
    { label: "דורש בדיקה", value: needsReview, color: "text-review" },
    { label: "סכום כולל", value: `₪${totalAmount.toLocaleString()}`, color: "text-brand" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
          <div className="text-sm text-gray-500 mt-1">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
