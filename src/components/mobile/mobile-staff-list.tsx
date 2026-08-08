"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InitialAvatar } from "@/components/properties/initial-avatar";
import { StatusPill } from "@/components/properties/status-pill";
import { EmployeeActions } from "@/components/properties/employee-actions";
import { RecordPayrollPaymentDialog } from "@/components/properties/record-payroll-payment-dialog";
import { formatTaka, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AllStaffData } from "@/lib/employees-data";
import type { PropertyDetail } from "@/lib/properties-data";

type Filter = "all" | "paid" | "overdue" | "inactive" | "former";

export function MobileStaffList({
  staff,
  propertyId,
}: {
  staff: PropertyDetail["staff"] | AllStaffData["staff"];
  // Set on the per-property page (single-property staff list, no per-row
  // propertyId/propertyName) so the payroll dialog still knows which
  // property it's recording against — mirrors StaffTable's own `propertyId` prop.
  propertyId?: string;
}) {
  const t = useTranslations("Properties");
  const [filter, setFilter] = useState<Filter>("all");

  const payrollStatusLabels = { PAID: t("paid"), PENDING: t("pending") };

  const filtered = useMemo(() => {
    if (filter === "paid") return staff.filter((s) => s.status === "ACTIVE" && s.overdueAmount <= 0);
    if (filter === "overdue") return staff.filter((s) => s.status === "ACTIVE" && s.overdueAmount > 0);
    if (filter === "inactive") return staff.filter((s) => s.status === "INACTIVE");
    if (filter === "former") return staff.filter((s) => s.status === "TERMINATED");
    return staff;
  }, [staff, filter]);

  if (staff.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground md:hidden">{t("noStaff")}</p>;
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: t("filterAll") },
    { key: "paid", label: t("filterPaid") },
    { key: "overdue", label: t("filterOverdue") },
    { key: "inactive", label: t("filterInactive") },
    { key: "former", label: t("filterFormer") },
  ];

  return (
    <div className="flex flex-col gap-3 md:hidden">
      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === f.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-input text-muted-foreground hover:bg-muted"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("noStaff")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((s) => {
            const isInactive = s.status === "INACTIVE";
            const isTerminated = s.status === "TERMINATED";
            const rowPropertyId = propertyId ?? (s as { propertyId?: string | null }).propertyId ?? null;
            const rowPropertyName = (s as { propertyName?: string | null }).propertyName;
            return (
              <Card key={s.id} className={cn("p-0", isInactive || isTerminated ? "opacity-60" : undefined)}>
                <Link
                  href={`/employees/${s.id}`}
                  className="flex items-center gap-3 p-4 transition-colors active:bg-muted/60"
                >
                  <InitialAvatar name={s.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.role}
                      {propertyId
                        ? ""
                        : rowPropertyId
                          ? ` · ${rowPropertyName}`
                          : ` · ${t("companyStaffLabel")}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-semibold tabular-nums">
                      {formatTaka(s.salaryAmount)}
                    </p>
                    {isTerminated ? (
                      <Badge className="border-transparent bg-muted text-muted-foreground">
                        {t("filterFormer")}
                      </Badge>
                    ) : isInactive ? (
                      <Badge className="border-transparent bg-muted text-muted-foreground">
                        {t("inactiveLabel")}
                      </Badge>
                    ) : (
                      <StatusPill status={s.payrollStatus} labels={payrollStatusLabels} />
                    )}
                  </div>
                </Link>
                {isTerminated && s.terminatedAt ? (
                  <p className="border-t px-4 py-2 text-xs text-muted-foreground">
                    {formatDate(s.terminatedAt)}
                  </p>
                ) : (
                  <div className="flex items-center justify-end gap-1.5 border-t px-4 py-2">
                    {s.status === "ACTIVE" ? (
                      <RecordPayrollPaymentDialog
                        propertyId={rowPropertyId}
                        employeeId={s.id}
                        defaultAmount={s.salaryAmount}
                        returnTo={propertyId ? undefined : "/employees"}
                        iconOnly
                      />
                    ) : null}
                    <EmployeeActions
                      employeeId={s.id}
                      propertyId={rowPropertyId}
                      status={s.status}
                      returnTo={propertyId ? undefined : "/employees"}
                    />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
