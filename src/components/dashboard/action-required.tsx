"use client";

import type { ReactNode } from "react";
import { useTranslations, useFormatter, useLocale } from "next-intl";
import {
  Wallet,
  Zap,
  AlertTriangle,
  Users2,
  DoorOpen,
  FileClock,
  BedDouble,
  FileWarning,
  CalendarClock,
  CircleCheck,
  ListChecks,
  ChevronRight,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecordTenantRentPaymentDialog } from "@/components/properties/record-tenant-rent-payment-dialog";
import { RecordPayrollPaymentDialog } from "@/components/properties/record-payroll-payment-dialog";
import { PayUtilityBillButton } from "@/components/properties/utility-bills-table";
import { formatTaka, monthLabel } from "@/lib/format";
import type { ActionRequiredData } from "@/lib/dashboard-data";

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-success/10 text-success">
        <CircleCheck className="size-5" />
      </span>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function Row({
  title,
  subtitle,
  right,
  badge,
  renderAction,
}: {
  title: string;
  subtitle: string;
  right?: string;
  badge?: { label: string; tone: "destructive" | "warning" };
  renderAction?: (content: ReactNode) => ReactNode;
}) {
  const content = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {right ? (
          <span className="font-mono text-sm font-semibold tabular-nums">{right}</span>
        ) : null}
        {badge ? (
          <Badge
            className={
              badge.tone === "destructive"
                ? "bg-destructive/15 text-destructive border-transparent"
                : "bg-warning/15 text-warning border-transparent"
            }
          >
            {badge.label}
          </Badge>
        ) : null}
        {renderAction ? <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" /> : null}
      </span>
    </>
  );
  return (
    <li className={renderAction ? "-mx-2 [&>button]:rounded-md [&>button]:px-2 [&>button]:hover:bg-muted/60" : "flex items-center gap-3 py-2.5"}>
      {renderAction ? renderAction(content) : content}
    </li>
  );
}

type PaymentTab = "rentDue" | "utilityDue" | "payrollDue";

export function ActionRequired({ data, month, initialTab }: {
  data: ActionRequiredData;
  month: string;
  initialTab?: string;
}) {
  const t = useTranslations("Dashboard");
  const format = useFormatter();
  const locale = useLocale();
  const tp = useTranslations("Properties");
  const returnTo = (tab: PaymentTab) => `/?month=${month}&dues=${tab}#action-required`;
  const utilityNames = {
    GAS: tp("utilityTypeGas"),
    ELECTRICITY: tp("utilityTypeElectricity"),
    WATER: tp("utilityTypeWater"),
    OTHER: tp("utilityTypeOther"),
  };

  const tabs = [
    {
      key: "rentDue",
      label: t("rentDue"),
      icon: Wallet,
      count: data.counts.rentDue,
      render: () =>
        data.rentDue.length === 0 ? (
          <EmptyState label={t("noItems")} />
        ) : (
          <ul className="divide-y">
            {data.rentDue.map((r) => (
              <Row
                key={`${r.id}:${r.amount}`}
                title={r.tenantName}
                subtitle={`${r.propertyName} · ${r.unitLabel} · ${monthLabel(r.month, locale)}`}
                right={formatTaka(r.amount)}
                renderAction={r.amount > 0 ? (content) => (
                  <RecordTenantRentPaymentDialog
                    propertyId={r.propertyId}
                    tenantLeaseId={r.tenantLeaseId}
                    tenantName={r.tenantName}
                    propertyName={r.propertyName}
                    unitLabel={r.unitLabel}
                    initialBillingMonth={r.month}
                    monthlyRentAmount={r.dueAmount}
                    paymentProgress={[{ month: r.month, dueAmount: r.dueAmount, paidAmount: r.paidAmount }]}
                    returnTo={returnTo("rentDue")}
                    variant="row"
                    rowContent={content}
                    triggerLabel={`${tp("collectRent")} · ${r.tenantName} · ${monthLabel(r.month, locale)}`}
                  />
                ) : undefined}
                badge={{
                  label: r.overdue ? t("overdue") : t("dueSoon"),
                  tone: r.overdue ? "destructive" : "warning",
                }}
              />
            ))}
          </ul>
        ),
    },
    {
      key: "utilityDue",
      label: t("utilityDueTab"),
      icon: Zap,
      count: data.counts.utilityDue,
      render: () =>
        data.utilityDue.length === 0 ? (
          <EmptyState label={t("noItems")} />
        ) : (
          <ul className="divide-y">
            {data.utilityDue.map((u) => (
              <Row
                key={`${u.id}:${u.amount}`}
                title={u.propertyName}
                subtitle={[utilityNames[u.type], u.tenantName, monthLabel(u.month, locale)].filter(Boolean).join(" · ")}
                right={formatTaka(u.amount)}
                renderAction={u.amount > 0 ? (content) => (
                  <PayUtilityBillButton
                    billId={u.id}
                    propertyId={u.propertyId}
                    type={u.type}
                    amount={u.billAmount}
                    paidAmount={u.paidAmount}
                    paidByCompany={u.paidByCompany}
                    billLabel={[u.propertyName, utilityNames[u.type], u.tenantName, monthLabel(u.month, locale)].filter(Boolean).join(" · ")}
                    returnTo={returnTo("utilityDue")}
                    variant="row"
                    rowContent={content}
                  />
                ) : undefined}
                badge={{
                  label: u.overdue ? t("overdue") : t("dueSoon"),
                  tone: u.overdue ? "destructive" : "warning",
                }}
              />
            ))}
          </ul>
        ),
    },
    {
      key: "downpaymentExhausted",
      label: t("downpaymentExhausted"),
      icon: AlertTriangle,
      count: data.downpaymentExhausted.length,
      render: () =>
        data.downpaymentExhausted.length === 0 ? (
          <EmptyState label={t("noItems")} />
        ) : (
          <ul className="divide-y">
            {data.downpaymentExhausted.map((d) => (
              <Row
                key={d.id}
                title={d.tenantName}
                subtitle={`${d.propertyName} · ${d.unitLabel}`}
                right={formatTaka(d.balance)}
                badge={{ label: t("overdue"), tone: "destructive" }}
              />
            ))}
          </ul>
        ),
    },
    {
      key: "payrollDue",
      label: t("payrollDue"),
      icon: Users2,
      count: data.counts.payrollDue,
      render: () =>
        data.payrollDue.length === 0 ? (
          <EmptyState label={t("noItems")} />
        ) : (
          <ul className="divide-y">
            {data.payrollDue.map((p) => (
              <Row
                key={`${p.id}:${p.amount}`}
                title={p.employeeName}
                subtitle={`${p.propertyName} · ${monthLabel(p.month, locale)}`}
                right={formatTaka(p.amount)}
                renderAction={p.amount > 0 ? (content) => (
                  <RecordPayrollPaymentDialog
                    propertyId={p.propertyId}
                    employeeId={p.employeeId}
                    employeeName={p.employeeName}
                    billingMonth={p.month}
                    defaultAmount={p.amount}
                    returnTo={returnTo("payrollDue")}
                    rowContent={content}
                  />
                ) : undefined}
                badge={{
                  label: p.overdue ? t("overdue") : t("dueSoon"),
                  tone: p.overdue ? "destructive" : "warning",
                }}
              />
            ))}
          </ul>
        ),
    },
    {
      key: "vacantUnits",
      label: t("vacantUnitsTab"),
      icon: DoorOpen,
      count: data.counts.vacantUnits,
      render: () =>
        data.vacantUnits.length === 0 ? (
          <EmptyState label={t("noItems")} />
        ) : (
          <ul className="divide-y">
            {data.vacantUnits.map((u) => (
              <Row key={u.id} title={`${u.propertyName} · ${u.unitLabel}`} subtitle={u.unitTypeLabel} />
            ))}
          </ul>
        ),
    },
    {
      key: "agreementsExpiring",
      label: t("agreementsExpiring"),
      icon: FileClock,
      count: data.counts.agreementsExpiring,
      render: () =>
        data.agreementsExpiring.length === 0 ? (
          <EmptyState label={t("noItems")} />
        ) : (
          <ul className="divide-y">
            {data.agreementsExpiring.map((a) => (
              <Row
                key={a.id}
                title={a.propertyName}
                subtitle={format.dateTime(a.endDate, { dateStyle: "medium" })}
                badge={{ label: t("dueSoon"), tone: "warning" }}
              />
            ))}
          </ul>
        ),
    },
    {
      key: "tenantLeaseExpiring",
      label: t("tenantLeaseExpiring"),
      icon: CalendarClock,
      count: data.counts.tenantLeaseExpiring,
      render: () =>
        data.tenantLeaseExpiring.length === 0 ? (
          <EmptyState label={t("noItems")} />
        ) : (
          <ul className="divide-y">
            {data.tenantLeaseExpiring.map((l) => (
              <Row
                key={l.id}
                title={l.tenantName}
                subtitle={`${l.propertyName} · ${l.unitLabel}`}
                right={format.dateTime(l.endDate, { dateStyle: "medium" })}
                badge={{ label: t("dueSoon"), tone: "warning" }}
              />
            ))}
          </ul>
        ),
    },
    {
      key: "missingDocuments",
      label: t("missingDocuments"),
      icon: FileWarning,
      count: data.counts.missingDocuments,
      render: () =>
        data.missingDocuments.length === 0 ? (
          <EmptyState label={t("noItems")} />
        ) : (
          <ul className="divide-y">
            {data.missingDocuments.map((m) => (
              <Row
                key={m.id}
                title={m.label}
                subtitle={t(m.reason)}
                badge={{ label: t("overdue"), tone: "destructive" }}
              />
            ))}
          </ul>
        ),
    },
    {
      key: "guestStays",
      label: t("guestCheckInOut"),
      icon: BedDouble,
      count: data.guestCheckIns.length + data.guestCheckOuts.length,
      render: () =>
        data.guestCheckIns.length === 0 && data.guestCheckOuts.length === 0 ? (
          <EmptyState label={t("noItems")} />
        ) : (
          <ul className="divide-y">
            {data.guestCheckIns.map((g) => (
              <Row
                key={`in-${g.id}`}
                title={g.guestName}
                subtitle={`${g.propertyName} · ${g.unitLabel}`}
                badge={{ label: t("checkIn"), tone: "warning" }}
              />
            ))}
            {data.guestCheckOuts.map((g) => (
              <Row
                key={`out-${g.id}`}
                title={g.guestName}
                subtitle={`${g.propertyName} · ${g.unitLabel}`}
                badge={{ label: t("checkOut"), tone: "warning" }}
              />
            ))}
          </ul>
        ),
    },
  ];

  const selectedTab = tabs.find((tab) => tab.key === initialTab)?.key ?? "rentDue";

  return (
    <Card id="action-required">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-warning/25 to-warning/5 text-warning">
            <ListChecks className="size-3.5" />
          </span>
          {t("actionRequired")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs key={selectedTab} defaultValue={selectedTab}>
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <TabsList className="h-auto w-max justify-start gap-1 bg-transparent p-0">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className="shrink-0 gap-1.5 whitespace-nowrap"
                >
                  <tab.icon className="size-3.5" />
                  {tab.label}
                  {tab.count > 0 ? (
                    <Badge className="ml-0.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] bg-destructive/15 text-destructive border-transparent">
                      {tab.count}
                    </Badge>
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {tabs.map((tab) => (
            <TabsContent key={tab.key} value={tab.key}>
              {tab.render()}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
