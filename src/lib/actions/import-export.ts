"use server";

import { importWorkbook } from "@/lib/import-export/import";
import type { ImportResult } from "@/lib/import-export/types";
import { requireAdmin } from "@/lib/auth/session";

// An Excel workbook is parsed fully in memory, so an oversized upload is
// refused up front instead of exhausting the server.
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export async function importDataAction(formData: FormData): Promise<ImportResult> {
  // Bulk import writes owners, properties, leases and money rows, so it is
  // admin-only and the batch records who ran it.
  const user = await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("একটি Excel ফাইল আপলোড করুন");
  }
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error("ফাইলটি অনেক বড় (সর্বোচ্চ ১০ MB)");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  return importWorkbook(buffer, file.name, user.id);
}
