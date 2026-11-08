import { getLocale, getTranslations } from "next-intl/server";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rentBillMarketCode } from "@/lib/rent-bill-number";

export async function RentBillSearch({ markets, month, query, marketId, billMonth, error }: {
  markets: { id: string; name: string; billMarketCode: number }[];
  month: string;
  query?: string;
  marketId?: string;
  billMonth?: string;
  error?: string;
}) {
  const [t, locale] = await Promise.all([getTranslations("Properties"), getLocale()]);

  return (
    <form action={`/${locale}/rent`} method="get" role="search" aria-label={t("rentBillSearchTitle")}
      className="mb-4 space-y-2 rounded-lg border bg-card p-3 print:hidden">
      <input type="hidden" name="month" value={month} />
      <div>
        <h2 className="text-sm font-semibold">{t("rentBillSearchTitle")}</h2>
        <p className="text-xs text-muted-foreground">{t("rentBillSearchHint")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input key={`bill-search:${query ?? ""}`} className="min-w-40 flex-1" name="billSearch" aria-label={t("cashMemoBillNumber")}
          placeholder="R-M01-202611-0001" defaultValue={query ?? ""} maxLength={48} required />
        <select name="billMarket" aria-label={t("rentBillSearchMarket")} defaultValue={marketId ?? ""}
          className="h-8 max-w-full rounded-lg border bg-background px-2 text-sm sm:max-w-64">
          <option value="">{t("rentBillSearchMarket")}</option>
          {markets.map(({ id, name, billMarketCode }) => (
            <option key={id} value={id}>{rentBillMarketCode(billMarketCode)} · {name}</option>
          ))}
        </select>
        <Input key={`bill-month:${billMonth ?? month}`} className="w-auto" type="month" name="billMonth" aria-label={t("invoiceBillMonth")} defaultValue={billMonth ?? month} />
        <Button type="submit" size="sm"><Search className="size-4" />{t("rentBillSearchSubmit")}</Button>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{t(error)}</p> : null}
    </form>
  );
}
