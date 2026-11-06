import { UtilityBillsView } from "./utility-bills-view";

export default async function UtilityBillsPage({ searchParams }: {
  searchParams: Promise<{ month?: string; add?: string }>;
}) {
  const { month, add } = await searchParams;
  return <UtilityBillsView month={month} openAddForm={add === "bill"} />;
}
