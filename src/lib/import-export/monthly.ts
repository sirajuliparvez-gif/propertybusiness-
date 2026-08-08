import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { addHeaderedSheet, addDropdown } from "./excel-utils";
import { computeServiceChargeAmount } from "@/lib/service-charge";
import { paymentMethodToBengali, utilityTypeToBengali, yesNoToBengali } from "./enums";
import { attachElectricityConsumption, latestElectricityReadingByUnit } from "@/lib/electricity-consumption";
import {
  SHEET_NAMES,
  RENT_PAYMENT_COLUMNS,
  OWNER_RENT_PAYMENT_COLUMNS,
  UTILITY_BILL_COLUMNS,
  PAYROLL_COLUMNS,
  EXPENSE_COLUMNS,
  UTILITY_TYPE_OPTIONS,
  YES_NO_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  EXPENSE_CATEGORY_OPTIONS,
  RENT_PAYMENT_MODE_OPTIONS,
} from "./sheets";

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function ymd(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : "";
}

// Dropdown source for the "select a property" step on the Import/Export
// page — one property at a time, per the user's explicit preference over an
// all-properties-at-once sheet ("sob ek shathe korte gele jhamela hoie jai").
export async function getPropertiesForMonthlyEntry() {
  return prisma.property.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

function addMonthlyInstructions(workbook: ExcelJS.Workbook, monthKey: string, propertyName: string) {
  const sheet = workbook.addWorksheet(SHEET_NAMES.INSTRUCTIONS);
  sheet.getColumn(1).width = 100;
  const lines = [
    `${propertyName} — ${monthKey} মাসের বাল্ক এন্ট্রি`,
    "",
    "আপনার এই প্রপার্টির বর্তমান সব সক্রিয় ইউনিট, টেন্যান্ট ও কর্মচারীর তালিকা প্রতিটা শীটে আগে থেকেই ভরা আছে — নতুন করে কোনো নাম টাইপ করা লাগবে না।",
    "",
    "১) যেসব প্রপার্টি/টেন্যান্ট/কর্মচারীর জন্য এই মাসে টাকা পেয়েছেন বা দিয়েছেন, শুধু তাদের সারিতে পরিমাণ, তারিখ ও মাধ্যম লিখুন।",
    "",
    "২) যাদের এখনো টাকা পাননি/দেননি, তাদের সারি খালি রেখে দিন — কোনো সমস্যা নেই, সেই সারি এবারের আপলোডে বাদ যাবে, পরে আলাদাভাবে অ্যাপ থেকে বা পরের মাসের শীট দিয়ে দিতে পারবেন।",
    "",
    "৩) এই মাসে যাদের টাকা ইতিমধ্যে রেকর্ড হয়ে গেছে (আগে একবার আপলোড করে দিয়েছেন), তাদের সারিতে পরিমাণ আগে থেকেই ভরা দেখাবে — সেটা না বদলে আবার আপলোড করলেও কোনো সমস্যা নেই, দ্বিতীয়বার যোগ হবে না। শুধু নতুন করে ফাঁকা থেকে ভরা সারিগুলোই নতুন হিসেবে রেকর্ড হবে।",
    "",
    "৪) 'ইউটিলিটি বিল' শীটে যেসব বিল এই মাসে আগেই দেওয়া আছে সেগুলো নিজের সারিতে ভরা দেখাবে, আর প্রতিটা ইউনিটের জন্য একটা করে খালি সারি থাকবে নতুন বিল যোগ করার জন্য। একই ইউনিটে একই মাসে একাধিক আলাদা বিল থাকলে (যেমন গ্যাস ও বিদ্যুৎ দুটোই নতুন), সেই ইউনিটের সারিটা কপি করে ঠিক নিচে আরেকটা সারি বানান (প্রপার্টি ও ইউনিট লেবেল একই রেখে), তারপর দ্বিতীয় সারিতে অন্য বিলের ধরনটা বেছে নিন — একটা সারিতে একটার বেশি বিল লেখা যায় না।",
    "",
    "৫) বিদ্যুৎ বিলের জন্য চাইলে মিটার রিডিং দিতে পারেন — 'আগের মিটার রিডিং' কলামে আগের মাসের রিডিং তথ্যের জন্য দেখানো থাকবে (এটা শুধু দেখার জন্য, পরিবর্তন করবেন না), 'বর্তমান মিটার রিডিং' কলামে এই মাসের রিডিং লিখুন — কত ইউনিট খরচ হয়েছে সেটা অ্যাপ নিজে হিসাব করে দেখাবে। এই মাসের রিডিংটাই পরের মাসের শীটে নিজে থেকে 'আগের রিডিং' হয়ে যাবে।",
    "",
    "৬) 'খরচ' শীটে এই মাসের মেরামত/অন্যান্য খরচ থাকলে নিজে নতুন সারি যোগ করে লিখুন — এটা কোনো নির্দিষ্ট তালিকা থেকে না, তাই এখানে আগে থেকে কিছু ভরা নেই, আর একই খরচ দুইবার লিখলে দুইবারই রেকর্ড হবে, তাই এই শীটে একই খরচ একবারই লিখুন।",
    "",
    "৭) 'ভাড়া আদায়ের ইতিহাস' শীটে 'পেমেন্ট পদ্ধতি' কলামে 'নগদ/মোবাইল ব্যাংকিং' বা 'ডাউনপেমেন্ট থেকে সমন্বয়' বেছে নিতে পারবেন — সমন্বয় করলে টেন্যান্টের নিজের জমা টাকা থেকে কেটে নেওয়া হবে, নতুন টাকা লাগবে না ('বর্তমান ডাউনপেমেন্ট ব্যালেন্স' কলামে দেখুন কত আছে)।",
    "",
    "৮) যেসব কলামে হলুদ তীরচিহ্ন (▼) দেখবেন, সেখান থেকে বেছে নিন, নিজে টাইপ করবেন না।",
    "",
    "৯) পূরণ শেষে এই ফাইলটাই 'ইমপোর্ট করুন' বাটনে আপলোড করুন।",
  ];
  lines.forEach((line, i) => {
    const row = sheet.addRow([line]);
    if (i === 0) row.font = { bold: true, size: 14 };
    row.alignment = { horizontal: "right", wrapText: true };
  });
}

export async function generateMonthlyWorkbook(
  propertyId: string
): Promise<{ buffer: Buffer; propertyName: string }> {
  const monthKey = currentMonthKey();

  const [
    property,
    leases,
    units,
    employees,
    existingRentPayments,
    existingOwnerRentPayment,
    existingPayrollRecords,
    existingUtilityBills,
    electricityBillHistory,
  ] = await Promise.all([
      prisma.property.findUnique({
        where: { id: propertyId, deletedAt: null },
        include: {
          ownerLeaseAgreements: { where: { status: "ACTIVE" }, take: 1 },
          unitTypes: { include: { units: { select: { ownerRentAmount: true } } } },
        },
      }),
      prisma.tenantLease.findMany({
        where: { status: "ACTIVE", unit: { unitType: { propertyId } } },
        orderBy: { startDate: "asc" },
        include: { tenant: true, unit: { include: { unitType: { include: { property: true } } } } },
      }),
      prisma.unit.findMany({
        where: { status: "ACTIVE", unitType: { propertyId } },
        orderBy: { label: "asc" },
        include: { unitType: { include: { property: true } } },
      }),
      prisma.employee.findMany({
        where: { status: "ACTIVE", propertyId },
        orderBy: { name: "asc" },
      }),
      // Already-recorded data this month — pre-filled below so a re-downloaded
      // sheet shows what's already done instead of blanking it out again
      // (which is also what makes re-uploading an untouched row a safe no-op).
      prisma.rentPayment.findMany({
        where: { month: monthKey, tenantLease: { unit: { unitType: { propertyId } } } },
        include: { downpaymentAdjustments: { select: { id: true } } },
      }),
      prisma.ownerRentPayment.findFirst({
        where: { month: monthKey, unitId: null, ownerLeaseAgreement: { propertyId } },
      }),
      prisma.payrollRecord.findMany({
        where: { month: monthKey, employee: { propertyId } },
        include: { transactions: { orderBy: { date: "desc" }, take: 1, select: { method: true } } },
      }),
      prisma.utilityBill.findMany({
        where: { propertyId, month: monthKey },
        include: { transactions: { orderBy: { date: "desc" }, take: 1, select: { method: true, date: true } } },
      }),
      // Full electricity-reading history for this property — needed to chain
      // "previous reading" correctly for both the pre-filled rows above (any
      // already-recorded bill this month) and the blank new-bill row below,
      // not just what happens to exist within this one month.
      prisma.utilityBill.findMany({
        where: { propertyId, type: "ELECTRICITY" },
        select: { id: true, unitId: true, month: true, dueDate: true, meterReading: true },
      }),
    ]);
  if (!property) throw new Error("প্রপার্টি পাওয়া যায়নি");

  const rentPaymentByLease = new Map(existingRentPayments.map((rp) => [rp.tenantLeaseId, rp]));
  const payrollByEmployee = new Map(existingPayrollRecords.map((pr) => [pr.employeeId, pr]));
  const utilityBillsByUnit = new Map<string, typeof existingUtilityBills>();
  for (const b of existingUtilityBills) {
    const key = b.unitId ?? "__property__";
    utilityBillsByUnit.set(key, [...(utilityBillsByUnit.get(key) ?? []), b]);
  }
  const electricityBillsForConsumption = electricityBillHistory.map((b) => ({
    id: b.id,
    type: "ELECTRICITY",
    unitId: b.unitId,
    dueDate: b.dueDate,
    meterReading: b.meterReading != null ? Number(b.meterReading) : null,
  }));
  const electricityConsumptionByBillId = attachElectricityConsumption(electricityBillsForConsumption);
  // What a brand-new electricity bill added THIS month would chain from —
  // the latest reading from any PRIOR month (excludes this month's own
  // already-recorded reading, if any, since that's shown on its own row).
  const previousElectricityReadingByUnit = latestElectricityReadingByUnit(
    electricityBillHistory.map((b) => ({
      id: b.id,
      type: "ELECTRICITY",
      unitId: b.unitId,
      month: b.month,
      dueDate: b.dueDate,
      meterReading: b.meterReading != null ? Number(b.meterReading) : null,
    })),
    monthKey
  );

  const workbook = new ExcelJS.Workbook();
  addMonthlyInstructions(workbook, monthKey, property.name);
  const properties = [property];

  // Owner rent: one row per property that has an active agreement, due
  // amount computed the same way properties-data.ts's monthlyOwnerRent does.
  const ownerRentRows = properties
    .filter((p) => p.ownerLeaseAgreements.length > 0)
    .map((p) => {
      const agreement = p.ownerLeaseAgreements[0];
      const fixedRent = agreement.fixedMonthlyRentAmount;
      const dueAmount =
        fixedRent != null
          ? Number(fixedRent)
          : p.unitTypes.reduce(
              (sum, ut) =>
                sum + ut.units.reduce((s, u) => s + Number(u.ownerRentAmount ?? ut.ownerRentAmount ?? 0), 0),
              0
            );
      return [
        p.name,
        "",
        monthKey,
        dueAmount,
        existingOwnerRentPayment ? Number(existingOwnerRentPayment.paidAmount) : "",
        existingOwnerRentPayment ? ymd(existingOwnerRentPayment.paidAt) : "",
        "",
      ];
    });
  const ownerRentSheet = addHeaderedSheet(workbook, SHEET_NAMES.OWNER_RENT_PAYMENTS, OWNER_RENT_PAYMENT_COLUMNS, ownerRentRows);
  addDropdown(ownerRentSheet, 7, PAYMENT_METHOD_OPTIONS);

  // Tenant rent: one row per active lease, due amount includes any
  // configured service charge (same computeServiceChargeAmount used
  // everywhere else in the app).
  const rentRows = leases.map((l) => {
    const rent = Number(l.monthlyRentAmount);
    const serviceCharge = computeServiceChargeAmount(
      rent,
      l.serviceChargeType,
      l.serviceChargeValue != null ? Number(l.serviceChargeValue) : null
    );
    const existing = rentPaymentByLease.get(l.id);
    return [
      l.unit.unitType.property.name,
      l.unit.label,
      l.tenant.name,
      monthKey,
      rent + serviceCharge,
      Number(l.currentDownpaymentBalance),
      existing ? Number(existing.paidAmount) : "",
      existing ? (existing.downpaymentAdjustments.length > 0 ? "ডাউনপেমেন্ট থেকে সমন্বয়" : "নগদ/মোবাইল ব্যাংকিং") : "",
      existing ? ymd(existing.paidAt) : "",
      "",
    ];
  });
  const rentSheet = addHeaderedSheet(workbook, SHEET_NAMES.RENT_PAYMENTS, RENT_PAYMENT_COLUMNS, rentRows);
  addDropdown(rentSheet, 8, RENT_PAYMENT_MODE_OPTIONS);
  addDropdown(rentSheet, 10, PAYMENT_METHOD_OPTIONS);

  // Utility bills: any bill already recorded this month gets its own
  // pre-filled row (so it's visible and, if left untouched, safely skipped
  // on re-import), plus exactly one blank row per active unit for adding a
  // new bill. Deliberately NOT one blank row per possible type (gas/
  // electricity/water) — that reads as a wall of near-identical empty rows
  // and reads as confusing/broken to a non-technical user. A unit that
  // genuinely needs a second/third bill this month (e.g. both gas AND
  // electricity, new) is the exception, not the common case — the
  // instructions tell the user to copy that unit's row for the extra ones,
  // same pattern the app has always used here.
  const utilityDueDate = `${monthKey}-10`; // company policy: same due date as rent, the 10th
  const utilityRows: (string | number | null)[][] = [];
  for (const u of units) {
    for (const b of utilityBillsByUnit.get(u.id) ?? []) {
      const consumption = electricityConsumptionByBillId.get(b.id);
      utilityRows.push([
        u.unitType.property.name,
        u.label,
        utilityTypeToBengali(b.type),
        Number(b.amount),
        ymd(b.dueDate),
        yesNoToBengali(b.status === "PAID"),
        b.status === "PAID" ? ymd(b.transactions[0]?.date ?? null) : "",
        b.status === "PAID" ? paymentMethodToBengali(b.transactions[0]?.method ?? null) : "",
        yesNoToBengali(b.paidByCompany),
        b.type === "ELECTRICITY" ? (consumption?.previousReading ?? "") : "",
        b.type === "ELECTRICITY" && b.meterReading != null ? Number(b.meterReading) : "",
      ]);
    }
    const previousReading = previousElectricityReadingByUnit.get(u.id) ?? "";
    utilityRows.push([
      u.unitType.property.name,
      u.label,
      "",
      "",
      utilityDueDate,
      "না",
      "",
      "",
      "",
      previousReading,
      "",
    ]);
  }
  const utilitySheet = addHeaderedSheet(workbook, SHEET_NAMES.UTILITY_BILLS, UTILITY_BILL_COLUMNS, utilityRows);
  addDropdown(utilitySheet, 3, UTILITY_TYPE_OPTIONS);
  addDropdown(utilitySheet, 6, YES_NO_OPTIONS);
  addDropdown(utilitySheet, 8, PAYMENT_METHOD_OPTIONS);
  addDropdown(utilitySheet, 9, YES_NO_OPTIONS);

  // Payroll: one row per active employee.
  const payrollRows = employees.map((e) => {
    const existing = payrollByEmployee.get(e.id);
    return [
      // Every employee here was fetched filtered to this exact propertyId,
      // so it's always this workbook's own property — no need to rely on
      // the (now-optional) Employee.property relation for the name.
      property.name,
      e.name,
      monthKey,
      existing ? Number(existing.amountPaid) : "",
      existing ? ymd(existing.paidAt) : "",
      existing ? paymentMethodToBengali(existing.transactions[0]?.method ?? null) : "",
    ];
  });
  const payrollSheet = addHeaderedSheet(workbook, SHEET_NAMES.PAYROLL, PAYROLL_COLUMNS, payrollRows);
  addDropdown(payrollSheet, 6, PAYMENT_METHOD_OPTIONS);

  // Expenses: genuinely ad-hoc, not tied to a recurring entity — no
  // pre-filled rows, just the sheet + dropdowns ready for the user's own rows.
  const expenseSheet = addHeaderedSheet(workbook, SHEET_NAMES.EXPENSES, EXPENSE_COLUMNS, []);
  addDropdown(expenseSheet, 3, EXPENSE_CATEGORY_OPTIONS);
  addDropdown(expenseSheet, 6, PAYMENT_METHOD_OPTIONS);

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer: Buffer.from(buffer), propertyName: property.name };
}
