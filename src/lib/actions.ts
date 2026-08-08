"use server";

import { searchEverything } from "@/lib/dashboard-data";

export async function searchAction(query: string) {
  return searchEverything(query);
}
