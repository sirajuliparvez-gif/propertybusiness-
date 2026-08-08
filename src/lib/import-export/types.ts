export type RowError = { sheet: string; row: number; message: string };
export type SheetResult = { sheet: string; created: number; errors: RowError[] };
export type ImportResult = { results: SheetResult[]; totalCreated: number; totalErrors: number };

// Row shape after header-mapping: plain object keyed by the sheet's Bengali
// column headers, values as ExcelJS gives them (string | number | Date | null).
export type RawRow = Record<string, string | number | Date | null>;
