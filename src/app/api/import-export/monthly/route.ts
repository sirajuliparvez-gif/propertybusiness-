import { NextResponse, type NextRequest } from "next/server";
import { generateMonthlyWorkbook } from "@/lib/import-export/monthly";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // The route-level guard (not just the page) — middleware's matcher
  // intentionally skips /api, so this endpoint would otherwise be reachable
  // by anyone who guesses the URL even while signed out.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const propertyId = req.nextUrl.searchParams.get("propertyId");
  if (!propertyId) {
    return NextResponse.json({ error: "প্রপার্টি বেছে নিন" }, { status: 400 });
  }

  const { buffer, propertyName } = await generateMonthlyWorkbook(propertyId);
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  // Bengali property names aren't valid in the plain filename= parameter
  // (ASCII-only per RFC 6266) — ship both: an ASCII fallback and the real
  // name via the UTF-8 filename*= form most browsers actually display.
  const encodedName = encodeURIComponent(`${propertyName}-${monthKey}.xlsx`);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="monthly-entry-${monthKey}.xlsx"; filename*=UTF-8''${encodedName}`,
    },
  });
}
