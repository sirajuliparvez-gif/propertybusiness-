import Image from "next/image";

// Shared top of every printable document (rent invoice, utility bill invoice,
// salary slip) so the company logo and name stay identical on all of them.
export function InvoiceHeader({
  brand,
  title,
  subtitle,
  children,
}: {
  brand: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
      <div className="flex items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
          <Image src="/logo.jpg" alt={brand} width={48} height={48} priority className="size-full object-contain" />
        </div>
        <div>
          <p className="text-lg font-bold tracking-tight">{brand}</p>
          {children}
        </div>
      </div>
      <div className="text-right">
        <p className="text-lg font-bold tracking-tight">{title}</p>
        {subtitle ? <p className="text-sm font-medium text-muted-foreground">{subtitle}</p> : null}
      </div>
    </div>
  );
}
