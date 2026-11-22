import assert from "node:assert/strict";
import test from "node:test";
import { auditSnapshot, recordAudit } from "@/lib/audit";

const actor = { id: "u1", name: "Joy", role: "ADMIN" };

test("an audit entry copies the user and what the record looked like", async () => {
  const saved: unknown[] = [];
  await recordAudit(actor, { action: "transaction.delete", entity: "Transaction", entityId: "t1", propertyId: "p1", summary: "Deleted ৳500", details: { amount: "500", date: new Date("2026-11-02T00:00:00Z") } }, {
    auditLog: { create: async ({ data }) => { saved.push(data); return data; } },
  });
  assert.deepEqual(saved, [{
    userId: "u1", userName: "Joy", userRole: "ADMIN", action: "transaction.delete", entity: "Transaction", entityId: "t1",
    propertyId: "p1", summary: "Deleted ৳500", details: { amount: "500", date: "2026-11-02T00:00:00.000Z" },
  }]);
});

test("a failing audit write never breaks the action it belongs to", async () => {
  const original = console.error;
  console.error = () => {};
  try {
    await assert.doesNotReject(recordAudit(actor, { action: "x", entity: "Y" }, { auditLog: { create: async () => { throw new Error("table missing"); } } }));
  } finally {
    console.error = original;
  }
});

test("snapshots are plain JSON and long summaries are cut", async () => {
  assert.deepEqual(auditSnapshot({ big: BigInt(5), when: new Date("2026-11-02T00:00:00Z"), none: undefined }), { big: "5", when: "2026-11-02T00:00:00.000Z" });
  assert.equal(auditSnapshot(null), undefined);
  let summary = "";
  await recordAudit(null, { action: "a", entity: "b", summary: "x".repeat(500) }, { auditLog: { create: async ({ data }) => { summary = data.summary ?? ""; return data; } } });
  assert.equal(summary.length, 300);
});
