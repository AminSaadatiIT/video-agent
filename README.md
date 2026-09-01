# Video Agent — تمپلیت شبکه و امنیت

ابزار وبی که عکس، ویدیو و متن رو می‌گیره، با تمپلیت حرفه‌ای «شبکه و امنیت» (پس‌زمینه تیره، گرید سایبری، فونت مونواسپیس، ترنزیشن fade) قاطی می‌کنه و یه فایل mp4 نهایی تحویل می‌ده. یه endpoint برای embed کردن توی هر سایت دیگه‌ای هم داره.

## نصب و اجرا (لوکال)

پیش‌نیاز: Node.js 18+ و ffmpeg نصب باشه (`ffmpeg -version` رو تست کنید).

```bash
cd video-agent
npm install
cp .env.example .env
npm start
```

بعد برو به `http://localhost:3000` — فرم آپلود همون‌جاست.

## معماری

```
public/index.html     رابط کاربری آپلود + تایم‌لاین
src/server.js          سرور Express: آپلود، صف رندر، دانلود، embed
src/renderer.js         موتور ffmpeg: اسلاید عکس (Ken Burns)، کلیپ ویدیو، تایتل‌کارت، crossfade
src/ai-providers.js     هوک قابل‌اتصال به یه سرویس AI ویدیو/تصویر/صدا
templates/security.json تنظیمات رنگ، فونت، مدت زمان تمپلیت
```

## استفاده از API (برای اتصال به پروژه یا سایت دیگه)

**۱. ارسال درخواست رندر:**
```bash
POST /api/render
Content-Type: multipart/form-data

files: [عکس‌ها و ویدیوها]
timeline: '[{"type":"image","fileIndex":0,"text":"عنوان روی اسلاید","duration":4}, ...]'
options: '{"aspect":"16:9","projectTitle":"...","subtitle":"...","cta":"..."}'
```
پاسخ: `{ "jobId": "..." }`

برای بخش‌هایی که می‌خوای AI بسازه (نه فایل آپلودی)، توی timeline اینو بذار:
```json
{"type": "ai", "aiPrompt": "توضیح صحنه‌ای که می‌خوای AI بسازه", "duration": 3}
```

**۲. چک وضعیت:** `GET /api/status/:jobId` → `{status: "processing"|"done"|"error"}`

**۳. دانلود فایل نهایی:** `GET /api/download/:jobId`

**۴. Embed توی هر سایتی:**
```html
<iframe src="https://your-domain.com/embed/JOB_ID" width="640" height="360" frameborder="0" allowfullscreen></iframe>
```
یا مستقیم به فایل mp4 لینک بده: `https://your-domain.com/output/JOB_ID.mp4`

## اتصال به یه سرویس واقعی AI (اختیاری)

بخش‌های `type: "ai"` فعلاً یه تایتل‌کارت جایگزین (placeholder) می‌سازن تا کل پایپ‌لاین بدون هیچ کلید API کار کنه. وقتی خواستی به یه سرویس واقعی (مثلاً تولید ویدیو یا صدا) وصلش کنی:

1. کلید API‌ت رو **فقط** توی فایل `.env` بذار (هیچ‌وقت توی کد یا چت پیست نکن؛ اگه یه کلید رو جایی پیست کردی، فرض کن لو رفته و از نو بسازش).
2. `src/ai-providers.js` رو باز کن و تابع `generateAIClip` رو به endpoint واقعی سرویس‌ت وصل کن (نمونه‌کد pseudo داخل فایل هست).
3. مقدار `AI_VIDEO_API_KEY` رو توی `.env` پر کن.

## تغییر تمپلیت

رنگ‌ها، فونت، مدت intro/outro و نسبت تصویر همه توی `templates/security.json` قابل تغییرن. برای ساخت یه تمپلیت جدید (مثلاً سبک تبلیغاتی یا آموزشی) کافیه یه فایل json مشابه بسازی و توی `renderer.js` مسیرش رو عوض کنی.

## نکات فنی

- رندر روی سرور با ffmpeg انجام می‌شه (نه در مرورگر)، پس برای فایل‌های حجیم یا تعداد زیاد نیازمند سرور با CPU کافیه.
- در پروداکشن، جای `Map()` حافظه برای jobs از Redis/DB استفاده کن و صف واقعی (مثل BullMQ) بذار، وگرنه با ری‌استارت سرور جاب‌ها گم می‌شن.
- `multer` نسخه فعلی یه‌سری آسیب‌پذیری شناخته‌شده داره؛ قبل از پروداکشن به `multer@2` آپگریدش کن.
