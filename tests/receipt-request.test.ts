import test from "node:test";
import assert from "node:assert/strict";
import { receiptAttempt, validReceiptRequestId } from "@/lib/receipt-request";
function form(amount = "9000") {
  const data = new FormData();
  data.set("amount", amount); data.set("date", "2026-11-08"); data.set("invoiceMonth", "2026-10");
  return data;
}
test("retrying the same payment keeps its original request id", () => {
  const data = form(); const first = receiptAttempt(data, null);
  data.set("receiptRequestId", first.id);
  data.set("$ACTION_REF_1", "framework metadata");
  assert.equal(receiptAttempt(data, first).id, first.id);
});
test("changing the amount, received date or rent month starts a distinct attempt", () => {
  const first = receiptAttempt(form(), null);
  for (const [key, value] of [["amount", "8000"], ["date", "2026-11-07"], ["invoiceMonth", "2026-11"]]) {
    const data = form(); data.set(key, value);
    assert.notEqual(receiptAttempt(data, first).id, first.id);
  }
});
test("new utility charge details are included in request identity", () => {
  const bill = new FormData(); bill.set("amount", "100");
  const first = receiptAttempt(form(), null, [bill]);
  assert.equal(receiptAttempt(form(), first, [bill]).id, first.id);
  bill.set("amount", "200");
  assert.notEqual(receiptAttempt(form(), first, [bill]).id, first.id);
});
test("receipt ids reject malformed values while keeping older forms compatible", () => {
  assert.ok(validReceiptRequestId(null));
  assert.ok(validReceiptRequestId(crypto.randomUUID()));
  assert.equal(validReceiptRequestId("not-a-receipt"), false);
});
