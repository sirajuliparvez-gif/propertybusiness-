import { ReportMonthSelect } from "@/components/properties/report-month-select";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { getTranslations } from "next-intl/server";
import { TrendingUp, TrendingDown, Wallet, ListChecks, FileText } from "lucide-react";
import { getAllTransactionsData, getPropertyUnitOptions } from "@/lib/transactions-data";
import { TransactionsTable } from "@/components/properties/transactions-table";
import { MobileTransactionsList } from "@/components/mobile/mobile-transactions-list";
import { AddExpenseDialogGlobal } from "@/components/properties/add-expense-dialog-global";
import { AddOwnerWithdrawalDialogGlobal } from "@/components/properties/add-owner-withdrawal-dialog-global";
import { StatTile } from "@/components/stat-tile";
import { formatTaka } from "@/lib/format";

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ month?: string; add?: string }> }) {
  const { month, add } = await searchParams;
  const openAddForm = add === "expense";
  const t = await getTranslations("Properties");
  const [{ transactions, totalIncome, totalExpense, net, entryCount, selectedMonth, availableMonths }, propertyUnitOptions] =
    await Promise.all([getAllTransactionsData(month), getPropertyUnitOptions()]);

  const dismissAddFormTo = selectedMonth ? `/transactions?month=${selectedMonth}` : "/transactions";

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("transactionsPageTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("transactionsPageSubtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReportMonthSelect month={selectedMonth ?? "ALL"} months={availableMonths} basePath="/transactions" allowAll />
          <Button variant="outline" render={<Link href={`/transactions/report${selectedMonth ? `?month=${selectedMonth}` : ""}`} />} nativeButton={false}><FileText className="size-4" />{t("transactionReportTitle")}</Button>
          <AddOwnerWithdrawalDialogGlobal />
          <AddExpenseDialogGlobal
            key={String(openAddForm)}
            properties={propertyUnitOptions}
            dismissTo={openAddForm ? dismissAddFormTo : undefined}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <StatTile
          label={t("periodOperatingIncome")}
          value={formatTaka(totalIncome)}
          icon={TrendingUp}
          tone="success"
        />
        <StatTile
          label={t("periodOperatingExpense")}
          value={formatTaka(totalExpense)}
          icon={TrendingDown}
          tone="destructive"
        />
        <StatTile
          label={t("periodOperatingNet")}
          value={formatTaka(net)}
          icon={Wallet}
          tone={net >= 0 ? "teal" : "destructive"}
        />
        <StatTile
          label={t("totalEntries")}
          value={String(entryCount)}
          icon={ListChecks}
          tone="default"
        />
      </div>

      <MobileTransactionsList key={selectedMonth ?? "ALL"} transactions={transactions} />
      <div className="hidden md:block">
        <TransactionsTable key={selectedMonth ?? "ALL"} transactions={transactions} />
      </div>
    </div>
  );
}
