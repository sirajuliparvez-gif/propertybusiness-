---
target: tenant payment flow for non-technical clients
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-10-10T09-03-26Z
slug: src-app-locale-dashboard-tenants-id-page-tsx
---
# Tenant Payment UX Critique

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|------:|-----------|
| 1 | Visibility of System Status | 2 | Status দেখা যায়, কিন্তু payment save/no-op-এর স্পষ্ট success receipt নেই। |
| 2 | Match System / Real World | 2 | Rent concepts বাস্তবসম্মত, তবে English dates এবং mixed terminology Bengali flow ভাঙে। |
| 3 | User Control and Freedom | 3 | Cancel, edit, delete আছে; financial action-এর immediate undo নেই। |
| 4 | Consistency and Standards | 2 | Styling consistent, কিন্তু “নগদ/ক্যাশ” এবং numeral/date formats এক নয়। |
| 5 | Error Prevention | 1 | Paid month-এও previous-month/current collection action দেখা যায়। |
| 6 | Recognition Rather Than Recall | 2 | Payment dialog-এ tenant/property/unit পুনরায় দেখানো হয় না। |
| 7 | Flexibility and Efficiency | 2 | Search আছে, কিন্তু collection-pending worklist/sort/batch flow নেই। |
| 8 | Aesthetic and Minimalist Design | 3 | Layout পরিষ্কার; repeated zero values ও dense controls noise বাড়ায়। |
| 9 | Error Recovery | 1 | কিছু payment failure/no-op যথেষ্ট ব্যাখ্যা দেয় না। |
| 10 | Help and Documentation | 2 | Billing-month hint আছে; mode/action consequences যথেষ্ট পরিষ্কার নয়। |
| **Total** | | **20/40** | **Acceptable, with high-stakes workflow gaps** |

## Design Specificity Verdict

**Partially authored, but still category-interchangeable.** Bengali rent ledger, property/unit relationship, downpayment এবং payment history এই product-এর নিজস্ব। কিন্তু action logic এখনও generic admin software-এর মতো। Paid, due-now, overdue, advance এবং previous-month state অনুযায়ী action ও safeguards আরও স্পষ্ট হওয়া দরকার।

**Deterministic scan:** নির্দিষ্ট tenant page source-এ detector 0 findings দিয়েছে। এটি source-level mechanical cleanliness দেখায়; behavioral usability clean প্রমাণ করে না। Human review যে status-aware action, wording এবং recovery সমস্যা পেয়েছে, detector সেগুলো ধরতে পারে না।

**Visual overlays:** reliable overlay তৈরি হয়নি। Fresh evidence tabs authentication-এর কারণে login page-এ redirect হয়েছে, এবং browser evaluation read-only হওয়ায় injection করা যায়নি। Independent design assessment authenticated live surfaces visually inspect করেছে।

## Overall Impression

Interface দেখতে পরিষ্কার ও বিশ্বাসযোগ্য, কিন্তু non-technical operator-এর সবচেয়ে গুরুত্বপূর্ণ কাজ—কার ভাড়া বাকি, কোন মাসের টাকা নেওয়া হচ্ছে, ভুল হলে কীভাবে ফিরবে—এই তিনটি প্রশ্নে এখনও বেশি চিন্তা করতে হয়। সবচেয়ে বড় সুযোগ হলো প্রতিটি action-কে tenant/payment status অনুযায়ী বদলে দেওয়া।

**Language direction:** বাংলাদেশের অফিসে প্রতিদিন বলা হয় এমন সহজ বাংলা ব্যবহার করতে হবে। অতিরিক্ত সাধু বা আক্ষরিক অনুবাদ এড়িয়ে “আদায় বাকি”, “টাকা নেওয়া হয়েছে”, “ভুল এন্ট্রি মুছুন”, “আগের মাসের ভাড়া” ধরনের copy ব্যবহার করা হবে; বহুল পরিচিত “পেমেন্ট” ও “ইনভয়েস” প্রয়োজনে রাখা যাবে।

## What’s Working

1. Tenant name, phone, property/unit এবং status একই identity block-এ আছে—দ্রুত যাচাই করা যায়।
2. Due, paid, remaining, downpayment ও payment history ভালো audit trail দেয়।
3. Dialog-এ Cancel/Close, pending state এবং destructive confirmation-এর ভালো baseline আছে।

## Priority Issues

### [P1] Paid records still invite payment

**Why it matters:** non-technical operator বুঝতে পারে না actionটি duplicate payment, correction, নাকি advance তৈরি করবে। Silent no-op-ও success মনে হতে পারে।

**Fix:** settled previous month হলে “আগের মাসের ভাড়া যোগ করুন” hide/disable করে “September payment দেখুন/সংশোধন করুন” দেখানো। Paid current row-তে generic “ভাড়া আদায় করুন” না দেখিয়ে আলাদা “অগ্রিম ভাড়া যোগ করুন” ব্যবহার করা।

**Suggested command:** `$impeccable harden`

### [P1] Collection worklist contradicts itself

**Why it matters:** “বাকি ৳1,717,100” এর পাশে “বকেয়া (0)” দেখে client ভাবতে পারে কারও টাকা বাকি নেই। Current unpaid এবং past-due-এর পার্থক্য UI শেখায় না।

**Fix:** default “আদায় বাকি (99)” filter যোগ করা, যেখানে current unpaid + partial থাকবে। “মেয়াদোত্তীর্ণ (0)” আলাদা রাখা। Filter counts ও summary cards একই হিসাব দেখাবে।

**Suggested command:** `$impeccable clarify`

### [P1] Payment modal lacks transaction context and confirmation

**Why it matters:** ভুল tenant/month/amount financial হিসাব নষ্ট করে, অথচ modal খুললে background context মনে রাখতে হয়।

**Fix:** modal-এ স্থায়ী summary দেখানো: “ভাই ভাই সেলুন · ইউনিট ০২ · September 2026 · ৳15,000।” CTA হবে “September-এর ৳15,000 রেকর্ড করুন।” Success-এর পরে receipt/toast এবং “পেমেন্ট দেখুন/সংশোধন করুন” action দিতে হবে।

**Suggested command:** `$impeccable clarify`

### [P2] Header actions have weak hierarchy

**Why it matters:** invoice, edit, previous-month rent, current rent এবং tenant vacate সমান গুরুত্বে থাকায় routine ও risky actions গুলিয়ে যায়।

**Fix:** একটি state-aware primary payment action রাখা। Invoice/edit secondary করা এবং vacate “আরও” menu বা আলাদা destructive section-এ সরানো।

**Suggested command:** `$impeccable distill`

### [P2] Language and accessibility details weaken confidence

**Why it matters:** “নগদ/ক্যাশ”, English/Bengali dates ও numerals-এর মিশ্রণ first-time user-এর সন্দেহ বাড়ায়। Unnamed back/search/progress controls accessibility কমায়।

**Fix:** glossary ও locale format standardize করা; back button/search field-এ accessible labels; progress bar-এ semantic value; date headings আরও নির্দিষ্ট করা।

**Suggested command:** `$impeccable audit`

## Persona Red Flags

**Jordan — প্রথমবার ব্যবহারকারী**

- Paid tenant-এর কাছে payment action দেখে বিভ্রান্ত হবে।
- “বাকি” এবং “বকেয়া”কে একই অর্থ ধরে contradictory totals দেখবে।
- “বিলের মাস” বনাম “পরিশোধের তারিখ” বুঝতে English dates আরও বাধা দেবে।
- Generic “সংরক্ষণ করুন” financial result বোঝায় না।

**Sam — accessibility-dependent user**

- Back arrow-এর accessible name নেই।
- Rent search field-এর reliable label নেই।
- Progress bar semantic progress হিসেবে announce হয় না।
- Dense table ও icon actions দীর্ঘ keyboard/screen-reader path তৈরি করে।

**Alex — frequent operator**

- 111 rows scan করতে হয়; “collection pending” worklist নেই।
- Amount/property/due-state sort নেই।
- Paid/unpaid state-এ collection affordance যথেষ্ট আলাদা নয়।

## Minor Observations

- Zero downpayment balance একাধিক স্থানে পুনরাবৃত্তি হচ্ছে।
- “সময়মতো পরিশোধের হার 50%” এর সঙ্গে “২ মাসের মধ্যে ১ মাস” দিলে অর্থ পরিষ্কার হবে।
- Table-এর গুরুত্বপূর্ণ status/action columns initial viewport-এর বাইরে যেতে পারে।
- “তারিখ” heading অস্পষ্ট; “ভাড়ার নির্ধারিত তারিখ” বেশি পরিষ্কার।
- Mobile এবং desktop-এ action labels একই অর্থে consistent রাখা দরকার।

## Questions to Consider

- দৈনিক primary কাজ কি “সব tenant দেখা”, নাকি “আজ যাদের ভাড়া আদায় বাকি তাদের দেখা”?
- Paid month-এ collection action পুরোপুরি গায়েব হবে, নাকি “দেখুন/সংশোধন করুন” হবে?
- প্রতিটি payment confirmation কি এক বাক্যে who, unit, month, amount—এই চারটি প্রশ্নের উত্তর দিতে পারে?
- Zero-value downpayment section কি সবসময় এত prominence পাওয়া উচিত?
- Product-এ “বকেয়া” কি যেকোনো unpaid rent, নাকি শুধু deadline পার হওয়া rent?
