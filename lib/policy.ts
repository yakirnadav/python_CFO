import { Category, ReceiptResult, Violation } from "./types";

export const EXPENSE_POLICY_TEXT = `
מדיניות הוצאות — גרסה 3.1

עקרונות כלליים:
- כל הוצאה עסקית טעונה אישור מנהל ישיר וקבלה מקורית.
- הגשה עד ה-5 לחודש הבא.
- הוצאה מעל ₪2,000 מחייבת אישור CFO.

תקרות לפי קטגוריה (תקרה לאירוע / תקרה חודשית / הערות):
- ארוחות עסקיות: ₪180 לאדם / ₪1,500 / חובה: שמות המשתתפים + מטרת הפגישה
- לינה: ₪600 ללילה / לפי צורך / מעל ₪600 — אישור מנהל מחלקה
- נסיעות מוניות: ₪120 לנסיעה / ₪800 / חשבונית עם מספר רכב
- ציוד משרדי: ₪250 לפריט / ₪500 / חובה לציין מטרה עסקית
- הכשרה וכנסים: ₪1,500 לאירוע / ₪3,000 / אישור מנהל מחלקה מראש
- מתנות ללקוחות: ₪200 ללקוח / ₪600 / אסור: אלכוהול, כרטיסי מזומן

תיעוד חובה:
- קבלה מקורית בלבד (לא צילום מסך של אפליקציית תשלום).
- חייבת לכלול: שם ספק, מספר עוסק מורשה, תאריך, סכום + מע"מ מפורטים.
- הוצאות בסוף שבוע (שישי אחה"צ עד מוצ"ש) דורשות הסבר עסקי מפורש.
- הוצאות בחו"ל: לצרף תעריף המרה ביום ההוצאה.

לא מכוסה:
- הוצאות אישיות (כביסה, מינוי ספורט, ספרים לא מקצועיים).
- כרטיסי מתנה / Gift Cards בכל סכום.
- קנסות חנייה ועבירות תנועה.
- הוצאות במזומן מעל ₪400 ללא קבלה.

עדכוני 3.1:
- תקרת ארוחות עסקיות עודכנה מ-₪150 ל-₪180 לאדם.
- נוספה קטגוריה: הכשרה וכנסים.
- חובת מספר עוסק מורשה על כל קבלה מסחרית.
`.trim();

export interface CategoryCap {
  perEvent: number | null;
  monthly: number | null;
  perPerson: boolean;
  label: string;
}

export const CATEGORY_CAPS: Record<Category, CategoryCap> = {
  meals: { perEvent: 180, monthly: 1500, perPerson: true, label: "ארוחות עסקיות" },
  lodging: { perEvent: 600, monthly: null, perPerson: false, label: "לינה" },
  taxi: { perEvent: 120, monthly: 800, perPerson: false, label: "נסיעות מוניות" },
  office_supplies: { perEvent: 250, monthly: 500, perPerson: false, label: "ציוד משרדי" },
  training: { perEvent: 1500, monthly: 3000, perPerson: false, label: "הכשרה וכנסים" },
  client_gifts: { perEvent: 200, monthly: 600, perPerson: false, label: "מתנות ללקוחות" },
  other: { perEvent: null, monthly: null, perPerson: false, label: "אחר" },
  unknown: { perEvent: null, monthly: null, perPerson: false, label: "לא מזוהה" },
};

export const CFO_APPROVAL_THRESHOLD = 2000;

export function expectedVatRate(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const cutoff = new Date("2025-01-01");
  return d < cutoff ? 17 : 18;
}

export function isWeekend(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const day = d.getDay(); // 0=Sun ... 5=Fri 6=Sat
  return day === 5 || day === 6;
}

/**
 * Runs the cross-receipt checks (duplicates + monthly accumulation) that require
 * visibility across the whole uploaded batch, and returns updated results.
 */
export function runBatchChecks(receipts: ReceiptResult[]): ReceiptResult[] {
  const byMonthCategoryEmployee = new Map<string, ReceiptResult[]>();

  for (const r of receipts) {
    if (!r.date || !r.employee) continue;
    const month = r.date.slice(0, 7);
    const key = `${month}|${r.category}|${r.employee}`;
    const arr = byMonthCategoryEmployee.get(key) ?? [];
    arr.push(r);
    byMonthCategoryEmployee.set(key, arr);
  }

  const updated = receipts.map((r) => ({ ...r, violations: [...r.violations] }));
  const byId = new Map(updated.map((r) => [r.id, r]));

  // Monthly accumulation
  for (const [key, group] of byMonthCategoryEmployee) {
    const category = group[0].category;
    const cap = CATEGORY_CAPS[category];
    if (!cap.monthly) continue;
    const sum = group.reduce((acc, r) => acc + (r.total ?? 0), 0);
    if (sum > cap.monthly) {
      for (const r of group) {
        const target = byId.get(r.id)!;
        target.violations.push({
          rule: "צבירה חודשית",
          detail: `סך ההוצאות בקטגוריה "${cap.label}" לעובד זה בחודש זה (₪${sum.toFixed(
            2
          )}) חורג מהתקרה החודשית (₪${cap.monthly}).`,
          severity: "medium",
        });
        if (target.verdict === "compliant") target.verdict = "exceeds";
      }
    }
  }

  // Duplicate detection: same vendor + employee + amount within 7 days
  for (let i = 0; i < updated.length; i++) {
    for (let j = i + 1; j < updated.length; j++) {
      const a = updated[i];
      const b = updated[j];
      if (
        a.vendor &&
        b.vendor &&
        a.vendor === b.vendor &&
        a.employee &&
        b.employee &&
        a.employee === b.employee &&
        a.total !== null &&
        b.total !== null &&
        a.total === b.total &&
        a.date &&
        b.date
      ) {
        const dA = new Date(a.date).getTime();
        const dB = new Date(b.date).getTime();
        if (!isNaN(dA) && !isNaN(dB) && Math.abs(dA - dB) <= 7 * 24 * 60 * 60 * 1000) {
          const detail = `חשד לכפילות עם קבלה אחרת מהספק "${a.vendor}" באותו סכום (₪${a.total}) בטווח של עד 7 ימים.`;
          a.violations.push({ rule: "חשד לכפילות", detail, severity: "low" });
          b.violations.push({ rule: "חשד לכפילות", detail, severity: "low" });
        }
      }
    }
  }

  return updated;
}

export function buildViolationsSummary(violations: Violation[]): string {
  if (violations.length === 0) return "—";
  const sorted = [...violations].sort((a, b) => {
    const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });
  return sorted[0].detail;
}
