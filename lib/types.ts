export type Category =
  | "meals"
  | "lodging"
  | "taxi"
  | "office_supplies"
  | "training"
  | "client_gifts"
  | "other"
  | "unknown";

export type Verdict = "compliant" | "exceeds" | "needs_review";

export type Severity = "high" | "medium" | "low";

export interface Violation {
  rule: string;
  detail: string;
  severity: Severity;
}

export interface ExtractedReceipt {
  vendor: string | null;
  businessNumber: string | null;
  invoiceNumber: string | null;
  employee: string | null;
  department: string | null;
  date: string | null;
  category: Category;
  amountBeforeVat: number | null;
  vatAmount: number | null;
  vatRate: number | null;
  total: number | null;
  paymentMethod: string | null;
  participants: string[] | null;
  businessPurpose: string | null;
  verdict: Verdict;
  violations: Violation[];
  notes: string;
}

export interface ReceiptResult extends ExtractedReceipt {
  id: string;
  fileName: string;
  previewUrl: string;
  fileType: "image" | "pdf";
}

export type ReceiptStatus = "pending" | "processing" | "done" | "error";

export interface UploadedReceipt {
  id: string;
  fileName: string;
  previewUrl: string;
  fileType: "image" | "pdf";
  status: ReceiptStatus;
  result?: ExtractedReceipt;
  error?: string;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  meals: "ארוחות עסקיות",
  lodging: "לינה",
  taxi: "נסיעות מוניות",
  office_supplies: "ציוד משרדי",
  training: "הכשרה וכנסים",
  client_gifts: "מתנות ללקוחות",
  other: "אחר",
  unknown: "לא מזוהה",
};

export const VERDICT_LABELS: Record<Verdict, string> = {
  compliant: "תואם",
  exceeds: "חורג",
  needs_review: "דורש בדיקה אנושית",
};
