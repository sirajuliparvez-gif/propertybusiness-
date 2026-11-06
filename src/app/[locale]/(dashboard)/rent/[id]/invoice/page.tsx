import TenantInvoicePage from "@/components/properties/tenant-invoice-page";

export default function RentInvoicePage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; bill?: string; tenant?: string; print?: string; receive?: string; embed?: string }>;
}) {
  return <TenantInvoicePage {...props} fromRent />;
}
