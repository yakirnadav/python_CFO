import { CATEGORY_LABELS, ReceiptResult, VERDICT_LABELS } from "./types";

const HEADERS = [
  "שם ספק",
  "מספר עוסק מורשה",
  "מספר חשבונית",
  "עובד",
  "מחלקה",
  "תאריך",
  "קטגוריה",
  "סכום לפני מע\"מ",
  "מע\"מ",
  "שיעור מע\"מ",
  "סה\"כ",
  "אמצעי תשלום",
  "משתתפים",
  "מטרה עסקית",
  "פסיקה",
  "הפרות",
  "הערות",
];

function csvEscape(value: string): string {
  const needsQuotes = /[",\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

export function exportToCsv(receipts: ReceiptResult[]): void {
  const rows = receipts.map((r) => [
    r.vendor ?? "",
    r.businessNumber ?? "",
    r.invoiceNumber ?? "",
    r.employee ?? "",
    r.department ?? "",
    r.date ?? "",
    CATEGORY_LABELS[r.category],
    r.amountBeforeVat?.toString() ?? "",
    r.vatAmount?.toString() ?? "",
    r.vatRate?.toString() ?? "",
    r.total?.toString() ?? "",
    r.paymentMethod ?? "",
    r.participants?.join("; ") ?? "",
    r.businessPurpose ?? "",
    VERDICT_LABELS[r.verdict],
    r.violations.map((v) => `${v.rule}: ${v.detail}`).join(" | "),
    r.notes ?? "",
  ]);

  const lines = [HEADERS, ...rows].map((row) => row.map((c) => csvEscape(String(c))).join(","));
  const csvContent = "﻿" + lines.join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `expense-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
