import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

// Who did what: written for deletes, edits, reversals, withdrawals, move-outs, property deletion
// and bulk import. It is best-effort on purpose — a problem writing the log must never stop the
// payment or the correction the user is making — so a failed write is only reported to the server log.
export type AuditActor = { id: string; name: string; role: string };

export type AuditEntry = {
  action: string;
  entity: string;
  entityId?: string | null;
  propertyId?: string | null;
  summary?: string | null;
  // What the record looked like before it was deleted or changed.
  details?: unknown;
};

type AuditDb = { auditLog: { create: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<unknown> } };

const MAX_SUMMARY_LENGTH = 300;

// A plain JSON copy of a record: Decimal becomes a string, Date an ISO string, bigint a string.
export function auditSnapshot(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item)));
}

export async function recordAudit(actor: AuditActor | null, entry: AuditEntry, db: AuditDb = prisma): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: actor?.id ?? null,
        userName: actor?.name ?? null,
        userRole: actor?.role ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        propertyId: entry.propertyId ?? null,
        summary: entry.summary ? entry.summary.slice(0, MAX_SUMMARY_LENGTH) : null,
        details: auditSnapshot(entry.details),
      },
    });
  } catch (error) {
    console.error("Audit log write failed", entry.action, entry.entity, entry.entityId, error);
  }
}
