import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Expense Auditor",
  description: "בקרת הוצאות אוטומטית מבוססת AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className="bg-gray-50 text-gray-900 min-h-screen font-hebrew">{children}</body>
    </html>
  );
}
