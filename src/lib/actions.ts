"use server";

import { searchEverything } from "@/lib/dashboard-data";

import { requireCurrentUser } from "@/lib/auth/session";
export async function searchAction(query: string) {
  await requireCurrentUser();
  return searchEverything(query);
}
