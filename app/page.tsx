"use client";

import { useCallback, useMemo, useState } from "react";
import UploadZone from "@/components/UploadZone";
import SummaryCards from "@/components/SummaryCards";
import ResultsTable from "@/components/ResultsTable";
import ReceiptDetailModal from "@/components/ReceiptDetailModal";
import { runBatchChecks } from "@/lib/policy";
import { exportToCsv } from "@/lib/csvExport";
import { ReceiptResult, UploadedReceipt } from "@/lib/types";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getFileType(file: File): "image" | "pdf" {
  return file.type === "application/pdf" ? "pdf" : "image";
}

export default function Home() {
  const [receipts, setReceipts] = useState<UploadedReceipt[]>([]);
  const [selected, setSelected] = useState<ReceiptResult | null>(null);

  const processedReceipts: ReceiptResult[] = useMemo(() => {
    const done = receipts.filter(
      (r): r is UploadedReceipt & { result: NonNullable<UploadedReceipt["result"]> } =>
        r.status === "done" && !!r.result
    );
    const mapped: ReceiptResult[] = done.map((r) => ({
      ...r.result,
      id: r.id,
      fileName: r.fileName,
      previewUrl: r.previewUrl,
      fileType: r.fileType,
    }));
    return runBatchChecks(mapped);
  }, [receipts]);

  const handleFilesSelected = useCallback((files: File[]) => {
    const newEntries: UploadedReceipt[] = files.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      fileName: file.name,
      previewUrl: URL.createObjectURL(file),
      fileType: getFileType(file),
      status: "pending",
    }));

    setReceipts((prev) => [...prev, ...newEntries]);

    newEntries.forEach(async (entry, idx) => {
      const file = files[idx];
      setReceipts((prev) =>
        prev.map((r) => (r.id === entry.id ? { ...r, status: "processing" } : r))
      );
      try {
        const base64Data = await fileToBase64(file);
        const res = await fetch("/api/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base64Data,
            mediaType: file.type,
            fileType: entry.fileType,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "שגיאה בעיבוד");
        setReceipts((prev) =>
          prev.map((r) => (r.id === entry.id ? { ...r, status: "done", result: data } : r))
        );
      } catch (err) {
        setReceipts((prev) =>
          prev.map((r) =>
            r.id === entry.id
              ? { ...r, status: "error", error: err instanceof Error ? err.message : "שגיאה" }
              : r
          )
        );
      }
    });
  }, []);

  const pendingCount = receipts.filter((r) => r.status === "pending" || r.status === "processing").length;
  const errorReceipts = receipts.filter((r) => r.status === "error");

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-brand">Expense Auditor</h1>
          <p className="text-gray-500 mt-1">בקרת הוצאות אוטומטית מבוססת AI — תואם למדיניות ההוצאות גרסה 3.1</p>
        </div>
        {processedReceipts.length > 0 && (
          <button
            onClick={() => exportToCsv(processedReceipts)}
            className="bg-brand hover:bg-brand-dark text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
          >
            ייצוא ל-CSV
          </button>
        )}
      </header>

      <UploadZone onFilesSelected={handleFilesSelected} />

      {pendingCount > 0 && (
        <div className="text-sm text-gray-500">מעבד {pendingCount} קבלות...</div>
      )}

      {errorReceipts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {errorReceipts.map((r) => (
            <div key={r.id}>
              {r.fileName}: {r.error}
            </div>
          ))}
        </div>
      )}

      {processedReceipts.length > 0 && (
        <>
          <SummaryCards receipts={processedReceipts} />
          <ResultsTable receipts={processedReceipts} onSelect={setSelected} />
        </>
      )}

      {selected && <ReceiptDetailModal receipt={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}
