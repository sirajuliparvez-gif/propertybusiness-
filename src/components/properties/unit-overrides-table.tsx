"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type UnitRow = {
  // Present only for a row seeded from an already-persisted Unit (editing an
  // existing UnitType) — such rows can't be removed via this table, since
  // deleting a Unit could orphan its real TenantLease/UtilityBill/Transaction
  // history. Use the unit's own Active/Inactive toggle to retire it instead.
  id?: string;
  label: string;
  sizeValue: string;
  sizeUnit: string;
  ownerRent: string;
  ownerDownpayment: string;
  tenantRent: string;
  tenantDownpayment: string;
  nightlyRate: string;
  // Present only when this unit currently has an active tenant — when set,
  // tenantDownpayment holds THAT tenant's live lease balance (editable here
  // as a manual correction), not the unit's future-tenant default. Never set
  // for a brand-new row added in this same edit session (always vacant).
  tenantLeaseId?: string;
};

type Defaults = {
  sizeValue: string;
  sizeUnit: string;
  ownerRent: string;
  ownerDownpayment: string;
  tenantRent: string;
  tenantDownpayment: string;
  nightlyRate: string;
};

function makeRow(index: number, startIndex: number, defaults: Defaults): UnitRow {
  return {
    label: `Unit ${startIndex + index + 1}`,
    sizeValue: defaults.sizeValue,
    sizeUnit: defaults.sizeUnit,
    ownerRent: defaults.ownerRent,
    ownerDownpayment: defaults.ownerDownpayment,
    tenantRent: defaults.tenantRent,
    tenantDownpayment: defaults.tenantDownpayment,
    nightlyRate: defaults.nightlyRate,
  };
}

// Rebuilds the row list for a new unitCount/startIndex, and re-syncs any row
// that still matches the PREVIOUS default values (i.e. wasn't manually
// customized) to the new defaults — so filling in the UnitType-level fields
// after the row count is already set still populates every untouched row,
// while rows the user has already edited by hand are left alone.
function syncRows(
  count: number,
  prevRows: UnitRow[],
  startIndex: number,
  prevDefaults: Defaults,
  defaults: Defaults
): UnitRow[] {
  return Array.from({ length: count }, (_, i) => {
    const existing = prevRows[i];
    if (!existing) return makeRow(i, startIndex, defaults);
    return {
      id: existing.id,
      tenantLeaseId: existing.tenantLeaseId,
      label: existing.label,
      sizeValue: existing.sizeValue === prevDefaults.sizeValue ? defaults.sizeValue : existing.sizeValue,
      sizeUnit: existing.sizeUnit === prevDefaults.sizeUnit ? defaults.sizeUnit : existing.sizeUnit,
      ownerRent: existing.ownerRent === prevDefaults.ownerRent ? defaults.ownerRent : existing.ownerRent,
      ownerDownpayment:
        existing.ownerDownpayment === prevDefaults.ownerDownpayment
          ? defaults.ownerDownpayment
          : existing.ownerDownpayment,
      tenantRent: existing.tenantRent === prevDefaults.tenantRent ? defaults.tenantRent : existing.tenantRent,
      // A row with tenantLeaseId holds that tenant's live lease balance, not
      // a template default — never sweep it into the UnitType-level default
      // even if it happens to match, unlike every other field here.
      tenantDownpayment: existing.tenantLeaseId
        ? existing.tenantDownpayment
        : existing.tenantDownpayment === prevDefaults.tenantDownpayment
          ? defaults.tenantDownpayment
          : existing.tenantDownpayment,
      nightlyRate:
        existing.nightlyRate === prevDefaults.nightlyRate ? defaults.nightlyRate : existing.nightlyRate,
    };
  });
}

export function UnitOverridesTable({
  unitCount,
  defaultSizeValue,
  defaultSizeUnit,
  defaultOwnerRent,
  defaultOwnerDownpayment = "",
  defaultTenantRent,
  defaultTenantDownpayment,
  defaultNightlyRate = "",
  startIndex = 0,
  fieldName = "unitOverridesJson",
  showOwnerRent = true,
  showNightlyRate = false,
  onCountChange,
  initialRows,
  initiallyExpanded = false,
}: {
  unitCount: number;
  defaultSizeValue: string;
  defaultSizeUnit: string;
  defaultOwnerRent: string;
  defaultOwnerDownpayment?: string;
  defaultTenantRent: string;
  defaultTenantDownpayment: string;
  defaultNightlyRate?: string;
  startIndex?: number;
  fieldName?: string;
  showOwnerRent?: boolean;
  showNightlyRate?: boolean;
  onCountChange?: (count: number) => void;
  // Seeds the table from already-persisted Units (editing an existing
  // UnitType) instead of always generating fresh blank rows from unitCount.
  initialRows?: UnitRow[];
  initiallyExpanded?: boolean;
}) {
  const t = useTranslations("Properties");
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [rows, setRows] = useState<UnitRow[]>(initialRows ?? []);
  const prevDefaultsRef = useRef<Defaults>({
    sizeValue: "",
    sizeUnit: "",
    ownerRent: "",
    ownerDownpayment: "",
    tenantRent: "",
    tenantDownpayment: "",
    nightlyRate: "",
  });

  useEffect(() => {
    const defaults = {
      sizeValue: defaultSizeValue,
      sizeUnit: defaultSizeUnit,
      ownerRent: defaultOwnerRent,
      ownerDownpayment: defaultOwnerDownpayment,
      tenantRent: defaultTenantRent,
      tenantDownpayment: defaultTenantDownpayment,
      nightlyRate: defaultNightlyRate,
    };
    setRows((prev) => syncRows(Math.max(0, unitCount), prev, startIndex, prevDefaultsRef.current, defaults));
    prevDefaultsRef.current = defaults;
  }, [
    unitCount,
    startIndex,
    defaultSizeValue,
    defaultSizeUnit,
    defaultOwnerRent,
    defaultOwnerDownpayment,
    defaultTenantRent,
    defaultTenantDownpayment,
    defaultNightlyRate,
  ]);

  function updateRow(index: number, patch: Partial<UnitRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  // onCountChange is only called here, directly in response to the user's
  // own Add/Remove click (never from the sync effect above) — calling it
  // from a generic "whenever rows.length changes" effect instead created a
  // feedback loop with the parent's unitCount state (parent update → sync
  // effect changes rows.length → effect calls back into the parent → ...),
  // which tripped React's "Maximum update depth exceeded" safeguard.
  function addRow() {
    const next = [...rows, makeRow(rows.length, startIndex, prevDefaultsRef.current)];
    setRows(next);
    onCountChange?.(next.length);
  }

  function removeRow(index: number) {
    if (rows.length <= 1) return;
    if (rows[index]?.id) return; // existing persisted units can't be removed here
    const next = rows.filter((_, i) => i !== index);
    setRows(next);
    onCountChange?.(next.length);
  }

  function resetToDefaults() {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        sizeValue: defaultSizeValue,
        sizeUnit: defaultSizeUnit,
        ownerRent: defaultOwnerRent,
        ownerDownpayment: defaultOwnerDownpayment,
        tenantRent: defaultTenantRent,
        // Never reset an occupied row's live lease balance to the unrelated
        // future-tenant default — see the tenantLeaseId doc comment above.
        tenantDownpayment: r.tenantLeaseId ? r.tenantDownpayment : defaultTenantDownpayment,
        nightlyRate: defaultNightlyRate,
      }))
    );
  }

  if (unitCount < 1) return null;

  return (
    <div className="rounded-lg border">
      <input type="hidden" name={fieldName} value={JSON.stringify(rows)} />
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
      >
        <span className="text-muted-foreground">
          {t("customizePerUnitHint", { count: rows.length })}
        </span>
        <span className="flex items-center gap-1 font-medium text-primary">
          {t("customizePerUnit")}
          {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </span>
      </button>

      {expanded ? (
        <div className="border-t">
          <div className="flex items-center justify-between px-3 pt-2">
            <Button type="button" variant="outline" size="xs" onClick={addRow}>
              <Plus className="size-3" />
              {t("addUnit")}
            </Button>
            <Button type="button" variant="ghost" size="xs" onClick={resetToDefaults}>
              <RotateCcw className="size-3" />
              {t("resetToDefault")}
            </Button>
          </div>
          <div className="max-h-128 overflow-auto px-3 pb-3">
            <table className="w-full min-w-240 text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="w-32 py-2 pr-3 font-medium">{t("unitLabel")}</th>
                  <th className="w-24 py-2 pr-3 font-medium">{t("sizeValue")}</th>
                  <th className="w-20 py-2 pr-3 font-medium">{t("sizeUnit")}</th>
                  {showOwnerRent ? (
                    <th className="py-2 pr-3 font-medium">{t("ownerRentAmount")}</th>
                  ) : null}
                  {showOwnerRent ? (
                    <th className="py-2 pr-3 font-medium">{t("ownerDownpaymentAmount")}</th>
                  ) : null}
                  <th className="py-2 pr-3 font-medium">{t("tenantDefaultRentAmount")}</th>
                  <th className="py-2 pr-3 font-medium">{t("tenantDefaultDownpaymentAmount")}</th>
                  {showNightlyRate ? (
                    <th className="py-2 pr-3 font-medium">{t("tenantDefaultNightlyRateAmount")}</th>
                  ) : null}
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-3">
                      <Input
                        value={row.label}
                        onChange={(e) => updateRow(i, { label: e.target.value })}
                        className="h-9 text-sm"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        type="number"
                        step="any"
                        min={0}
                        value={row.sizeValue}
                        onChange={(e) => updateRow(i, { sizeValue: e.target.value })}
                        className="h-9 text-sm"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        value={row.sizeUnit}
                        onChange={(e) => updateRow(i, { sizeUnit: e.target.value })}
                        className="h-9 text-sm"
                      />
                    </td>
                    {showOwnerRent ? (
                      <td className="py-2 pr-3">
                        <Input
                          type="number"
                          step="any"
                          min={0}
                          value={row.ownerRent}
                          onChange={(e) => updateRow(i, { ownerRent: e.target.value })}
                          className="h-9 text-sm"
                        />
                      </td>
                    ) : null}
                    {showOwnerRent ? (
                      <td className="py-2 pr-3">
                        <Input
                          type="number"
                          step="any"
                          min={0}
                          value={row.ownerDownpayment}
                          onChange={(e) => updateRow(i, { ownerDownpayment: e.target.value })}
                          className="h-9 text-sm"
                        />
                      </td>
                    ) : null}
                    <td className="py-2 pr-3">
                      <Input
                        type="number"
                        step="any"
                        min={0}
                        value={row.tenantRent}
                        onChange={(e) => updateRow(i, { tenantRent: e.target.value })}
                        className="h-9 text-sm"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        type="number"
                        step="any"
                        min={0}
                        value={row.tenantDownpayment}
                        onChange={(e) => updateRow(i, { tenantDownpayment: e.target.value })}
                        className="h-9 text-sm"
                      />
                      {row.tenantLeaseId ? (
                        <p className="mt-1 whitespace-nowrap text-xs text-primary">
                          {t("currentTenantBalanceHint")}
                        </p>
                      ) : null}
                    </td>
                    {showNightlyRate ? (
                      <td className="py-2 pr-3">
                        <Input
                          type="number"
                          step="any"
                          min={0}
                          value={row.nightlyRate}
                          onChange={(e) => updateRow(i, { nightlyRate: e.target.value })}
                          className="h-9 text-sm"
                        />
                      </td>
                    ) : null}
                    <td className="py-2 text-right">
                      {row.id ? null : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={rows.length <= 1}
                          onClick={() => removeRow(i)}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
