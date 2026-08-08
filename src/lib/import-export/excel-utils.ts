import ExcelJS from "exceljs";
import type { RawRow } from "./types";

// ExcelJS cell.value can be a primitive, a Date, or a rich object (formula
// result, rich text runs, hyperlink) depending on how the cell was authored
// — flatten all of those down to what this app actually needs: string |
// number | Date | null. Anything else (formula errors, hyperlinks) is
// treated as absent rather than guessed at.
function cellToPlain(value: ExcelJS.CellValue): string | number | Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "object") {
    if ("result" in value) return cellToPlain(value.result as ExcelJS.CellValue);
    if ("richText" in value) return value.richText.map((r) => r.text).join("");
    if ("text" in value) return String(value.text);
  }
  return null;
}

export function readSheetRows(worksheet: ExcelJS.Worksheet | undefined): RawRow[] {
  if (!worksheet) return [];
  const headerRow = worksheet.getRow(1);
  const headers: (string | null)[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const v = cellToPlain(cell.value);
    headers[colNumber] = typeof v === "string" ? v.trim() : v != null ? String(v) : null;
  });

  const rows: RawRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: RawRow = {};
    let hasAnyValue = false;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (!header) return;
      const v = cellToPlain(cell.value);
      if (typeof v === "string" && v.trim() === "") {
        obj[header] = null;
      } else {
        obj[header] = v;
        if (v !== null) hasAnyValue = true;
      }
    });
    if (hasAnyValue) rows.push(obj);
  });
  return rows;
}

export function str(row: RawRow, key: string): string | null {
  const v = row[key];
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function num(row: RawRow, key: string): number | null {
  const v = row[key];
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

// Accepts a Date cell (Excel's native date type) or a "YYYY-MM-DD" string —
// spreadsheet apps freely convert typed dates to their native date type even
// when the column header just says "YYYY-MM-DD", so both must be handled.
export function dateVal(row: RawRow, key: string): Date | null {
  const v = row[key];
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function addHeaderedSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  columns: readonly string[],
  rows: (string | number | null)[][]
) {
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow([...columns]);
  sheet.getRow(1).font = { bold: true };
  // Several headers (e.g. "পেমেন্ট পদ্ধতি (নগদ/মোবাইল ব্যাংকিং বা
  // ডাউনপেমেন্ট থেকে সমন্বয়)") are far longer than any column needs to be
  // for its actual data — without wrapping, that overflow gets clipped by
  // the next (also non-empty) header cell instead of showing in full, so
  // only the tail end of the title was ever visible. Wrapping + a taller
  // header row fixes that without forcing every column absurdly wide.
  sheet.getRow(1).alignment = { horizontal: "right", vertical: "middle", wrapText: true };
  // Tall enough for the longest header (the meter-reading columns, ~50
  // characters) to wrap across 3-4 lines without clipping.
  sheet.getRow(1).height = 90;
  columns.forEach((_, i) => {
    sheet.getColumn(i + 1).width = 26;
  });
  for (const r of rows) sheet.addRow(r);
  sheet.views = [{ rightToLeft: false, state: "frozen", ySplit: 1 }];
  return sheet;
}

// Restricts a column to a dropdown of allowed values (Excel's native "Data
// > Data Validation > List" UI) — applied a few hundred rows down so it
// still works on rows the user adds later, not just the ones already there.
// The single biggest lever for "user understands what to type" short of a
// full custom form: no more guessing whether it's "পানি" or "Water".
export function addDropdown(sheet: ExcelJS.Worksheet, columnIndex1Based: number, options: readonly string[], lastRow = 300) {
  const formula = `"${options.join(",")}"`;
  for (let r = 2; r <= lastRow; r++) {
    sheet.getCell(r, columnIndex1Based).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: true,
      error: "তালিকা থেকে একটা বেছে নিন",
      errorTitle: "ভুল মান",
    };
  }
}
