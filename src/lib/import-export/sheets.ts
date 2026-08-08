// Single source of truth for every sheet's name + column headers — used by
// export, template generation, AND import (header-text matching), so all
// three always agree on shape. Order here is the dependency order imports
// must run in (owner before property, property before unit type, etc.).

export const SHEET_NAMES = {
  INSTRUCTIONS: "নির্দেশনা",
  OWNERS: "মালিক",
  PROPERTIES: "প্রপার্টি",
  UNIT_TYPES: "ইউনিট টাইপ",
  UNITS: "ইউনিট (আলাদা ভাড়া থাকলে)",
  TENANTS: "টেন্যান্ট ও লিজ",
  RENT_PAYMENTS: "ভাড়া আদায়ের ইতিহাস",
  OWNER_RENT_PAYMENTS: "মালিকের ভাড়া প্রদানের ইতিহাস",
  UTILITY_BILLS: "ইউটিলিটি বিল",
  EMPLOYEES: "কর্মচারী",
  PAYROLL: "বেতন ইতিহাস",
  EXPENSES: "খরচ",
} as const;

// Shared dropdown option lists — same values addDropdown() restricts a
// column to, so the allowed values are self-evident right in the cell
// instead of the user having to guess or match a hint in the header text.
export const UTILITY_TYPE_OPTIONS = ["গ্যাস", "বিদ্যুৎ", "পানি", "অন্যান্য"] as const;
export const YES_NO_OPTIONS = ["হ্যাঁ", "না"] as const;
export const PAYMENT_METHOD_OPTIONS = ["ক্যাশ", "বিকাশ", "নগদ", "ব্যাংক ট্রান্সফার", "অন্যান্য"] as const;
export const EXPENSE_CATEGORY_OPTIONS = ["মেরামত", "অন্যান্য"] as const;
export const RENT_PAYMENT_MODE_OPTIONS = ["নগদ/মোবাইল ব্যাংকিং", "ডাউনপেমেন্ট থেকে সমন্বয়"] as const;

export const RENT_PAYMENT_COLUMNS = [
  "প্রপার্টির নাম",
  "ইউনিট লেবেল",
  "টেন্যান্টের নাম",
  "মাস (YYYY-MM)",
  "বকেয়া পরিমাণ",
  "বর্তমান ডাউনপেমেন্ট ব্যালেন্স (শুধু তথ্যের জন্য)",
  "পরিশোধিত পরিমাণ",
  "পেমেন্ট পদ্ধতি (নগদ/মোবাইল ব্যাংকিং বা ডাউনপেমেন্ট থেকে সমন্বয়)",
  "পরিশোধের তারিখ (YYYY-MM-DD)",
  "পেমেন্ট মাধ্যম (নগদ হলে)",
] as const;

export const OWNER_RENT_PAYMENT_COLUMNS = [
  "প্রপার্টির নাম",
  "ইউনিট লেবেল (ঐচ্ছিক)",
  "মাস (YYYY-MM)",
  "বকেয়া পরিমাণ",
  "পরিশোধিত পরিমাণ",
  "পরিশোধের তারিখ (YYYY-MM-DD)",
  "পেমেন্ট মাধ্যম",
] as const;

export const UTILITY_BILL_COLUMNS = [
  "প্রপার্টির নাম",
  "ইউনিট লেবেল (ঐচ্ছিক)",
  "বিলের ধরন (গ্যাস/বিদ্যুৎ/পানি/অন্যান্য)",
  "পরিমাণ",
  "পরিশোধের শেষ তারিখ (YYYY-MM-DD)",
  "পরিশোধিত? (হ্যাঁ/না)",
  "পরিশোধের তারিখ (হ্যাঁ হলে)",
  "পেমেন্ট মাধ্যম (হ্যাঁ হলে)",
  "কোম্পানি নিজে পরিশোধ করে? (হ্যাঁ/না)",
  "আগের মিটার রিডিং (শুধু বিদ্যুতের জন্য, তথ্যের জন্য)",
  "বর্তমান মিটার রিডিং (শুধু বিদ্যুতের জন্য)",
] as const;

export const PAYROLL_COLUMNS = [
  "প্রপার্টির নাম",
  "কর্মচারীর নাম",
  "মাস (YYYY-MM)",
  "পরিমাণ পরিশোধিত",
  "পরিশোধের তারিখ (YYYY-MM-DD)",
  "পেমেন্ট মাধ্যম",
] as const;

export const EXPENSE_COLUMNS = [
  "প্রপার্টির নাম",
  "ইউনিট লেবেল (ঐচ্ছিক)",
  "ক্যাটাগরি (মেরামত/অন্যান্য)",
  "পরিমাণ",
  "তারিখ (YYYY-MM-DD)",
  "পেমেন্ট মাধ্যম",
  "নোট",
] as const;
