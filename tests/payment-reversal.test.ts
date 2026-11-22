import assert from "node:assert/strict";
import test from "node:test";
import { reversedPaymentState } from "@/lib/payment-reversal";

test("taking back the only payment leaves nothing paid", () => {
  assert.deepEqual(reversedPaymentState(5000, 5000, 5000), { paid: 0, state: "NONE" });
});

test("taking back one instalment of several leaves the rest paid as a part payment", () => {
  assert.deepEqual(reversedPaymentState(5000, 2000, 5000), { paid: 3000, state: "PARTIAL" });
  assert.deepEqual(reversedPaymentState(5000.5, 0.5, 5000), { paid: 5000, state: "PAID" });
});

test("reversal never goes below zero and ignores float noise", () => {
  assert.deepEqual(reversedPaymentState(100, 250, 300), { paid: 0, state: "NONE" });
  assert.deepEqual(reversedPaymentState(0.3, 0.1, 0.3), { paid: 0.2, state: "PARTIAL" });
  assert.deepEqual(reversedPaymentState(0.3, 0.2, 0.1), { paid: 0.1, state: "PAID" });
});
