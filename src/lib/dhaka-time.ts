const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Dhaka",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

// "Now" as a Date whose local getters (getFullYear/getMonth/getDate/...) read the
// Bangladesh wall clock, whatever timezone the server runs in. Vercel runs in
// UTC, so a bare `new Date()` flips to the next month 6 hours after Dhaka does
// and every "this month" figure is stale until 06:00 on the 1st.
export function dhakaNow(): Date {
  const p = Object.fromEntries(formatter.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return new Date(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
}

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Dhaka",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Today's Bangladesh date as YYYY-MM-DD, for <input type="date"> defaults.
// `new Date().toISOString().slice(0, 10)` is the UTC date, which is still
// yesterday between midnight and 06:00 in Dhaka — and a bill/payment dated
// "yesterday" on the 1st lands in the previous month.
export function dhakaTodayISO(): string {
  return dateFormatter.format(new Date());
}

// Today's Bangladesh date as a date-only Date (00:00 UTC of that calendar
// day) — the same shape `new Date("YYYY-MM-DD")` gives for the payment-date
// inputs, so transactions dated "now" by a server action bucket into the same
// month as ones a user dated by hand. A bare `new Date()` is still the
// previous UTC day (and, on the 1st, the previous month) until 06:00 in Dhaka.
export function dhakaToday(): Date {
  return new Date(dhakaTodayISO());
}
