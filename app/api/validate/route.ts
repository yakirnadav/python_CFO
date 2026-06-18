import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { EXPENSE_POLICY_TEXT, expectedVatRate, isWeekend } from "@/lib/policy";
import { ExtractedReceipt } from "@/lib/types";

// Single place to change the model used for extraction + validation.
const MODEL = "claude-sonnet-4-6";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `אתה רכז בקרת הוצאות (Expense Auditor) של חברה ישראלית. אתה מקבל קבלה (תמונה או PDF) ועליך:

1. לחלץ ממנה את כל השדות הנדרשים במדויק, כפי שהם מופיעים בקבלה. אם שדה לא קיים או לא ניתן לקרוא אותו בבירור — החזר null. אל תמציא ערכים בשום מקרה.
2. להפעיל את מדיניות ההוצאות הבאה ולקבוע פסיקה (verdict):

${EXPENSE_POLICY_TEXT}

כלל ברזל: לעולם אל תחזיר verdict="compliant" אם יש לך ספק כלשהו לגבי הקבלה, אם איכות התמונה לא מאפשרת קריאה בטוחה של שדה קריטי, אם הקטגוריה לא ברורה, או אם חלק מהתיעוד החובה חסר. במקרה של ספק — verdict="needs_review" (ולא "exceeds" ולא "compliant").

הנחיות לקביעת verdict:
- "compliant": כל השדות הקריטיים ברורים, אין חריגה מהתקרות, יש תיעוד חובה מלא, ואין שום ספק.
- "exceeds": יש חריגה ברורה ומאומתת מהמדיניות (תקרה לאירוע, סכום מעל ₪2,000 בלי אישור CFO, חסר מספר עוסק מורשה, חסר פירוט מע"מ, הוצאה לא מכוסה וכו').
- "needs_review": כל מקרה של ספק, איכות תמונה גרועה, שדה קריטי חסר/לא קריא, קטגוריה לא ברורה (unknown), או הוצאה בסוף שבוע בלי מטרה עסקית מפורשת.

כל הפרה שאתה מזהה (גם אם היא לא משנה את הפסיקה הסופית) צריכה להופיע במערך violations עם נימוק ספציפי וברור בעברית.

קריטי: התשובה שלך חייבת להתחיל ב-{ ולהסתיים ב-} בלבד. אסור שהתגובה תכלול שום טקסט לפני ה-{ הפותח (כגון "אני אבדוק..." או הסברים), שום טקסט אחרי ה-} הסוגר, ושום code fence או Markdown. החזר אך ורק את אובייקט ה-JSON התואם בדיוק לסכימה הזו:

{
  "vendor": "string | null",
  "businessNumber": "string | null",
  "invoiceNumber": "string | null",
  "employee": "string | null",
  "department": "string | null",
  "date": "YYYY-MM-DD | null",
  "category": "meals | lodging | taxi | office_supplies | training | client_gifts | other | unknown",
  "amountBeforeVat": "number | null",
  "vatAmount": "number | null",
  "vatRate": "number | null",
  "total": "number | null",
  "paymentMethod": "string | null",
  "participants": "string[] | null",
  "businessPurpose": "string | null",
  "verdict": "compliant | exceeds | needs_review",
  "violations": [{ "rule": "string", "detail": "string", "severity": "high | medium | low" }],
  "notes": "string"
}`;

function extractJson(text: string): any {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return JSON.parse(fenced[1]);

  // Model may prepend/append explanatory text around the JSON object —
  // fall back to the outermost {...} span.
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("לא נמצא JSON בתשובת המודל");
  }
  return JSON.parse(trimmed.slice(start, end + 1));
}

function fallbackResult(rawText: string): ExtractedReceipt {
  return {
    vendor: null,
    businessNumber: null,
    invoiceNumber: null,
    employee: null,
    department: null,
    date: null,
    category: "unknown",
    amountBeforeVat: null,
    vatAmount: null,
    vatRate: null,
    total: null,
    paymentMethod: null,
    participants: null,
    businessPurpose: null,
    verdict: "needs_review",
    violations: [
      {
        rule: "כשל בחילוץ אוטומטי",
        detail: "המודל לא החזיר תשובה תקינה לקבלה זו ולכן היא מחייבת בדיקה אנושית מלאה.",
        severity: "high",
      },
    ],
    notes: rawText.slice(0, 500),
  };
}

function applyDeterministicChecks(data: ExtractedReceipt): ExtractedReceipt {
  const violations = [...data.violations];
  let verdict = data.verdict;

  const expectedRate = expectedVatRate(data.date);
  if (expectedRate !== null && data.vatRate !== null && data.vatRate !== expectedRate) {
    violations.push({
      rule: "התאמת מע\"מ לתאריך",
      detail: `שיעור המע"מ שדווח (${data.vatRate}%) לא תואם לשיעור החל בתאריך הקבלה (${expectedRate}%).`,
      severity: "medium",
    });
    if (verdict === "compliant") verdict = "needs_review";
  }

  if (isWeekend(data.date) && !data.businessPurpose) {
    violations.push({
      rule: "הוצאה בסוף שבוע",
      detail: "ההוצאה התרחשה בסוף שבוע (שישי/שבת) ולא צוינה מטרה עסקית מפורשת.",
      severity: "medium",
    });
    verdict = "needs_review";
  }

  if (!data.businessNumber) {
    violations.push({
      rule: "מספר עוסק מורשה חסר",
      detail: "לא ניתן לזהות מספר עוסק מורשה על הקבלה, בניגוד לדרישת המדיניות.",
      severity: "high",
    });
    if (verdict === "compliant") verdict = "needs_review";
  }

  if (data.total !== null && data.total > 2000) {
    violations.push({
      rule: "אישור CFO",
      detail: `הסכום הכולל (₪${data.total}) עולה על ₪2,000 ומחייב אישור CFO.`,
      severity: "high",
    });
    if (verdict === "compliant") verdict = "exceeds";
  }

  if (data.category === "unknown") {
    if (verdict === "compliant") verdict = "needs_review";
  }

  return { ...data, violations, verdict };
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY לא מוגדר בסביבת השרת." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { base64Data, mediaType, fileType } = body as {
      base64Data: string;
      mediaType: string;
      fileType: "image" | "pdf";
    };

    if (!base64Data || !mediaType || !fileType) {
      return NextResponse.json({ error: "קלט חסר." }, { status: 400 });
    }

    const contentBlock =
      fileType === "pdf"
        ? {
            type: "document" as const,
            source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64Data },
          }
        : {
            type: "image" as const,
            source: { type: "base64" as const, media_type: mediaType as any, data: base64Data },
          };

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            contentBlock,
            {
              type: "text",
              text: "חלץ את הנתונים מהקבלה הזו ובדוק אותה מול מדיניות ההוצאות. החזר JSON בלבד.",
            },
          ] as any,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("לא התקבלה תשובת טקסט מהמודל.");
    }

    const rawText = textBlock.text;

    let parsed: ExtractedReceipt;
    try {
      parsed = extractJson(rawText) as ExtractedReceipt;
    } catch (parseErr) {
      console.error("JSON parse failure, falling back to needs_review:", parseErr, rawText);
      return NextResponse.json(fallbackResult(rawText));
    }

    const finalResult = applyDeterministicChecks(parsed);

    return NextResponse.json(finalResult);
  } catch (err) {
    console.error("Validation error:", err);
    const message = err instanceof Error ? err.message : "שגיאה לא ידועה";
    return NextResponse.json({ error: `שגיאה בעיבוד הקבלה: ${message}` }, { status: 500 });
  }
}
