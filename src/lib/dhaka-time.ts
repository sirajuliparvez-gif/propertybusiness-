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
