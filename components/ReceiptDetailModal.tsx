import { CATEGORY_LABELS, ReceiptResult } from "@/lib/types";
import VerdictBadge from "./VerdictBadge";

interface ReceiptDetailModalProps {
  receipt: ReceiptResult;
  onClose: () => void;
}

const SEVERITY_STYLES: Record<string, string> = {
  high: "bg-red-50 border-red-200 text-red-700",
  medium: "bg-orange-50 border-orange-200 text-orange-700",
  low: "bg-yellow-50 border-yellow-200 text-yellow-700",
};

const SEVERITY_LABELS: Record<string, string> = {
  high: "חומרה גבוהה",
  medium: "חומרה בינונית",
  low: "חומרה נמוכה",
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-sm font-medium text-gray-800">{value || "—"}</div>
    </div>
  );
}

export default function ReceiptDetailModal({ receipt: r, onClose }: ReceiptDetailModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">{r.fileName}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          <div>
            {r.fileType === "image" ? (
              <img src={r.previewUrl} alt={r.fileName} className="rounded-lg border border-gray-200 w-full" />
            ) : (
              <embed src={r.previewUrl} type="application/pdf" className="w-full h-96 rounded-lg border border-gray-200" />
            )}
          </div>

          <div className="space-y-4">
            <div>
              <VerdictBadge verdict={r.verdict} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="ספק" value={r.vendor ?? ""} />
              <Field label="מספר עוסק מורשה" value={r.businessNumber ?? ""} />
              <Field label="מספר חשבונית" value={r.invoiceNumber ?? ""} />
              <Field label="עובד" value={r.employee ?? ""} />
              <Field label="מחלקה" value={r.department ?? ""} />
              <Field label="תאריך" value={r.date ?? ""} />
              <Field label="קטגוריה" value={CATEGORY_LABELS[r.category]} />
              <Field label="אמצעי תשלום" value={r.paymentMethod ?? ""} />
              <Field label="סכום לפני מע&quot;מ" value={r.amountBeforeVat !== null ? `₪${r.amountBeforeVat}` : ""} />
              <Field label="מע&quot;מ" value={r.vatAmount !== null ? `₪${r.vatAmount}` : ""} />
              <Field label="שיעור מע&quot;מ" value={r.vatRate !== null ? `${r.vatRate}%` : ""} />
              <Field label="סה&quot;כ" value={r.total !== null ? `₪${r.total}` : ""} />
            </div>

            <Field label="משתתפים" value={r.participants?.join(", ") ?? ""} />
            <Field label="מטרה עסקית" value={r.businessPurpose ?? ""} />

            {r.violations.length > 0 && (
              <div>
                <div className="text-xs text-gray-400 mb-2">הפרות שזוהו</div>
                <div className="space-y-2">
                  {r.violations.map((v, i) => (
                    <div key={i} className={`border rounded-lg p-3 text-sm ${SEVERITY_STYLES[v.severity]}`}>
                      <div className="font-semibold">
                        {v.rule} <span className="text-xs">({SEVERITY_LABELS[v.severity]})</span>
                      </div>
                      <div className="mt-1">{v.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {r.notes && (
              <div>
                <div className="text-xs text-gray-400">הערות</div>
                <div className="text-sm text-gray-700">{r.notes}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
