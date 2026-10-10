from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path("/Users/sirajul/propertybusiness-")
SRC = ROOT / "tmp/pdfs/screens"
OUT = ROOT / "tmp/pdfs/annotated"
OUT.mkdir(parents=True, exist_ok=True)


def font(size: int):
    for path in (
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default()


def annotate(name, boxes, crop=None):
    image = Image.open(SRC / name).convert("RGBA")
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for number, (x1, y1, x2, y2) in boxes:
        draw.rounded_rectangle(
            (x1, y1, x2, y2), radius=8,
            fill=(245, 158, 11, 46), outline=(245, 158, 11, 255), width=5,
        )
        cx, cy = max(20, x1 + 7), max(20, y1 + 7)
        draw.ellipse((cx - 18, cy - 18, cx + 18, cy + 18), fill=(234, 88, 12, 255), outline="white", width=3)
        label = str(number)
        box = draw.textbbox((0, 0), label, font=font(24))
        draw.text((cx - (box[2] - box[0]) / 2, cy - (box[3] - box[1]) / 2 - 2), label, fill="white", font=font(24))
    image = Image.alpha_composite(image, overlay)
    if crop:
        image = image.crop(crop)
    target = OUT / (Path(name).stem + ".png")
    image.convert("RGB").save(target, quality=94)
    return target


specs = {
    "dashboard.jpg": [(1, (8, 70, 230, 104)), (2, (278, 586, 1092, 859))],
    "properties.jpg": [(1, (8, 104, 230, 136)), (2, (970, 86, 1096, 131))],
    "tenants.jpg": [(1, (8, 168, 230, 201)), (2, (946, 86, 1096, 131))],
    "tenant-profile-top.jpg": [(1, (492, 232, 630, 280)), (2, (296, 232, 394, 280)), (3, (392, 232, 491, 280))],
    "rent-collection.jpg": [(1, (8, 199, 230, 232)), (2, (274, 284, 1095, 365)), (3, (946, 365, 1103, 906))],
    "rent-payment-dialog-clean.jpg": [(1, (367, 240, 747, 645)), (2, (390, 286, 720, 347)), (3, (390, 388, 720, 453)), (4, (390, 492, 720, 555)), (5, (571, 570, 724, 623))],
    "tenant-payment-history.jpg": [(1, (274, 748, 1096, 901)), (2, (1027, 818, 1074, 867))],
    "edit-rent-payment-dialog.jpg": [(1, (367, 308, 747, 603)), (2, (390, 350, 720, 406)), (3, (390, 446, 720, 504)), (4, (571, 528, 724, 582))],
    "rent-invoice.jpg": [(1, (918, 75, 1075, 119)), (2, (271, 130, 1097, 882))],
    "utility-bills.jpg": [(1, (8, 231, 230, 264)), (2, (963, 85, 1097, 132)), (3, (276, 284, 1093, 362))],
    "staff.jpg": [(1, (8, 296, 230, 329)), (2, (945, 85, 1097, 132))],
    "transactions.jpg": [(1, (8, 328, 230, 361)), (2, (866, 76, 1097, 115)), (3, (727, 76, 870, 115))],
    "reports.jpg": [(1, (8, 360, 230, 394)), (2, (905, 152, 1097, 201))],
    "import-export.jpg": [(1, (8, 393, 230, 426)), (2, (274, 155, 655, 353)), (3, (274, 356, 1097, 503))],
}

for filename, boxes in specs.items():
    annotate(filename, boxes)

# Focused crops make small controls readable in the PDF.
annotate("tenant-payment-history.jpg", [(1, (274, 748, 1096, 901)), (2, (1027, 818, 1074, 867))], crop=(250, 690, 1113, 906)).rename(OUT / "payment-history-crop.png")
annotate("edit-rent-payment-dialog.jpg", [(1, (367, 308, 747, 603)), (2, (390, 350, 720, 406)), (3, (390, 446, 720, 504)), (4, (571, 528, 724, 582))], crop=(315, 250, 800, 650)).rename(OUT / "edit-payment-crop.png")


def img(name):
    return f"annotated/{name}"


pages = []


def page(title, kicker, body, page_no, cls=""):
    pages.append(f'''<section class="page {cls}">
      <header><div><div class="kicker">{kicker}</div><h1>{title}</h1></div><div class="brand">রেশমি এন্টারপ্রাইজ</div></header>
      <main>{body}</main>
      <footer><span>সফটওয়্যার ব্যবহার নির্দেশিকা</span><span>{page_no:02d}</span></footer>
    </section>''')


pages.append('''<section class="page cover">
  <div class="cover-band"></div>
  <img class="logo" src="../../public/logo.jpg" alt="রেশমি এন্টারপ্রাইজ লোগো">
  <div class="cover-copy">
    <div class="eyebrow">সম্পূর্ণ বাংলা ব্যবহার নির্দেশিকা</div>
    <h1>রেশমি এন্টারপ্রাইজ</h1>
    <h2>প্রপার্টি, ভাড়া ও হিসাব ব্যবস্থাপনা সফটওয়্যার</h2>
    <p>বাস্তব স্ক্রিনশট, ক্লিক হাইলাইট এবং ধাপে ধাপে নির্দেশনা</p>
  </div>
  <div class="cover-meta"><span>সংস্করণ ১.১</span><span>অক্টোবর ২০২৬</span></div>
</section>''')

page("শুরু করার আগে", "দ্রুত পরিচিতি", '''
<div class="rule-grid">
  <article><b>কমলা বক্স + নম্বর</b><p>যে জায়গায় ক্লিক করতে হবে সেটি কমলা বর্ডার ও ধাপ নম্বর দিয়ে দেখানো হয়েছে।</p></article>
  <article><b>ভাড়ার শেষ তারিখ</b><p>প্রতি মাসের ১০ তারিখ পর্যন্ত পরিশোধের সময়। ১০ তারিখ পার হলে অপরিশোধিত বিল <strong>বকেয়া</strong> হবে; সম্পূর্ণ পরিশোধে <strong>পরিশোধিত</strong>।</p></article>
  <article><b>আংশিক পরিশোধ</b><p>কম টাকা দিলে বাকি অংশ আলাদা থাকবে। পরবর্তী ধাপে আবার টাকা যোগ করে পুরো বিল শেষ করা যাবে।</p></article>
  <article><b>একাধিক ইউনিট</b><p>এক টেন্যান্টের একাধিক ইউনিট একসাথে থাকলে ভাড়ার বিল সম্মিলিতভাবে আদায় ও ইনভয়েস করা যায়।</p></article>
  <article><b>পেমেন্ট মাধ্যম</b><p>ক্যাশ, বিকাশ, নগদ, ব্যাংক ট্রান্সফার, <strong>ব্যাংক চেক</strong> এবং অন্যান্য।</p></article>
  <article><b>আগের মাসের বকেয়া</b><p><strong>বিলের মাস</strong> আলাদা করে নির্বাচন করুন। টাকা যে দিনে পেয়েছেন সেটি <strong>পরিশোধের তারিখ</strong>-এ দিন।</p></article>
</div>
<div class="note">টিপস: উপরের EN/বাংলা বাটন দিয়ে ভাষা বদলানো যায়। পরিবর্তনের আগে টেন্যান্ট, মাস, টাকা এবং পেমেন্ট মাধ্যম যাচাই করুন।</div>
''', 2, "intro")

page("ড্যাশবোর্ড বুঝুন", "ধাপ ১", f'''
<div class="shot"><img src="{img('dashboard.png')}"></div>
<div class="steps"><span><i>1</i> সাইডবার থেকে <b>ড্যাশবোর্ড</b> খুলুন।</span><span><i>2</i> <b>গুরুত্বপূর্ণ কাজ</b> অংশে বকেয়া/অসম্পূর্ণ কাজ দেখুন।</span></div>
''', 3)

page("প্রপার্টি ও ইউনিট যোগ করুন", "ধাপ ২", f'''
<div class="shot"><img src="{img('properties.png')}"></div>
<div class="steps"><span><i>1</i> <b>প্রপার্টি</b> মেনু খুলুন।</span><span><i>2</i> <b>+ নতুন প্রপার্টি</b> ক্লিক করে নাম, মালিক ও ইউনিট তথ্য সংরক্ষণ করুন।</span></div>
''', 4)

page("টেন্যান্ট তৈরি করুন", "ধাপ ৩", f'''
<div class="shot"><img src="{img('tenants.png')}"></div>
<div class="steps"><span><i>1</i> <b>টেন্যান্ট</b> মেনু খুলুন।</span><span><i>2</i> <b>+ টেন্যান্ট যোগ করুন</b> থেকে ব্যক্তি/প্রতিষ্ঠান, ফোন, প্রপার্টি, ইউনিট ও মাসিক ভাড়া দিন।</span></div>
''', 5)

page("টেন্যান্ট প্রোফাইল থেকে কাজ", "ধাপ ৪", f'''
<div class="shot"><img src="{img('tenant-profile-top.png')}"></div>
<div class="steps three"><span><i>1</i> <b>ভাড়া আদায়</b> দিয়ে পেমেন্ট নিন।</span><span><i>2</i> <b>ইনভয়েস</b> খুলে প্রিন্ট/PDF করুন।</span><span><i>3</i> <b>এডিট</b> থেকে প্রয়োজনীয় টেন্যান্ট তথ্য সংশোধন করুন।</span></div>
''', 6)

page("ভাড়া আদায় ও স্ট্যাটাস", "ধাপ ৫", f'''
<div class="split"><div class="shot"><img src="{img('rent-collection.png')}"></div><div class="shot"><img src="{img('rent-payment-dialog-clean.png')}"></div></div>
<div class="steps compact"><span><i>1</i> <b>ভাড়া আদায়</b> মেনু খুলুন এবং ফিল্টার দিয়ে টেন্যান্ট খুঁজুন।</span><span><i>2</i> অ্যাকশন থেকে <b>ভাড়া আদায় করুন</b> বেছে নিন।</span><span><i>3</i> <b>বিলের মাস</b>, টাকা ও পরিশোধের তারিখ দিন।</span><span><i>4</i> মাধ্যম হিসেবে <b>ব্যাংক চেক</b>সহ সঠিক অপশন নির্বাচন করুন।</span><span><i>5</i> যাচাই করে সংরক্ষণ করুন।</span></div>
''', 7, "dense")

page("আগের মাসের বকেয়া পরিশোধ", "ধাপ ৬ · নতুন ফিচার", '''
<div class="billing-feature">
  <div class="form-demo">
    <div class="demo-title">ভাড়া আদায় করুন</div>
    <div class="demo-label">পেমেন্টের ধরন</div>
    <div class="demo-tabs"><b>নগদ পরিশোধ</b><span>অগ্রিম ভাড়া</span><span>ডাউনপেমেন্ট থেকে সমন্বয়</span></div>
    <div class="demo-field highlight"><label><i>1</i> বিলের মাস *</label><strong>September 2026</strong></div>
    <p class="demo-help">যে মাসের ভাড়া পরিশোধ করছেন সেটি নির্বাচন করুন - টাকা পাওয়ার তারিখ আলাদা হতে পারে।</p>
    <div class="demo-field"><label><i>2</i> পরিমাণ *</label><strong>৳15,000</strong></div>
    <div class="demo-field"><label><i>3</i> পরিশোধের তারিখ *</label><strong>October 10, 2026</strong></div>
    <div class="demo-field"><label><i>4</i> পেমেন্ট মাধ্যম</label><strong>ব্যাংক চেক</strong></div>
    <div class="demo-actions"><span>বাতিল</span><b>সংরক্ষণ করুন</b></div>
  </div>
  <div class="feature-copy">
    <div class="scenario"><small>উদাহরণ</small><h2>সেপ্টেম্বরের ভাড়া<br>অক্টোবরে পাওয়া গেছে</h2><p><b>বিলের মাস:</b> September 2026<br><b>পরিশোধের তারিখ:</b> October 10, 2026</p></div>
    <div class="feature-steps"><p><i>1</i> <b>বিলের মাস</b> হিসেবে সেপ্টেম্বর বাছুন।</p><p><i>2</i> প্রাপ্ত টাকার পরিমাণ লিখুন।</p><p><i>3</i> টাকা পাওয়ার প্রকৃত তারিখ দিন।</p><p><i>4</i> মাধ্যম বেছে নিয়ে সংরক্ষণ করুন।</p></div>
    <div class="note"><b>মনে রাখুন:</b> অক্টোবরের ভাড়া আগে থেকেই পরিশোধিত হলেও নগদ পরিশোধ tab খুলে সেপ্টেম্বর বা আরও আগের মাস নির্বাচন করা যাবে। একই মাসের duplicate payment system গ্রহণ করবে না।</div>
  </div>
</div>
''', 8, "billing-page")

page("ভুল পেমেন্ট সংশোধন", "ধাপ ৭", f'''
<div class="split focused"><div><div class="shot"><img src="{img('payment-history-crop.png')}"></div><p class="caption"><i>1</i> টেন্যান্ট প্রোফাইলের পেমেন্ট ইতিহাসে যান। <i>2</i> পেন্সিল আইকন ক্লিক করুন।</p></div><div><div class="shot"><img src="{img('edit-payment-crop.png')}"></div><p class="caption"><i>3</i> টাকা, তারিখ বা মাধ্যম ঠিক করুন। <i>4</i> পরিবর্তন সংরক্ষণ করুন।</p></div></div>
<div class="warning">অডিট নিরাপত্তা: কিস্তি/ডাউনপেমেন্টের সাথে যুক্ত সমন্বয় সরাসরি বদলানো নাও যেতে পারে। সে ক্ষেত্রে মূল লেনদেন ও বাকি হিসাব যাচাই করে অনুমোদিত পদ্ধতি ব্যবহার করুন।</div>
''', 9)

page("ইনভয়েস প্রিন্ট বা PDF", "ধাপ ৮", f'''
<div class="shot invoice"><img src="{img('rent-invoice.png')}"></div>
<div class="steps"><span><i>1</i> উপরে <b>প্রিন্ট / ডাউনলোড</b> ক্লিক করুন।</span><span><i>2</i> ভাড়ার ইনভয়েসে দুই কপি থাকে—অফিস কপি ও গ্রাহক কপি। প্রিন্টের আগে মাস, ইউনিট, টাকা, তারিখ ও মাধ্যম যাচাই করুন।</span></div>
''', 10)

page("ইউটিলিটি বিল", "ধাপ ৯", f'''
<div class="shot"><img src="{img('utility-bills.png')}"></div>
<div class="steps three"><span><i>1</i> <b>ইউটিলিটি বিল</b> খুলুন।</span><span><i>2</i> <b>বিল যোগ করুন</b> থেকে বিদ্যুৎ/গ্যাস/পানি/অন্যান্য বিল দিন।</span><span><i>3</i> স্ট্যাটাস ও ফিল্টার দেখে পেমেন্ট, আংশিক পেমেন্ট এবং ইনভয়েস পরিচালনা করুন।</span></div>
''', 11)

page("স্টাফ ও বেতন", "ধাপ ১০", f'''
<div class="shot"><img src="{img('staff.png')}"></div>
<div class="steps"><span><i>1</i> <b>স্টাফ</b> মেনু খুলুন।</span><span><i>2</i> <b>+ কর্মচারী যোগ করুন</b> থেকে নাম, পদ, ফোন ও বেতন দিন। বেতন সাধারণত মাসের ১৫ তারিখ পর্যন্ত সময়মতো; এরপর অপরিশোধিত থাকলে বকেয়া দেখাবে।</span></div>
''', 12)

page("লেনদেন ও রিপোর্ট", "ধাপ ১১", f'''
<div class="split"><div><div class="shot"><img src="{img('transactions.png')}"></div><p class="caption"><i>1</i> লেনদেন খুলুন। <i>2</i> কোম্পানি/অফিস খরচ যোগ করুন। <i>3</i> মালিকের উত্তোলন আলাদা রাখুন।</p></div><div><div class="shot"><img src="{img('reports.png')}"></div><p class="caption"><i>1</i> রিপোর্ট খুলুন। <i>2</i> সঠিক মাস নির্বাচন করে আয়, খরচ ও বকেয়া মিলিয়ে দেখুন।</p></div></div>
''', 13, "dense")

page("ইমপোর্ট, এক্সপোর্ট ও ব্যাকআপ", "ধাপ ১২", f'''
<div class="shot"><img src="{img('import-export.png')}"></div>
<div class="steps three"><span><i>1</i> <b>ইমপোর্ট/এক্সপোর্ট</b> খুলুন।</span><span><i>2</i> মাস নির্বাচন করে Excel ডাউনলোড করুন—এটাই সহজ ব্যাকআপ।</span><span><i>3</i> অনুমোদিত ফাইল আপলোডের আগে কপি রাখুন; শেষে সফল/ব্যর্থ সারি যাচাই করুন।</span></div>
''', 14)

page("মাসিক কাজের চেকলিস্ট", "শেষ ধাপ", '''
<div class="check-grid">
  <article><h3>মাসের শুরু</h3><ul><li>প্রপার্টি ও ইউনিট তালিকা যাচাই</li><li>নতুন/বদলানো টেন্যান্ট তথ্য আপডেট</li><li>ভাড়া ও ইউটিলিটি বিল তৈরি হয়েছে কি না দেখুন</li></ul></article>
  <article><h3>১০ তারিখের মধ্যে</h3><ul><li>ভাড়া/ইউটিলিটি পেমেন্ট নথিভুক্ত</li><li>আংশিক পেমেন্টের অবশিষ্ট টাকা মিলান</li><li>ব্যাংক চেকের নম্বর/নোট লিখুন</li></ul></article>
  <article><h3>১০ তারিখের পরে</h3><ul><li>বকেয়া ফিল্টার খুলুন</li><li>টেন্যান্ট অনুযায়ী বাকি নিশ্চিত করুন</li><li>প্রয়োজনে ইনভয়েস/রসিদ পাঠান</li></ul></article>
  <article><h3>মাস শেষ</h3><ul><li>রিপোর্টে আয়-খরচ মিলান</li><li>ভুল পেমেন্ট থাকলে এডিট করুন</li><li>Excel এক্সপোর্ট নিয়ে নিরাপদে সংরক্ষণ</li></ul></article>
</div>
<div class="support"><b>সমস্যা হলে আগে যাচাই করুন:</b> সঠিক মাস নির্বাচিত কি না, টেন্যান্টের ইউনিট ঠিক কি না, পেমেন্টের পর পেজ রিফ্রেশ হয়েছে কি না, এবং ব্রাউজারের তারিখ/সময় সঠিক কি না।</div>
''', 15, "checklist")


html = f'''<!doctype html><html lang="bn"><head><meta charset="utf-8"><title>রেশমি এন্টারপ্রাইজ ব্যবহার নির্দেশিকা</title><style>
@page {{ size: A4 landscape; margin: 0; }}
* {{ box-sizing: border-box; }}
body {{ margin:0; background:#dfe7e3; color:#16322b; font-family:"Kohinoor Bangla","Bangla Sangam MN","Bangla MN",sans-serif; }}
.page {{ width:297mm; height:210mm; padding:14mm 16mm 10mm; background:#f7f5ef; page-break-after:always; display:flex; flex-direction:column; overflow:hidden; position:relative; }}
header {{ display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid #cad7d1; padding-bottom:3mm; margin-bottom:4mm; }}
.kicker,.eyebrow {{ color:#d65f23; font-size:11px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; }}
h1 {{ margin:1mm 0 0; font-size:25px; line-height:1.12; color:#123b31; }}
.brand {{ font-size:13px; font-weight:700; color:#44655d; }}
main {{ flex:1; min-height:0; display:flex; flex-direction:column; gap:4mm; }}
footer {{ display:flex; justify-content:space-between; color:#60756f; border-top:1px solid #cad7d1; padding-top:2.5mm; font-size:10px; margin-top:3mm; }}
.shot {{ flex:1; min-height:0; background:white; border:1px solid #bac9c3; border-radius:10px; padding:3mm; display:flex; align-items:center; justify-content:center; box-shadow:0 5px 18px rgba(18,59,49,.08); }}
.shot img {{ width:100%; height:100%; object-fit:contain; min-height:0; }}
.steps {{ display:grid; grid-template-columns:1fr 2fr; gap:3mm; font-size:13px; line-height:1.35; }}
.steps.three {{ grid-template-columns:repeat(3,1fr); }}
.steps.compact {{ grid-template-columns:repeat(5,1fr); font-size:11px; }}
.steps span,.caption {{ background:#fff; border-left:4px solid #f59e0b; border-radius:6px; padding:2.4mm 3mm; margin:0; }}
i {{ display:inline-grid; place-items:center; width:20px; height:20px; border-radius:50%; background:#ea580c; color:#fff; font-style:normal; font-weight:700; margin-right:5px; font-family:Arial,sans-serif; }}
.split {{ display:grid; grid-template-columns:1fr 1fr; gap:5mm; flex:1; min-height:0; }}
.split > div {{ min-height:0; display:flex; flex-direction:column; gap:2mm; }}
.focused .shot {{ min-height:95mm; }}
.caption {{ font-size:12px; line-height:1.45; }}
.warning,.note,.support {{ padding:3mm 4mm; border-radius:8px; background:#fff3d6; border:1px solid #f3c76a; color:#6d4313; font-size:12px; }}
.invoice {{ max-height:145mm; }}
.dense .shot {{ padding:2mm; }}
.dense .split {{ gap:3mm; }}
.billing-feature {{ display:grid; grid-template-columns:1.05fr .95fr; gap:9mm; flex:1; min-height:0; align-items:stretch; }}
.form-demo {{ background:#fff; border:1px solid #cbd7d2; border-radius:15px; padding:7mm; box-shadow:0 10px 28px rgba(18,59,49,.12); display:flex; flex-direction:column; gap:2.2mm; }}
.demo-title {{ font-size:21px; font-weight:700; color:#123b31; margin-bottom:1mm; }}
.demo-label {{ font-size:11px; color:#60756f; }}
.demo-tabs {{ display:grid; grid-template-columns:1fr 1fr 1.35fr; background:#edf1ef; border-radius:8px; padding:1mm; font-size:11px; text-align:center; }}
.demo-tabs b {{ background:#fff; border-radius:6px; padding:2mm; color:#123b31; box-shadow:0 1px 4px rgba(18,59,49,.1); }}
.demo-tabs span {{ padding:2mm 1mm; color:#6b7e78; }}
.demo-field {{ border:1px solid #d6dfdb; border-radius:9px; padding:2.5mm 3mm; display:flex; justify-content:space-between; align-items:center; min-height:13mm; }}
.demo-field.highlight {{ border:3px solid #f59e0b; background:#fff8e7; box-shadow:0 0 0 3px rgba(245,158,11,.15); }}
.demo-field label {{ color:#4c655e; font-size:12px; }}
.demo-field strong {{ color:#173d33; font-size:15px; }}
.demo-help {{ margin:0; color:#60756f; font-size:10px; line-height:1.45; }}
.demo-actions {{ display:flex; justify-content:flex-end; gap:2mm; margin-top:auto; }}
.demo-actions span,.demo-actions b {{ padding:2.5mm 4mm; border-radius:8px; border:1px solid #ccd8d3; font-size:12px; }}
.demo-actions b {{ background:#2867b2; color:#fff; border-color:#2867b2; }}
.feature-copy {{ display:flex; flex-direction:column; gap:4mm; }}
.scenario {{ background:#103b31; color:#fff; border-radius:14px; padding:7mm; }}
.scenario small {{ color:#f5c27d; font-weight:700; letter-spacing:.12em; }}
.scenario h2 {{ font-size:27px; margin:2mm 0 4mm; line-height:1.18; }}
.scenario p {{ margin:0; line-height:1.75; color:#e3efeb; font-size:14px; }}
.feature-steps {{ display:grid; grid-template-columns:1fr 1fr; gap:3mm; }}
.feature-steps p {{ margin:0; padding:3mm; background:#fff; border-left:4px solid #f59e0b; border-radius:7px; font-size:12px; line-height:1.45; }}
.rule-grid,.check-grid {{ display:grid; grid-template-columns:repeat(3,1fr); gap:4mm; flex:1; }}
.rule-grid article,.check-grid article {{ background:#fff; border:1px solid #d6dfdb; border-radius:12px; padding:5mm; box-shadow:0 4px 15px rgba(18,59,49,.06); }}
.rule-grid b,.check-grid h3 {{ display:block; color:#d65f23; font-size:17px; margin:0 0 2mm; }}
.rule-grid p {{ margin:0; font-size:13px; line-height:1.55; }}
.check-grid {{ grid-template-columns:repeat(2,1fr); }}
.check-grid h3 {{ color:#123b31; font-size:19px; }}
.check-grid ul {{ margin:0; padding-left:7mm; font-size:14px; line-height:1.8; }}
.cover {{ background:#103b31; color:#fff; padding:22mm; justify-content:center; }}
.cover-band {{ position:absolute; left:0; top:0; width:12mm; height:100%; background:#e56524; }}
.cover .logo {{ position:absolute; right:22mm; top:22mm; width:42mm; height:42mm; object-fit:cover; border-radius:14px; border:4px solid rgba(255,255,255,.85); }}
.cover-copy {{ max-width:190mm; }}
.cover h1 {{ color:#fff; font-size:51px; margin:5mm 0 2mm; }}
.cover h2 {{ color:#f5c27d; font-size:27px; margin:0 0 5mm; font-weight:500; }}
.cover p {{ color:#dcebe6; font-size:18px; }}
.cover-meta {{ position:absolute; left:22mm; right:22mm; bottom:18mm; display:flex; justify-content:space-between; color:#b9d0c8; font-size:13px; }}
strong {{ color:#bd4b18; }}
</style></head><body>{''.join(pages)}</body></html>'''

(ROOT / "tmp/pdfs/user-guide.html").write_text(html, encoding="utf-8")
print(f"Created {len(pages)} pages and annotated screenshots in {OUT}")
