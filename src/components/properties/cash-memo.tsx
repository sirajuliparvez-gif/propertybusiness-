import { useTranslations } from "next-intl";
import { InvoiceHeader } from "@/components/invoice-header";

export const cashMemoClassName =
  "cash-memo flex flex-col gap-4 overflow-hidden rounded-lg border border-sky-900/35 bg-card p-5 text-sm sm:p-6 print:p-3";

export function CashMemoHeader({ brand, title, month, property, unit, name, contact, date, billNumber, companyAddress, companyPhone, labels }: {
  brand: string;
  title: string;
  month: string;
  property: string;
  unit: string | null;
  name: string;
  contact?: string | null;
  date: string;
  billNumber: string;
  companyAddress: string;
  companyPhone: string;
  labels: { unit: string; name: string; month: string; date: string; billNumber: string };
}) {
  return (
    <div className="cash-memo-header space-y-3">
      <InvoiceHeader
        brand={brand}
        title={title}
        details={
          <address className="cash-memo-company mt-1 rounded-sm border-s-2 border-sky-900/45 bg-sky-500/5 px-2 py-1 text-xs not-italic text-muted-foreground">
            <p>{companyAddress}</p>
            <p className="tabular-nums">{companyPhone}</p>
          </address>
        }
      >
        <p className="text-xs font-medium text-muted-foreground">{property}</p>
      </InvoiceHeader>
      <dl className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
        {[
          [labels.billNumber, billNumber],
          [labels.date, date],
          [labels.unit, unit ?? "—"],
          [labels.month, month],
          [labels.name, name],
        ].map(([label, value]) => (
          <div key={label} className="flex min-w-0 flex-wrap items-baseline gap-x-2 border-b border-dashed pb-1">
            <dt className="font-semibold">{label}</dt>
            <dd className="min-w-0 break-words font-medium tabular-nums">
              {value}
              {label === labels.name && contact ? (
                <span className="ms-2 text-xs text-muted-foreground">{contact}</span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function CashMemoReading({ current, previous, units, label, unitLabel, missing, locale }: {
  current: number;
  previous: number | null;
  units: number | null;
  label: string;
  unitLabel: string;
  missing: string;
  locale: string;
}) {
  const t = useTranslations("Properties");
  const format = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US", { maximumFractionDigits: 6 });
  return (
    <p className="cash-memo-reading mt-1 whitespace-normal text-xs" data-testid="cash-memo-reading">
      <span className="sr-only">{label}</span>
      <span className="inline-flex items-end gap-1.5 tabular-nums">
        <span className="grid text-center">
          <span className="font-normal">{t("invoiceElectricityCurrent")}</span>
          <strong>{format.format(current)}</strong>
        </span>
        <span>−</span>
        <span className="grid text-center">
          <span className="font-normal">{t("previousMeterReading")}</span>
          <strong>{previous == null ? "—" : format.format(previous)}</strong>
        </span>
        <span>=</span>
        <span className="grid text-center">
          <span className="font-normal">{t("cashMemoConsumption")}</span>
          <strong title={units == null ? missing : undefined}>
            {units == null ? "—" : format.format(units)} {unitLabel}
          </strong>
        </span>
      </span>
    </p>
  );
}

export function CashMemoHandwritingRow({ label }: { label: string }) {
  return (
    <tr className="cash-memo-handwriting-row hidden print:table-row">
      <th scope="row" className="px-2 text-start font-semibold">{label}</th>
      <td className="px-2">
        <span aria-hidden="true" className="cash-memo-handwriting-line" />
      </td>
    </tr>
  );
}

export function CashMemoSignatures({ tenant, company }: { tenant: string; company: string }) {
  return (
    <div className="cash-memo-signatures grid grid-cols-2 gap-4 border-b-4 border-sky-900/80 pt-4 text-xs">
      <span className="justify-self-start border-t border-dashed px-1 pb-2 pt-1">{tenant}</span>
      <span className="justify-self-end border-t border-dashed px-1 pb-2 pt-1">{company}</span>
    </div>
  );
}
