import assert from "node:assert/strict";
import test from "node:test";
import { isPastOrTodayDate, MAX_MONEY_AMOUNT, parseMoneyAmount } from "@/lib/money-input";

test("money amounts must be positive, finite, at most two decimals and under the cap", () => {
  assert.equal(parseMoneyAmount("1500"), "1500");
  assert.equal(parseMoneyAmount(" 1500.5 "), "1500.5");
  assert.equal(parseMoneyAmount("0.01"), "0.01");
  assert.equal(parseMoneyAmount(".5"), "0.5");
  assert.equal(parseMoneyAmount(String(MAX_MONEY_AMOUNT)), String(MAX_MONEY_AMOUNT));
  for (const bad of ["", " ", "0", "0.00", "-5", "-0.5", "abc", "12abc", "NaN", "Infinity", "1e5", "1,500", "10.123", "5.", ".", String(MAX_MONEY_AMOUNT + 1), "99999999999999"]) {
    assert.equal(parseMoneyAmount(bad), null, `"${bad}" must be refused`);
  }
  assert.equal(parseMoneyAmount(null), null);
  assert.equal(parseMoneyAmount(undefined), null);
});

test("a form date must be a real day that is not after today", () => {
  assert.equal(isPastOrTodayDate("2026-11-17", "2026-11-17"), true);
  assert.equal(isPastOrTodayDate("2026-11-16", "2026-11-17"), true);
  assert.equal(isPastOrTodayDate("2026-11-18", "2026-11-17"), false);
  assert.equal(isPastOrTodayDate("2026-02-30", "2026-11-17"), false);
  assert.equal(isPastOrTodayDate("17-11-2026", "2026-11-17"), false);
  assert.equal(isPastOrTodayDate("", "2026-11-17"), false);
  assert.equal(isPastOrTodayDate(null, "2026-11-17"), false);
});
