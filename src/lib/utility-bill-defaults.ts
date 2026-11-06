import type { UtilityType } from "@/generated/prisma/client";

export const utilityBillTypes = ["ELECTRICITY", "GAS", "WATER", "WASTE", "SECURITY", "OTHER"] as const satisfies readonly UtilityType[];

export function readUtilityType(value: unknown): UtilityType {
  return utilityBillTypes.find((type) => type === value) ?? "OTHER";
}

export type UtilityBillDefault = {
  type: UtilityType;
  paidByCompany: boolean | null;
  amount: string | null;
};

export function serializeUtilityBillDefaults(
  defaults: { type: UtilityType; paidByCompany: boolean | null; amount: { toFixed(): string } | null }[],
): UtilityBillDefault[] {
  return defaults.map(({ type, paidByCompany, amount }) => ({ type, paidByCompany, amount: amount?.toFixed() ?? null }));
}
