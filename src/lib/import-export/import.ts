import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import type { ImportEntityType } from "@/generated/prisma/enums";
import { readSheetRows, str, num, dateVal } from "./excel-utils";
import {
  parsePaymentMethod,
  parseUtilityType,
  parseServiceChargeType,
  parseExpenseCategory,
  parseYesNo,
  parseRentPaymentMode,
} from "./enums";
import { computeServiceChargeAmount } from "@/lib/service-charge";
import { SHEET_NAMES } from "./sheets";
import type { RawRow, RowError, SheetResult, ImportResult } from "./types";

// Name-keyed lookup maps, seeded from the DB and extended as each sheet
// creates new rows — so a row can reference either a pre-existing record OR
// one created earlier in the very same upload, uniformly. Unit/tenant-lease
// lookups are scoped by propertyName so identical unit labels ("Unit 1") in
// different properties don't collide.
type Context = {
  ownerId: Map<string, string>;
  propertyId: Map<string, string>;
  propertyOwnerLeaseAgreementId: Map<string, string>;
  propertyFixedRentMode: Map<string, boolean>;
  unitId: Map<string, string>; // key: `${propertyName}::${unitLabel}`
  activeLeaseId: Map<string, string>; // key: `${propertyName}::${unitLabel}::${tenantName}`
  employeeId: Map<string, string>; // key: `${propertyName}::${employeeName}`
};

async function buildContext(): Promise<Context> {
  const [owners, properties, agreements, units, leases, employees] = await Promise.all([
    prisma.propertyOwner.findMany({ select: { id: true, name: true } }),
    prisma.property.findMany({ where: { deletedAt: null }, select: { id: true, name: true } }),
    prisma.ownerLeaseAgreement.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, propertyId: true, fixedMonthlyRentAmount: true, property: { select: { name: true } } },
    }),
    prisma.unit.findMany({
      select: { id: true, label: true, unitType: { select: { property: { select: { name: true } } } } },
    }),
    prisma.tenantLease.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        tenant: { select: { name: true } },
        unit: { select: { label: true, unitType: { select: { property: { select: { name: true } } } } } },
      },
    }),
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, property: { select: { name: true } } },
    }),
  ]);

  const ctx: Context = {
    ownerId: new Map(owners.map((o) => [o.name, o.id])),
    propertyId: new Map(properties.map((p) => [p.name, p.id])),
    propertyOwnerLeaseAgreementId: new Map(agreements.map((a) => [a.property.name, a.id])),
    propertyFixedRentMode: new Map(agreements.map((a) => [a.property.name, a.fixedMonthlyRentAmount != null])),
    unitId: new Map(units.map((u) => [`${u.unitType.property.name}::${u.label}`, u.id])),
    activeLeaseId: new Map(
      leases.map((l) => [`${l.unit.unitType.property.name}::${l.unit.label}::${l.tenant.name}`, l.id])
    ),
    // Blank property-name half of the key = company-level staff (no property).
    employeeId: new Map(employees.map((e) => [`${e.property?.name ?? ""}::${e.name}`, e.id])),
  };
  return ctx;
}

async function createImportBatch(
  entityType: ImportEntityType,
  fileName: string,
  rowCount: number,
  userId: string | null
) {
  if (rowCount === 0) return null;
  const batch = await prisma.importBatch.create({
    data: { entityType, fileName, rowCount, importedById: userId },
  });
  return batch.id;
}

// ===== Sheet 1: Owners =====
async function importOwners(rows: RawRow[], fileName: string, userId: string | null, ctx: Context): Promise<SheetResult> {
  const errors: RowError[] = [];
  let created = 0;
  const createdIds: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const name = str(row, "নাম");
    if (!name) {
      errors.push({ sheet: SHEET_NAMES.OWNERS, row: rowNum, message: "নাম আবশ্যক" });
      continue;
    }
    try {
      const owner = await prisma.propertyOwner.create({
        data: { name, contactInfo: str(row, "ফোন/যোগাযোগ"), address: str(row, "ঠিকানা"), notes: str(row, "নোট") },
      });
      ctx.ownerId.set(name, owner.id);
      createdIds.push(owner.id);
      created++;
    } catch (e) {
      errors.push({ sheet: SHEET_NAMES.OWNERS, row: rowNum, message: e instanceof Error ? e.message : "অজানা ত্রুটি" });
    }
  }

  const batchId = await createImportBatch("PROPERTY_OWNER", fileName, created, userId);
  if (batchId) await prisma.propertyOwner.updateMany({ where: { id: { in: createdIds } }, data: { importBatchId: batchId } });
  return { sheet: SHEET_NAMES.OWNERS, created, errors };
}

// ===== Sheet 2: Properties (+ OwnerLeaseAgreement if fixed mode) =====
async function importProperties(
  rows: RawRow[],
  fileName: string,
  userId: string | null,
  ctx: Context
): Promise<SheetResult> {
  const errors: RowError[] = [];
  let created = 0;
  const createdIds: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const ownerName = str(row, "মালিকের নাম");
    const name = str(row, "প্রপার্টির নাম");
    if (!ownerName || !name) {
      errors.push({ sheet: SHEET_NAMES.PROPERTIES, row: rowNum, message: "মালিকের নাম ও প্রপার্টির নাম আবশ্যক" });
      continue;
    }
    const ownerId = ctx.ownerId.get(ownerName);
    if (!ownerId) {
      errors.push({ sheet: SHEET_NAMES.PROPERTIES, row: rowNum, message: `"${ownerName}" নামে কোনো মালিক পাওয়া যায়নি` });
      continue;
    }
    const rentModeRaw = str(row, "ভাড়ার ধরন (প্রতি ইউনিট / ফিক্সড)");
    const isFixed = rentModeRaw?.trim() === "ফিক্সড";
    try {
      const property = await prisma.property.create({
        data: {
          ownerId,
          name,
          type: str(row, "ধরন"),
          address: str(row, "ঠিকানা"),
          notes: str(row, "নোট"),
        },
      });
      if (isFixed) {
        await prisma.ownerLeaseAgreement.create({
          data: {
            propertyId: property.id,
            fixedMonthlyRentAmount: num(row, "মাসিক ভাড়া (শুধু ফিক্সড হলে)"),
            downpaymentAmount: num(row, "অগ্রিম/ডাউনপেমেন্ট (শুধু ফিক্সড হলে)"),
            startDate: new Date(),
            status: "ACTIVE",
          },
        });
      } else {
        // Still needs an active agreement row to exist for OwnerRentPayment
        // imports to resolve against later, even with no fixed figures set.
        await prisma.ownerLeaseAgreement.create({
          data: { propertyId: property.id, startDate: new Date(), status: "ACTIVE" },
        });
      }
      ctx.propertyId.set(name, property.id);
      ctx.propertyFixedRentMode.set(name, isFixed);
      const agreement = await prisma.ownerLeaseAgreement.findFirst({
        where: { propertyId: property.id, status: "ACTIVE" },
        select: { id: true },
      });
      if (agreement) ctx.propertyOwnerLeaseAgreementId.set(name, agreement.id);
      createdIds.push(property.id);
      created++;
    } catch (e) {
      errors.push({ sheet: SHEET_NAMES.PROPERTIES, row: rowNum, message: e instanceof Error ? e.message : "অজানা ত্রুটি" });
    }
  }

  const batchId = await createImportBatch("PROPERTY", fileName, created, userId);
  if (batchId) await prisma.property.updateMany({ where: { id: { in: createdIds } }, data: { importBatchId: batchId } });
  return { sheet: SHEET_NAMES.PROPERTIES, created, errors };
}

// ===== Sheet 3: Unit Types (auto-generates its Units, "Unit 1".."Unit N") =====
async function importUnitTypes(
  rows: RawRow[],
  fileName: string,
  userId: string | null,
  ctx: Context
): Promise<SheetResult> {
  const errors: RowError[] = [];
  let created = 0;
  const createdIds: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const propertyName = str(row, "প্রপার্টির নাম");
    const label = str(row, "ইউনিট টাইপের নাম");
    const unitCount = num(row, "ইউনিট সংখ্যা");
    if (!propertyName || !label || !unitCount || unitCount < 1) {
      errors.push({ sheet: SHEET_NAMES.UNIT_TYPES, row: rowNum, message: "প্রপার্টির নাম, ইউনিট টাইপ ও ইউনিট সংখ্যা আবশ্যক" });
      continue;
    }
    const propertyId = ctx.propertyId.get(propertyName);
    if (!propertyId) {
      errors.push({ sheet: SHEET_NAMES.UNIT_TYPES, row: rowNum, message: `"${propertyName}" নামে কোনো প্রপার্টি পাওয়া যায়নি` });
      continue;
    }
    const isFixed = ctx.propertyFixedRentMode.get(propertyName) ?? false;
    try {
      const unitType = await prisma.unitType.create({
        data: {
          propertyId,
          label,
          unitCount,
          sizeValue: num(row, "সাইজ"),
          sizeUnit: str(row, "সাইজের একক"),
          ownerRentAmount: isFixed ? null : num(row, "মালিকের ভাড়া/ইউনিট (শুধু প্রতি-ইউনিট হলে)"),
          tenantDefaultRentAmount: num(row, "টেন্যান্টের ডিফল্ট ভাড়া"),
          tenantDefaultDownpaymentAmount: num(row, "টেন্যান্টের ডিফল্ট ডাউনপেমেন্ট"),
          tenantDefaultNightlyRateAmount: num(row, "রাতপ্রতি ভাড়া (হোটেলের জন্য)"),
        },
      });
      // Property-wide continuous numbering ("Unit 1", "Unit 2"... across every
      // unit type in the property), matching how the app's own Add Unit Type
      // dialog numbers units (see parseUnitOverrides's existingUnitCount in
      // actions/properties.ts) — NOT scoped to just this one unit type, or
      // two unit types in the same property would both start at "Unit 1".
      const existingCount = await prisma.unit.count({ where: { unitType: { propertyId } } });
      const units = await Promise.all(
        Array.from({ length: unitCount }, (_, n) =>
          prisma.unit.create({ data: { unitTypeId: unitType.id, label: `Unit ${existingCount + n + 1}` } })
        )
      );
      for (const u of units) ctx.unitId.set(`${propertyName}::${u.label}`, u.id);
      createdIds.push(unitType.id);
      created++;
    } catch (e) {
      errors.push({ sheet: SHEET_NAMES.UNIT_TYPES, row: rowNum, message: e instanceof Error ? e.message : "অজানা ত্রুটি" });
    }
  }

  const batchId = await createImportBatch("UNIT_TYPE", fileName, created, userId);
  if (batchId) await prisma.unitType.updateMany({ where: { id: { in: createdIds } }, data: { importBatchId: batchId } });
  return { sheet: SHEET_NAMES.UNIT_TYPES, created, errors };
}

// ===== Sheet 3b: Unit overrides (updates units Unit Types just created — no
// ImportBatch of its own, since Unit isn't independently batch-tracked in
// this schema; each unit already traces back via its parent UnitType's
// batch) =====
async function importUnitOverrides(rows: RawRow[], ctx: Context): Promise<SheetResult> {
  const errors: RowError[] = [];
  let created = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const propertyName = str(row, "প্রপার্টির নাম");
    const unitLabel = str(row, "ইউনিট লেবেল (Unit 1, Unit 2...)");
    if (!propertyName || !unitLabel) {
      errors.push({ sheet: SHEET_NAMES.UNITS, row: rowNum, message: "প্রপার্টির নাম ও ইউনিট লেবেল আবশ্যক" });
      continue;
    }
    const unitId = ctx.unitId.get(`${propertyName}::${unitLabel}`);
    if (!unitId) {
      errors.push({
        sheet: SHEET_NAMES.UNITS,
        row: rowNum,
        message: `"${propertyName}" এ "${unitLabel}" নামে কোনো ইউনিট পাওয়া যায়নি — আগে "ইউনিট টাইপ" শীটে এই ইউনিট তৈরি হতে হবে`,
      });
      continue;
    }
    try {
      await prisma.unit.update({
        where: { id: unitId },
        data: {
          sizeValue: num(row, "সাইজ (ঐচ্ছিক)"),
          ownerRentAmount: num(row, "মালিকের ভাড়া (ঐচ্ছিক)"),
          ownerDownpaymentAmount: num(row, "মালিকের ডাউনপেমেন্ট (ঐচ্ছিক)"),
          tenantDefaultRentAmount: num(row, "টেন্যান্টের ডিফল্ট ভাড়া (ঐচ্ছিক)"),
          tenantDefaultDownpaymentAmount: num(row, "টেন্যান্টের ডিফল্ট ডাউনপেমেন্ট (ঐচ্ছিক)"),
          tenantDefaultNightlyRateAmount: num(row, "রাতপ্রতি ভাড়া (ঐচ্ছিক, হোটেলের জন্য)"),
        },
      });
      created++;
    } catch (e) {
      errors.push({ sheet: SHEET_NAMES.UNITS, row: rowNum, message: e instanceof Error ? e.message : "অজানা ত্রুটি" });
    }
  }

  return { sheet: SHEET_NAMES.UNITS, created, errors };
}

// ===== Sheet 4: Tenants + Leases =====
async function importTenants(rows: RawRow[], fileName: string, userId: string | null, ctx: Context): Promise<SheetResult> {
  const errors: RowError[] = [];
  let created = 0;
  const createdTenantIds: string[] = [];
  const createdLeaseIds: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const propertyName = str(row, "প্রপার্টির নাম");
    const unitLabel = str(row, "ইউনিট লেবেল");
    const tenantName = str(row, "টেন্যান্টের নাম");
    const monthlyRentAmount = num(row, "মাসিক ভাড়া");
    const startDate = dateVal(row, "শুরুর তারিখ (YYYY-MM-DD)");
    if (!propertyName || !unitLabel || !tenantName || !monthlyRentAmount || !startDate) {
      errors.push({
        sheet: SHEET_NAMES.TENANTS,
        row: rowNum,
        message: "প্রপার্টি, ইউনিট, টেন্যান্টের নাম, ভাড়া ও শুরুর তারিখ আবশ্যক",
      });
      continue;
    }
    const unitId = ctx.unitId.get(`${propertyName}::${unitLabel}`);
    if (!unitId) {
      errors.push({
        sheet: SHEET_NAMES.TENANTS,
        row: rowNum,
        message: `"${propertyName}" এ "${unitLabel}" নামে কোনো ইউনিট পাওয়া যায়নি`,
      });
      continue;
    }
    try {
      const tenant = await prisma.tenant.create({ data: { name: tenantName, contactInfo: str(row, "ফোন") } });
      const initialDownpaymentAmount = num(row, "ডাউনপেমেন্ট") ?? 0;
      const serviceChargeType = parseServiceChargeType(str(row, "সার্ভিস চার্জের ধরন (ফ্ল্যাট/শতাংশ/খালি)"));
      const lease = await prisma.tenantLease.create({
        data: {
          unitId,
          tenantId: tenant.id,
          monthlyRentAmount,
          initialDownpaymentAmount,
          currentDownpaymentBalance: initialDownpaymentAmount,
          serviceChargeType,
          serviceChargeValue: serviceChargeType ? num(row, "সার্ভিস চার্জের মান") : null,
          startDate,
          notes: str(row, "নোট"),
        },
      });
      ctx.activeLeaseId.set(`${propertyName}::${unitLabel}::${tenantName}`, lease.id);
      createdTenantIds.push(tenant.id);
      createdLeaseIds.push(lease.id);
      created++;
    } catch (e) {
      errors.push({ sheet: SHEET_NAMES.TENANTS, row: rowNum, message: e instanceof Error ? e.message : "অজানা ত্রুটি" });
    }
  }

  const batchId = await createImportBatch("TENANT_LEASE", fileName, created, userId);
  if (batchId) {
    await prisma.tenant.updateMany({ where: { id: { in: createdTenantIds } }, data: { importBatchId: batchId } });
    await prisma.tenantLease.updateMany({ where: { id: { in: createdLeaseIds } }, data: { importBatchId: batchId } });
  }
  return { sheet: SHEET_NAMES.TENANTS, created, errors };
}

// ===== Sheet 5: Rent Payment history (+ Transaction if paidAmount > 0) =====
async function importRentPayments(
  rows: RawRow[],
  fileName: string,
  userId: string | null,
  ctx: Context
): Promise<SheetResult> {
  const errors: RowError[] = [];
  let created = 0;
  const createdIds: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const propertyName = str(row, "প্রপার্টির নাম");
    const unitLabel = str(row, "ইউনিট লেবেল");
    const tenantName = str(row, "টেন্যান্টের নাম");
    const month = str(row, "মাস (YYYY-MM)");
    const dueAmount = num(row, "বকেয়া পরিমাণ");
    const paidAmountRaw = num(row, "পরিশোধিত পরিমাণ");
    // Pre-filled monthly sheets list every active lease whether or not it was
    // actually paid this month — a row the user left completely untouched
    // (blank paid amount) just means "nothing to record yet", not an error.
    if (propertyName && unitLabel && tenantName && month && dueAmount != null && paidAmountRaw === null) {
      continue;
    }
    const paidAmount = paidAmountRaw ?? 0;
    if (!propertyName || !unitLabel || !tenantName || !month || dueAmount == null) {
      errors.push({
        sheet: SHEET_NAMES.RENT_PAYMENTS,
        row: rowNum,
        message: "প্রপার্টি, ইউনিট, টেন্যান্ট, মাস ও বকেয়া পরিমাণ আবশ্যক",
      });
      continue;
    }
    const leaseId = ctx.activeLeaseId.get(`${propertyName}::${unitLabel}::${tenantName}`);
    const propertyId = ctx.propertyId.get(propertyName);
    if (!leaseId || !propertyId) {
      errors.push({
        sheet: SHEET_NAMES.RENT_PAYMENTS,
        row: rowNum,
        message: `"${tenantName}" (${propertyName} / ${unitLabel}) এর কোনো সক্রিয় লিজ পাওয়া যায়নি`,
      });
      continue;
    }
    const paidAt = dateVal(row, "পরিশোধের তারিখ (YYYY-MM-DD)");
    const mode = parseRentPaymentMode(
      str(row, "পেমেন্ট পদ্ধতি (নগদ/মোবাইল ব্যাংকিং বা ডাউনপেমেন্ট থেকে সমন্বয়)")
    );
    try {
      // Same rules as the manual "ভাড়া আদায় করুন" dialog (recordTenantRentPayment):
      // downpayment-adjustment can't exceed the lease's current balance, and
      // only real cash-ish payments bundle the optional service charge.
      const lease = await prisma.tenantLease.findUnique({ where: { id: leaseId } });
      if (!lease) {
        errors.push({ sheet: SHEET_NAMES.RENT_PAYMENTS, row: rowNum, message: "লিজ পাওয়া যায়নি" });
        continue;
      }

      // A re-uploaded monthly/export sheet lists every lease every time, so
      // compare against whatever was already recorded this month and only
      // act on the DELTA — re-submitting the same figure (or a blank-carried
      // one) must not re-fire a second Transaction/DownpaymentAdjustment for
      // money that was already recorded.
      const existing = await prisma.rentPayment.findUnique({
        where: { tenantLeaseId_month: { tenantLeaseId: leaseId, month } },
      });
      const previousPaidAmount = existing ? Number(existing.paidAmount) : 0;
      const delta = paidAmount - previousPaidAmount;

      if (mode === "downpaymentAdjustment" && delta > 0 && delta > Number(lease.currentDownpaymentBalance)) {
        errors.push({
          sheet: SHEET_NAMES.RENT_PAYMENTS,
          row: rowNum,
          message: `নতুন সমন্বয়যোগ্য পরিমাণ (${delta}) বর্তমান ডাউনপেমেন্ট ব্যালেন্স (${Number(lease.currentDownpaymentBalance)}) থেকে বেশি`,
        });
        continue;
      }
      const status =
        mode === "downpaymentAdjustment"
          ? paidAmount >= dueAmount
            ? "ADJUSTED_FROM_DOWNPAYMENT"
            : "PARTIAL"
          : paidAmount >= dueAmount
            ? "PAID"
            : "PARTIAL";

      const rentPayment = await prisma.rentPayment.upsert({
        where: { tenantLeaseId_month: { tenantLeaseId: leaseId, month } },
        update: { dueAmount, paidAmount, status, paidAt },
        create: { tenantLeaseId: leaseId, month, dueDate: paidAt ?? new Date(), dueAmount, paidAmount, status, paidAt },
      });

      if (delta > 0) {
        if (mode === "downpaymentAdjustment") {
          await prisma.downpaymentAdjustment.create({
            data: { tenantLeaseId: leaseId, rentPaymentId: rentPayment.id, amountAdjusted: delta },
          });
          await prisma.tenantLease.update({
            where: { id: leaseId },
            data: { currentDownpaymentBalance: { decrement: delta } },
          });
        } else {
          const method = parsePaymentMethod(str(row, "পেমেন্ট মাধ্যম (নগদ হলে)"));
          await prisma.transaction.create({
            data: {
              propertyId,
              type: "RENT_RECEIVED_FROM_TENANT",
              direction: "INCOMING",
              amount: delta,
              method,
              tenantLeaseId: leaseId,
              rentPaymentId: rentPayment.id,
              date: paidAt ?? new Date(),
            },
          });
          // Only bundle the service charge the first time this month sees
          // any real money recorded — otherwise a later top-up delta would
          // add it again.
          if (previousPaidAmount === 0) {
            const serviceChargeAmount = computeServiceChargeAmount(
              Number(lease.monthlyRentAmount),
              lease.serviceChargeType,
              lease.serviceChargeValue != null ? Number(lease.serviceChargeValue) : null
            );
            if (serviceChargeAmount > 0) {
              await prisma.transaction.create({
                data: {
                  propertyId,
                  type: "SERVICE_CHARGE_RECEIVED_FROM_TENANT",
                  direction: "INCOMING",
                  amount: serviceChargeAmount,
                  method,
                  tenantLeaseId: leaseId,
                  date: paidAt ?? new Date(),
                },
              });
            }
          }
        }
      }

      // Only count this row as "created" if something about it is actually
      // new — an unchanged resubmission (already-recorded figure carried
      // over on a re-download) keeps the RentPayment row in sync above but
      // shouldn't inflate the import summary or ImportBatch trace.
      if (!existing || paidAmount !== previousPaidAmount) {
        createdIds.push(rentPayment.id);
        created++;
      }
    } catch (e) {
      errors.push({ sheet: SHEET_NAMES.RENT_PAYMENTS, row: rowNum, message: e instanceof Error ? e.message : "অজানা ত্রুটি" });
    }
  }

  const batchId = await createImportBatch("RENT_PAYMENT", fileName, created, userId);
  if (batchId) await prisma.rentPayment.updateMany({ where: { id: { in: createdIds } }, data: { importBatchId: batchId } });
  return { sheet: SHEET_NAMES.RENT_PAYMENTS, created, errors };
}

// ===== Sheet 6: Owner Rent Payment history =====
async function importOwnerRentPayments(
  rows: RawRow[],
  fileName: string,
  userId: string | null,
  ctx: Context
): Promise<SheetResult> {
  const errors: RowError[] = [];
  let created = 0;
  const createdIds: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const propertyName = str(row, "প্রপার্টির নাম");
    const month = str(row, "মাস (YYYY-MM)");
    const dueAmount = num(row, "বকেয়া পরিমাণ");
    const paidAmountRaw = num(row, "পরিশোধিত পরিমাণ");
    if (propertyName && month && dueAmount != null && paidAmountRaw === null) {
      continue; // pre-filled monthly row left untouched — nothing to record yet
    }
    const paidAmount = paidAmountRaw ?? 0;
    if (!propertyName || !month || dueAmount == null) {
      errors.push({ sheet: SHEET_NAMES.OWNER_RENT_PAYMENTS, row: rowNum, message: "প্রপার্টি, মাস ও বকেয়া পরিমাণ আবশ্যক" });
      continue;
    }
    const agreementId = ctx.propertyOwnerLeaseAgreementId.get(propertyName);
    const propertyId = ctx.propertyId.get(propertyName);
    if (!agreementId || !propertyId) {
      errors.push({
        sheet: SHEET_NAMES.OWNER_RENT_PAYMENTS,
        row: rowNum,
        message: `"${propertyName}" এর কোনো সক্রিয় মালিক-চুক্তি পাওয়া যায়নি`,
      });
      continue;
    }
    const unitLabel = str(row, "ইউনিট লেবেল (ঐচ্ছিক)");
    const unitId = unitLabel ? (ctx.unitId.get(`${propertyName}::${unitLabel}`) ?? null) : null;
    const paidAt = dateVal(row, "পরিশোধের তারিখ (YYYY-MM-DD)");
    const status = paidAmount >= dueAmount ? "PAID" : paidAmount > 0 ? "PARTIAL" : "UNPAID";
    try {
      const existing = await prisma.ownerRentPayment.findFirst({
        where: { ownerLeaseAgreementId: agreementId, month, unitId },
        select: { id: true, paidAmount: true },
      });
      const previousPaidAmount = existing ? Number(existing.paidAmount) : 0;
      const delta = paidAmount - previousPaidAmount;
      const orp = existing
        ? await prisma.ownerRentPayment.update({
            where: { id: existing.id },
            data: { dueAmount, paidAmount, status, paidAt },
          })
        : await prisma.ownerRentPayment.create({
            data: { ownerLeaseAgreementId: agreementId, unitId, month, dueDate: paidAt ?? new Date(), dueAmount, paidAmount, status, paidAt },
          });
      // Only the newly-added portion moves money — re-uploading an
      // already-recorded figure must not create a second OUTGOING transaction.
      if (delta > 0) {
        await prisma.transaction.create({
          data: {
            propertyId,
            type: "RENT_PAID_TO_OWNER",
            direction: "OUTGOING",
            amount: delta,
            method: parsePaymentMethod(str(row, "পেমেন্ট মাধ্যম")),
            unitId,
            ownerRentPaymentId: orp.id,
            date: paidAt ?? new Date(),
          },
        });
      }
      if (!existing || paidAmount !== previousPaidAmount) {
        createdIds.push(orp.id);
        created++;
      }
    } catch (e) {
      errors.push({ sheet: SHEET_NAMES.OWNER_RENT_PAYMENTS, row: rowNum, message: e instanceof Error ? e.message : "অজানা ত্রুটি" });
    }
  }

  const batchId = await createImportBatch("OWNER_RENT_PAYMENT", fileName, created, userId);
  if (batchId) await prisma.ownerRentPayment.updateMany({ where: { id: { in: createdIds } }, data: { importBatchId: batchId } });
  return { sheet: SHEET_NAMES.OWNER_RENT_PAYMENTS, created, errors };
}

// ===== Sheet 7: Utility Bills =====
async function importUtilityBills(
  rows: RawRow[],
  fileName: string,
  userId: string | null,
  ctx: Context
): Promise<SheetResult> {
  const errors: RowError[] = [];
  let created = 0;
  const createdIds: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const propertyName = str(row, "প্রপার্টির নাম");
    const amount = num(row, "পরিমাণ");
    const dueDate = dateVal(row, "পরিশোধের শেষ তারিখ (YYYY-MM-DD)");
    // Pre-filled monthly sheets list every unit whether or not it actually
    // has a bill this month — a row with only property/unit filled in (no
    // amount) just means "no bill for this unit this month", skip silently.
    if (propertyName && amount == null) continue;
    if (!propertyName || amount == null || !dueDate) {
      errors.push({ sheet: SHEET_NAMES.UTILITY_BILLS, row: rowNum, message: "প্রপার্টি, পরিমাণ ও শেষ তারিখ আবশ্যক" });
      continue;
    }
    const propertyId = ctx.propertyId.get(propertyName);
    if (!propertyId) {
      errors.push({ sheet: SHEET_NAMES.UTILITY_BILLS, row: rowNum, message: `"${propertyName}" নামে কোনো প্রপার্টি পাওয়া যায়নি` });
      continue;
    }
    const unitLabel = str(row, "ইউনিট লেবেল (ঐচ্ছিক)");
    const unitId = unitLabel ? (ctx.unitId.get(`${propertyName}::${unitLabel}`) ?? null) : null;
    const type = parseUtilityType(str(row, "বিলের ধরন (গ্যাস/বিদ্যুৎ/পানি/অন্যান্য)"));
    const paidByCompanyRaw = str(row, "কোম্পানি নিজে পরিশোধ করে? (হ্যাঁ/না)");
    const paidByCompany = paidByCompanyRaw != null ? parseYesNo(paidByCompanyRaw) : type === "WATER";
    const isPaid = parseYesNo(str(row, "পরিশোধিত? (হ্যাঁ/না)"));
    // Meter reading only means anything for electricity — a value typed here
    // for any other type is ignored rather than stored, so meterReading
    // never carries a stray reading for a bill it doesn't apply to.
    const meterReading =
      type === "ELECTRICITY" ? num(row, "বর্তমান মিটার রিডিং (শুধু বিদ্যুতের জন্য)") : null;
    const monthKey = dueDate.toISOString().slice(0, 7);
    try {
      // Same match key the monthly sheet uses to pre-fill an already-recorded
      // bill (property + unit + type + month) — an unchanged re-uploaded row
      // skips entirely instead of creating a second bill for the same charge.
      const existing = await prisma.utilityBill.findFirst({
        where: { propertyId, unitId, type, month: monthKey },
      });
      const previousAmount = existing ? Number(existing.amount) : 0;
      const wasPaid = existing?.status === "PAID";
      const previousMeterReading = existing?.meterReading != null ? Number(existing.meterReading) : null;
      const unchanged =
        existing != null &&
        amount === previousAmount &&
        isPaid === wasPaid &&
        paidByCompany === existing.paidByCompany &&
        meterReading === previousMeterReading;
      if (unchanged) continue;

      const bill = existing
        ? await prisma.utilityBill.update({
            where: { id: existing.id },
            data: { amount, dueDate, status: isPaid ? "PAID" : "UNPAID", paidByCompany, meterReading },
          })
        : await prisma.utilityBill.create({
            data: {
              propertyId,
              unitId,
              type,
              month: monthKey,
              dueDate,
              amount,
              status: isPaid ? "PAID" : "UNPAID",
              paidByCompany,
              meterReading,
            },
          });

      const delta = amount - previousAmount;
      const justBecamePaid = isPaid && !wasPaid;
      // Fire a transaction for the newly-paid amount: the full amount the
      // first time this bill is marked paid, or just the increase if an
      // already-paid bill's amount was corrected upward.
      if (isPaid && (justBecamePaid || delta > 0)) {
        const txAmount = justBecamePaid ? amount : delta;
        const paidAt = dateVal(row, "পরিশোধের তারিখ (হ্যাঁ হলে)") ?? dueDate;
        const method = parsePaymentMethod(str(row, "পেমেন্ট মাধ্যম (হ্যাঁ হলে)"));
        if (paidByCompany) {
          await prisma.transaction.create({
            data: { propertyId, type: "UTILITY_EXPENSE", direction: "OUTGOING", amount: txAmount, method, unitId, utilityBillId: bill.id, date: paidAt },
          });
        } else {
          const activeLease = unitId
            ? await prisma.tenantLease.findFirst({ where: { unitId, status: "ACTIVE" }, select: { id: true } })
            : null;
          await prisma.transaction.create({
            data: {
              propertyId,
              type: "UTILITY_REIMBURSEMENT_FROM_TENANT",
              direction: "INCOMING",
              amount: txAmount,
              method,
              unitId,
              tenantLeaseId: activeLease?.id ?? null,
              utilityBillId: bill.id,
              date: paidAt,
            },
          });
        }
      }
      createdIds.push(bill.id);
      created++;
    } catch (e) {
      errors.push({ sheet: SHEET_NAMES.UTILITY_BILLS, row: rowNum, message: e instanceof Error ? e.message : "অজানা ত্রুটি" });
    }
  }

  const batchId = await createImportBatch("UTILITY_BILL", fileName, created, userId);
  if (batchId) await prisma.utilityBill.updateMany({ where: { id: { in: createdIds } }, data: { importBatchId: batchId } });
  return { sheet: SHEET_NAMES.UTILITY_BILLS, created, errors };
}

// ===== Sheet 8: Employees =====
async function importEmployees(
  rows: RawRow[],
  fileName: string,
  userId: string | null,
  ctx: Context
): Promise<SheetResult> {
  const errors: RowError[] = [];
  let created = 0;
  const createdIds: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    // Blank property name means company-level staff (manager, office
    // receptionist, admin) — not an error, just no single property.
    const propertyName = str(row, "প্রপার্টির নাম (কোম্পানি স্টাফ হলে খালি রাখুন)");
    const name = str(row, "নাম");
    const salaryAmount = num(row, "বেতন");
    if (!name || salaryAmount == null) {
      errors.push({ sheet: SHEET_NAMES.EMPLOYEES, row: rowNum, message: "নাম ও বেতন আবশ্যক" });
      continue;
    }
    let propertyId: string | null = null;
    if (propertyName) {
      propertyId = ctx.propertyId.get(propertyName) ?? null;
      if (!propertyId) {
        errors.push({ sheet: SHEET_NAMES.EMPLOYEES, row: rowNum, message: `"${propertyName}" নামে কোনো প্রপার্টি পাওয়া যায়নি` });
        continue;
      }
    }
    try {
      const employee = await prisma.employee.create({
        data: {
          propertyId,
          name,
          role: str(row, "পদবি") ?? "",
          contactInfo: str(row, "ফোন"),
          salaryAmount,
          joinedAt: dateVal(row, "যোগদানের তারিখ (YYYY-MM-DD)") ?? new Date(),
        },
      });
      ctx.employeeId.set(`${propertyName ?? ""}::${name}`, employee.id);
      createdIds.push(employee.id);
      created++;
    } catch (e) {
      errors.push({ sheet: SHEET_NAMES.EMPLOYEES, row: rowNum, message: e instanceof Error ? e.message : "অজানা ত্রুটি" });
    }
  }

  const batchId = await createImportBatch("EMPLOYEE", fileName, created, userId);
  if (batchId) await prisma.employee.updateMany({ where: { id: { in: createdIds } }, data: { importBatchId: batchId } });
  return { sheet: SHEET_NAMES.EMPLOYEES, created, errors };
}

// ===== Sheet 9: Payroll history =====
async function importPayroll(rows: RawRow[], fileName: string, userId: string | null, ctx: Context): Promise<SheetResult> {
  const errors: RowError[] = [];
  let created = 0;
  const createdIds: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    // Blank property name means company-level staff — same convention as
    // the Employees sheet, matched the same way (blank half of the key).
    const propertyName = str(row, "প্রপার্টির নাম (কোম্পানি স্টাফ হলে খালি রাখুন)");
    const employeeName = str(row, "কর্মচারীর নাম");
    const month = str(row, "মাস (YYYY-MM)");
    const amountPaid = num(row, "পরিমাণ পরিশোধিত");
    // Pre-filled monthly sheets list every active employee whether or not
    // they were actually paid yet this month — an untouched row (no amount)
    // just means "not paid yet", skip silently.
    if (employeeName && month && amountPaid == null) continue;
    if (!employeeName || !month || amountPaid == null) {
      errors.push({ sheet: SHEET_NAMES.PAYROLL, row: rowNum, message: "কর্মচারী, মাস ও পরিমাণ আবশ্যক" });
      continue;
    }
    const employeeId = ctx.employeeId.get(`${propertyName ?? ""}::${employeeName}`);
    const propertyId = propertyName ? (ctx.propertyId.get(propertyName) ?? null) : null;
    if (!employeeId || (propertyName && !propertyId)) {
      errors.push({
        sheet: SHEET_NAMES.PAYROLL,
        row: rowNum,
        message: `"${employeeName}"${propertyName ? ` (${propertyName})` : ""} নামে কোনো সক্রিয় কর্মচারী পাওয়া যায়নি`,
      });
      continue;
    }
    const paidAt = dateVal(row, "পরিশোধের তারিখ (YYYY-MM-DD)");
    try {
      const existing = await prisma.payrollRecord.findUnique({
        where: { employeeId_month: { employeeId, month } },
        select: { amountPaid: true },
      });
      const previousAmountPaid = existing ? Number(existing.amountPaid) : 0;
      const delta = amountPaid - previousAmountPaid;
      const payroll = await prisma.payrollRecord.upsert({
        where: { employeeId_month: { employeeId, month } },
        update: { amountPaid, status: "PAID", paidAt },
        create: { employeeId, month, dueDate: paidAt ?? new Date(), amountPaid, status: "PAID", paidAt },
      });
      // Only the newly-added portion moves money — re-uploading an
      // already-recorded figure must not create a second OUTGOING transaction.
      if (delta > 0) {
        await prisma.transaction.create({
          data: {
            propertyId,
            type: "PAYROLL_EXPENSE",
            direction: "OUTGOING",
            amount: delta,
            method: parsePaymentMethod(str(row, "পেমেন্ট মাধ্যম")),
            payrollRecordId: payroll.id,
            date: paidAt ?? new Date(),
          },
        });
      }
      if (!existing || amountPaid !== previousAmountPaid) {
        createdIds.push(payroll.id);
        created++;
      }
    } catch (e) {
      errors.push({ sheet: SHEET_NAMES.PAYROLL, row: rowNum, message: e instanceof Error ? e.message : "অজানা ত্রুটি" });
    }
  }

  const batchId = await createImportBatch("PAYROLL_RECORD", fileName, created, userId);
  if (batchId) await prisma.payrollRecord.updateMany({ where: { id: { in: createdIds } }, data: { importBatchId: batchId } });
  return { sheet: SHEET_NAMES.PAYROLL, created, errors };
}

// ===== Sheet 10: Expenses (ad-hoc MAINTENANCE_EXPENSE/OTHER transactions) =====
async function importExpenses(rows: RawRow[], fileName: string, userId: string | null, ctx: Context): Promise<SheetResult> {
  const errors: RowError[] = [];
  let created = 0;
  const createdIds: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const propertyName = str(row, "প্রপার্টির নাম");
    const amount = num(row, "পরিমাণ");
    const date = dateVal(row, "তারিখ (YYYY-MM-DD)");
    if (!propertyName || amount == null || !date) {
      errors.push({ sheet: SHEET_NAMES.EXPENSES, row: rowNum, message: "প্রপার্টি, পরিমাণ ও তারিখ আবশ্যক" });
      continue;
    }
    const propertyId = ctx.propertyId.get(propertyName);
    if (!propertyId) {
      errors.push({ sheet: SHEET_NAMES.EXPENSES, row: rowNum, message: `"${propertyName}" নামে কোনো প্রপার্টি পাওয়া যায়নি` });
      continue;
    }
    const unitLabel = str(row, "ইউনিট লেবেল (ঐচ্ছিক)");
    const unitId = unitLabel ? (ctx.unitId.get(`${propertyName}::${unitLabel}`) ?? null) : null;
    try {
      const tx = await prisma.transaction.create({
        data: {
          propertyId,
          type: parseExpenseCategory(str(row, "ক্যাটাগরি (মেরামত/অন্যান্য)")),
          direction: "OUTGOING",
          amount,
          method: parsePaymentMethod(str(row, "পেমেন্ট মাধ্যম")),
          unitId,
          date,
          notes: str(row, "নোট"),
        },
      });
      createdIds.push(tx.id);
      created++;
    } catch (e) {
      errors.push({ sheet: SHEET_NAMES.EXPENSES, row: rowNum, message: e instanceof Error ? e.message : "অজানা ত্রুটি" });
    }
  }

  const batchId = await createImportBatch("EXPENSE", fileName, created, userId);
  if (batchId) await prisma.transaction.updateMany({ where: { id: { in: createdIds } }, data: { importBatchId: batchId } });
  return { sheet: SHEET_NAMES.EXPENSES, created, errors };
}

export async function importWorkbook(buffer: Buffer, fileName: string, userId: string | null): Promise<ImportResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const ctx = await buildContext();
  const results: SheetResult[] = [];

  // Strict dependency order — each step's lookups depend on the previous
  // steps having already populated `ctx`.
  results.push(await importOwners(readSheetRows(workbook.getWorksheet(SHEET_NAMES.OWNERS)), fileName, userId, ctx));
  results.push(await importProperties(readSheetRows(workbook.getWorksheet(SHEET_NAMES.PROPERTIES)), fileName, userId, ctx));
  results.push(await importUnitTypes(readSheetRows(workbook.getWorksheet(SHEET_NAMES.UNIT_TYPES)), fileName, userId, ctx));
  results.push(await importUnitOverrides(readSheetRows(workbook.getWorksheet(SHEET_NAMES.UNITS)), ctx));
  results.push(await importTenants(readSheetRows(workbook.getWorksheet(SHEET_NAMES.TENANTS)), fileName, userId, ctx));
  results.push(await importRentPayments(readSheetRows(workbook.getWorksheet(SHEET_NAMES.RENT_PAYMENTS)), fileName, userId, ctx));
  results.push(
    await importOwnerRentPayments(readSheetRows(workbook.getWorksheet(SHEET_NAMES.OWNER_RENT_PAYMENTS)), fileName, userId, ctx)
  );
  results.push(await importUtilityBills(readSheetRows(workbook.getWorksheet(SHEET_NAMES.UTILITY_BILLS)), fileName, userId, ctx));
  results.push(await importEmployees(readSheetRows(workbook.getWorksheet(SHEET_NAMES.EMPLOYEES)), fileName, userId, ctx));
  results.push(await importPayroll(readSheetRows(workbook.getWorksheet(SHEET_NAMES.PAYROLL)), fileName, userId, ctx));
  results.push(await importExpenses(readSheetRows(workbook.getWorksheet(SHEET_NAMES.EXPENSES)), fileName, userId, ctx));

  return {
    results,
    totalCreated: results.reduce((sum, r) => sum + r.created, 0),
    totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
  };
}
