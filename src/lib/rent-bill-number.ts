import { isPaymentMonth } from "@/lib/payment-month";

export function rentBillMarketCode(code: number) {
  return `M${String(code).padStart(2, "0")}`;
}

export function formatRentBillNumber(marketCode: number, month: string, serial: number) {
  return `R-${rentBillMarketCode(marketCode)}-${month.replace("-", "")}-${String(serial).padStart(4, "0")}`;
}

export function legacyRentBillNumber(leaseId: string, month: string) {
  return `R-${month.replace("-", "")}-${leaseId.slice(-10).toUpperCase()}`;
}

function positiveInteger(value: string) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= 2_147_483_647 ? number : null;
}

export function parseRentBillSearch(raw: string) {
  const value = raw.trim().toUpperCase().replace(/[০-৯]/g, (digit) => String(digit.charCodeAt(0) - 0x09e6));
  const full = /^R-M(\d{1,10})-(\d{4})(\d{2})-(\d{1,10})$/.exec(value);
  if (full) {
    const [, code, year, monthPart, sequence] = full;
    const marketCode = positiveInteger(code);
    const serial = positiveInteger(sequence);
    const month = `${year}-${monthPart}`;
    return marketCode && serial && isPaymentMonth(month) ? { kind: "full", marketCode, month, serial } as const : null;
  }
  const legacy = /^R-(\d{4})(\d{2})-([A-Z0-9_-]{1,10})$/.exec(value);
  if (legacy) {
    const [, year, monthPart, suffix] = legacy;
    const month = `${year}-${monthPart}`;
    return isPaymentMonth(month) ? { kind: "legacy", month, suffix, value } as const : null;
  }
  const serial = /^\d{1,10}$/.test(value) ? positiveInteger(value) : null;
  return serial ? { kind: "serial", serial } as const : null;
}
