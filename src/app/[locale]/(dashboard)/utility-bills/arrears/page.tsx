import { UtilityBillsView } from "../utility-bills-view";

export default async function UtilityArrearsPage({ searchParams }: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  return <UtilityBillsView month={month} unpaidOnly />;
}
