import { Verdict, VERDICT_LABELS } from "@/lib/types";

const STYLES: Record<Verdict, string> = {
  compliant: "bg-green-100 text-compliant border-green-300",
  exceeds: "bg-red-100 text-exceeds border-red-300",
  needs_review: "bg-orange-100 text-review border-orange-300",
};

const ICONS: Record<Verdict, string> = {
  compliant: "✓",
  exceeds: "✕",
  needs_review: "!",
};

export default function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-sm font-medium ${STYLES[verdict]}`}
    >
      <span>{ICONS[verdict]}</span>
      <span>{VERDICT_LABELS[verdict]}</span>
    </span>
  );
}
