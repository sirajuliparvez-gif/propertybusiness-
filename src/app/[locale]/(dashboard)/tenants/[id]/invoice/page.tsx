import TenantInvoicePage from "@/components/properties/tenant-invoice-page";

export default function InvoicePage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; bill?: string }>;
}) {
  return <TenantInvoicePage {...props} />;
}
