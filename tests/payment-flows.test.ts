import assert from "node:assert/strict";
import test from "node:test";

import {
  applyRentInstallment,
  applyUtilityBillInstallment,
  isRentPaymentSettled,
} from "@/lib/payment-progress";
import {
  nextPaymentMonth,
  paymentMonthDueDate,
  paymentMonthRange,
  previousPaymentMonth,
  resolvePaymentMonth,
  resolveInvoiceMonth,
  resolveRentCollectionMonth,
} from "@/lib/payment-month";
import { localizedMutationPaths } from "@/lib/localized-revalidation";
import { transactionReportRange } from "@/lib/monthly-transaction-report";
import { reportingMonthKey } from "@/lib/reporting-period";
import { withRentActionFeedback } from "@/lib/rent-action-feedback";
import { rentTermsDueAmount, resolveRentTermsForMonth } from "@/lib/rent-terms";
import { allocateInvoicePayment, invoicePaymentSnapshot, reconcileInvoiceAllocation, type InvoicePaymentLine } from "@/lib/invoice-payment";
import { allocateRentPayment, buildRentLedger } from "@/lib/rent-ledger";
import { validateTenantUtilityBills } from "@/lib/utility-bill-entry";

test("rent payment can settle September when money arrives in October", () => {
  assert.equal(resolvePaymentMonth("2026-09", "2026-10-03"), "2026-09");
});

test("older payment forms still fall back to the payment date month", () => {
  assert.equal(resolvePaymentMonth(null, "2026-10-03"), "2026-10");
});

test("invalid billing months are rejected", () => {
  assert.throws(() => resolvePaymentMonth("2026-13", "2026-10-03"), /Invalid billing month/);
});

test("the previous-month shortcut handles year boundaries", () => {
  assert.equal(previousPaymentMonth("2026-10"), "2026-09");
  assert.equal(previousPaymentMonth("2026-01"), "2025-12");
});

test("the next-month shortcut handles year boundaries", () => {
  assert.equal(nextPaymentMonth("2026-10"), "2026-11");
  assert.equal(nextPaymentMonth("2026-12"), "2027-01");
});

test("historical arrears ranges include every month across year boundaries", () => {
  assert.deepEqual(paymentMonthRange("2025-11", "2026-02"), ["2025-11", "2025-12", "2026-01", "2026-02"]);
});

test("historical arrears ranges reject reversed and excessive ranges", () => {
  assert.throws(() => paymentMonthRange("2026-02", "2026-01"), /Invalid billing month range/);
  assert.throws(() => paymentMonthRange("2023-01", "2026-02"), /Invalid billing month range/);
});

test("moving a payment to another billing month recalculates its due date", () => {
  const dueDate = paymentMonthDueDate("2026-09", 10);
  assert.equal(dueDate.getFullYear(), 2026);
  assert.equal(dueDate.getMonth(), 8);
  assert.equal(dueDate.getDate(), 10);
});

test("a repeated submission for a fully paid rent month is treated as settled", () => {
  assert.equal(isRentPaymentSettled(15_000, 15_000), true);
  assert.equal(isRentPaymentSettled(15_000, 10_000), false);
});

test("rent mutations invalidate the return page, rent collection, dashboard, and reports", () => {
  assert.deepEqual(localizedMutationPaths("bn", "/rent"), ["/bn/rent", "/bn", "/bn/reports"]);
  assert.deepEqual(localizedMutationPaths("en", "/"), ["/en", "/en/rent", "/en/reports"]);
});

test("dashboard and reports attribute late rent payments to their billing month", () => {
  assert.equal(
    reportingMonthKey({
      transactionType: "RENT_RECEIVED_FROM_TENANT",
      transactionDate: new Date(2026, 9, 10),
      rentPaymentMonth: "2026-09",
    }),
    "2026-09"
  );
  assert.equal(
    reportingMonthKey({
      transactionType: "MAINTENANCE_EXPENSE",
      transactionDate: new Date(2026, 9, 10),
      rentPaymentMonth: null,
    }),
    "2026-10"
  );
});

test("rent feedback keeps the selected collection month in the return URL", () => {
  assert.equal(
    withRentActionFeedback("/rent?month=2026-09", "recorded", { month: "2026-09", amount: 15_000 }),
    "/rent?month=2026-09&rentResult=recorded&rentMonth=2026-09&rentAmount=15000"
  );
});

test("rent can be paid in two installments", () => {
  const first = applyRentInstallment({
    dueAmount: 20_000,
    alreadyPaid: 0,
    paymentAmount: 8_000,
  });
  assert.deepEqual(first, { totalPaid: 8_000, status: "PARTIAL" });

  const second = applyRentInstallment({
    dueAmount: 20_000,
    alreadyPaid: first.totalPaid,
    paymentAmount: 12_000,
  });
  assert.deepEqual(second, { totalPaid: 20_000, status: "PAID" });
});

test("rent installments cannot exceed the remaining balance", () => {
  assert.throws(
    () =>
      applyRentInstallment({
        dueAmount: 20_000,
        alreadyPaid: 8_000,
        paymentAmount: 12_001,
      }),
    /exceeds remaining rent/
  );
});

test("rent increases take effect only from their configured month", () => {
  const fallback = {
    monthlyRentAmount: 20_000,
    serviceChargeType: null,
    serviceChargeValue: null,
  } as const;
  const rates = [
    { ...fallback, effectiveMonth: "2026-01" },
    { ...fallback, effectiveMonth: "2026-11", monthlyRentAmount: 22_000 },
  ];

  assert.equal(rentTermsDueAmount(resolveRentTermsForMonth(fallback, rates, "2026-10")), 20_000);
  assert.equal(rentTermsDueAmount(resolveRentTermsForMonth(fallback, rates, "2026-11")), 22_000);
});

test("a historical correction preserves the earlier zero-rent period", () => {
  const latestFallback = {
    monthlyRentAmount: 15_000,
    serviceChargeType: null,
    serviceChargeValue: null,
  } as const;
  const rates = [
    { ...latestFallback, effectiveMonth: "2026-07", monthlyRentAmount: 0 },
    { ...latestFallback, effectiveMonth: "2026-08" },
  ];

  assert.equal(rentTermsDueAmount(resolveRentTermsForMonth(latestFallback, rates, "2026-07")), 0);
  assert.equal(rentTermsDueAmount(resolveRentTermsForMonth(latestFallback, rates, "2026-08")), 15_000);
  assert.equal(rentTermsDueAmount(resolveRentTermsForMonth(latestFallback, rates, "2026-10")), 15_000);
});

test("a recorded partial bill keeps its original due after a later rent increase", () => {
  const fallback = {
    monthlyRentAmount: 22_000,
    serviceChargeType: null,
    serviceChargeValue: null,
  } as const;
  const rates = [
    { ...fallback, effectiveMonth: "2026-01", monthlyRentAmount: 20_000 },
    { ...fallback, effectiveMonth: "2026-11" },
  ];
  const ledger = buildRentLedger(
    new Date(2026, 0, 1),
    (month) => rentTermsDueAmount(resolveRentTermsForMonth(fallback, rates, month)),
    [
      {
        id: "october",
        month: "2026-10",
        dueDate: new Date(2026, 9, 10),
        dueAmount: 20_000,
        paidAmount: 8_000,
        status: "PARTIAL",
        paidAt: new Date(2026, 9, 8),
      },
    ],
    new Date(2026, 10, 11)
  );

  assert.equal(ledger.find((entry) => entry.month === "2026-10")?.dueAmount, 20_000);
  assert.equal(ledger.find((entry) => entry.month === "2026-11")?.dueAmount, 22_000);
});

test("utility bill can be paid in two installments", () => {
  const first = applyUtilityBillInstallment({
    totalAmount: 1_000,
    alreadyPaid: 0,
    tenantPaymentAmount: 400,
    companyCoversRest: false,
  });
  assert.deepEqual(first, {
    billPortion: 400,
    profitAmount: 0,
    companyAmount: 0,
    newPaidAmount: 400,
    status: "PARTIAL",
  });

  const second = applyUtilityBillInstallment({
    totalAmount: 1_000,
    alreadyPaid: first.newPaidAmount,
    tenantPaymentAmount: 600,
    companyCoversRest: false,
  });
  assert.deepEqual(second, {
    billPortion: 600,
    profitAmount: 0,
    companyAmount: 0,
    newPaidAmount: 1_000,
    status: "PAID",
  });
});

test("oldest-first arrears preview settles full or partial payments against remaining balances", () => {
  const balances = [
    { month: "2026-09", gap: 8_000 },
    { month: "2026-10", gap: 10_000 },
  ];
  assert.deepEqual(allocateRentPayment(balances, 18_000), [
    { ...balances[0], amount: 8_000 },
    { ...balances[1], amount: 10_000 },
  ]);
  assert.deepEqual(allocateRentPayment(balances, 12_000), [
    { ...balances[0], amount: 8_000 },
    { ...balances[1], amount: 4_000 },
  ]);
  assert.deepEqual(allocateRentPayment([{ ...balances[0], gap: 2_000 }, balances[1]], 3_000), [
    { ...balances[0], gap: 2_000, amount: 2_000 },
    { ...balances[1], amount: 1_000 },
  ]);
});

test("invoice partial payment settles older rent and utility before the selected month", () => {
  const lines: InvoicePaymentLine[] = [
    { id: "2026-11", month: "2026-11", kind: "rent", remainingCents: 600000 },
    { id: "gas", month: "2026-10", kind: "utility", remainingCents: 3500 },
    { id: "2026-10", month: "2026-10", kind: "rent", remainingCents: 33975 },
  ];

  assert.deepEqual(allocateInvoicePayment(lines, 40000).map(({ id, paidCents }) => [id, paidCents]), [
    ["2026-10", 33975], ["gas", 3500], ["2026-11", 2525],
  ]);
  assert.equal(invoicePaymentSnapshot(lines), invoicePaymentSnapshot([...lines].reverse()));
  assert.notEqual(invoicePaymentSnapshot(lines), invoicePaymentSnapshot([{ ...lines[0], remainingCents: 597475 }, ...lines.slice(1)]));
});

test("a short receipt can pay electricity in full and leave the difference on rent", () => {
  const rent = { id: "2026-11", month: "2026-11", kind: "rent", remainingCents: 1_000_000 } as const;
  const power = { id: "power", month: "2026-11", kind: "utility", remainingCents: 100_000 } as const;
  const lines = [rent, power];
  assert.deepEqual(reconcileInvoiceAllocation(lines, 900_000, [[rent.id, 800_000], [power.id, 100_000]]), [
    { ...rent, paidCents: 800_000 }, { ...power, paidCents: 100_000 },
  ]);
  for (const input of [
    [[rent.id, 900_000], [power.id, 1]],
    [[rent.id, 750_000], [power.id, 150_000]],
    [[rent.id, 800_000], ["another-tenant-bill", 100_000]],
    [[rent.id, 800_000], [rent.id, 100_000]],
    [[rent.id, 900_000.5]],
    [[rent.id, 900_001], [power.id, -1]],
  ]) assert.equal(reconcileInvoiceAllocation(lines, 900_000, input), null);
});

test("tenant billing accepts different charges but rejects the same charge twice in a month", () => {
  function bill(type: string, dueDate: string) {
    const form = new FormData();
    form.set("type", type);
    form.set("amount", "100");
    form.set("dueDate", dueDate);
    return form;
  }

  const gas = bill("GAS", "2026-11-07");
  assert.equal(validateTenantUtilityBills("2026-11", [gas, bill("SECURITY", "2026-11-08")]).ok, true);
  assert.deepEqual(validateTenantUtilityBills("2026-11", [gas, bill("GAS", "2026-11-08")]), {
    ok: false, error: "utilityBillDuplicateMonth",
  });
});


test("November collection defaults to October rent and allows November explicitly", () => {
  assert.equal(resolveRentCollectionMonth(undefined, "2026-11"), "2026-10");
  assert.equal(resolveRentCollectionMonth("2026-11", "2026-11"), "2026-11");
  assert.equal(resolveRentCollectionMonth("2026-08", "2026-11"), "2026-08");
  assert.equal(resolveRentCollectionMonth(undefined, "2027-01"), "2026-12");
  assert.equal(resolveRentCollectionMonth("2026-13", "2026-11"), "2026-10");
  assert.equal(resolveRentCollectionMonth("2026-12", "2026-11"), "2026-10");
});

test("October rent received in November settles October while reporting November income", () => {
  const receivedDate = "2026-11-08";
  const rentMonth = resolveRentCollectionMonth(undefined, "2026-11");
  assert.equal(resolvePaymentMonth(rentMonth, receivedDate), "2026-10");
  const transactionDate = new Date(`${receivedDate}T00:00:00+06:00`);
  const november = transactionReportRange("2026-11");
  const october = transactionReportRange("2026-10");
  assert.ok(transactionDate >= november.start && transactionDate < november.end);
  assert.ok(transactionDate >= october.end);
});


test("invoice picker opens September even when only August and October have records", () => {
  const months = ["2026-11", "2026-10", "2026-08"];
  assert.equal(resolveInvoiceMonth("2026-09", months, "2023-12", "2026-11"), "2026-09");
  assert.equal(resolveInvoiceMonth("2026-01", months, "2023-12", "2026-11"), "2026-01");
  assert.equal(resolveInvoiceMonth("2023-11", months, "2023-12", "2026-11"), "2026-11");
  assert.equal(resolveInvoiceMonth("2026-13", months, "2023-12", "2026-11"), "2026-11");
});
