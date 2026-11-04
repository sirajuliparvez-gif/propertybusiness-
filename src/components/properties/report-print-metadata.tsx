"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { formatDate } from "@/lib/format";

export function ReportPrintMetadata({ initialDate, locale, dateLabel, pageLabel, title, month, pageName = "monthlyRentReport" }: {
  initialDate: string;
  locale: string;
  dateLabel: string;
  pageLabel: string;
  title: string;
  month: string;
  pageName?: "monthlyRentReport" | "monthlyFinancialReport" | "monthlyUtilityReport" | "monthlySalaryReport" | "monthlyTransactionReport" | "rentArrearsReport";
}) {
  const [printDate, setPrintDate] = useState(initialDate);
  useEffect(() => {
    // Also handles keyboard printing after the page has remained open overnight.
    const updateDate = () => flushSync(() => setPrintDate(formatDate(new Date(), locale)));
    window.addEventListener("beforeprint", updateDate);
    return () => window.removeEventListener("beforeprint", updateDate);
  }, [locale]);
  return <>
    <p>{dateLabel}: {printDate}</p>
    <style>{`@page ${pageName} {
      size: A4 landscape;
      margin: 18mm 12mm;
      @top-left { content: ${JSON.stringify(title)}; font-family: var(--font-sans), sans-serif; font-size: 10pt; font-weight: 600; color: #222; }
      @top-right { content: ${JSON.stringify(month)}; font-family: var(--font-sans), sans-serif; font-size: 10pt; color: #444; }
      @bottom-left { content: ${JSON.stringify(`${dateLabel}: ${printDate}`)}; font-family: var(--font-sans), sans-serif; font-size: 9pt; color: #444; }
      @bottom-right { content: ${JSON.stringify(`${pageLabel} `)} counter(page) " / " counter(pages); font-family: var(--font-sans), sans-serif; font-size: 9pt; color: #444; }
    }`}</style>
  </>;
}
