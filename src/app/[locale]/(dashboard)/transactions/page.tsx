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

export default async function TransactionsPage() {
  const t = await getTranslations("Properties");
  const [{ transactions, totalIncome, totalExpense, net, entryCount }, propertyUnitOptions] =
    await Promise.all([getAllTransactionsData(), getPropertyUnitOptions()]);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("transactionsPageTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("transactionsPageSubtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/transactions/report" />} nativeButton={false}><FileText className="size-4" />{t("transactionReportTitle")}</Button>
          <AddOwnerWithdrawalDialogGlobal />
          <AddExpenseDialogGlobal properties={propertyUnitOptions} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <StatTile
          label={t("totalIncome")}
          value={formatTaka(totalIncome)}
          icon={TrendingUp}
          tone="success"
        />
        <StatTile
          label={t("totalOutgoing")}
          value={formatTaka(totalExpense)}
          icon={TrendingDown}
          tone="destructive"
        />
        <StatTile
          label={t("netCashFlow")}
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

      <MobileTransactionsList transactions={transactions} />
      <div className="hidden md:block">
        <TransactionsTable transactions={transactions} />
      </div>
    </div>
  );
}
