"use server";

import { importWorkbook } from "@/lib/import-export/import";
import type { ImportResult } from "@/lib/import-export/types";

// No auth/session system is wired up anywhere in this app yet (confirmed —
// no other action populates a recordedBy/importedBy user id either), so
// ImportBatch.importedById stays null here too, consistent with the rest of
// the codebase's current state.
export async function importDataAction(formData: FormData): Promise<ImportResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("একটি Excel ফাইল আপলোড করুন");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  return importWorkbook(buffer, file.name, null);
}
