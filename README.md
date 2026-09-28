# تمام شوب — TAMAM SHOP

متجر إلكتروني عراقي متكامل وسريع مصمم لبيع المنتجات والأجهزة بنظام الطلب المباشر والدفع عند الاستلام، مبني باستخدام **React 19 + TypeScript + Express + Vite SSR**.

---

## 🚀 النشر واستضافة المشروع / Deployment

يدعم المشروع خيارين أساسيين للنشر بكفاءة وسرعة فائقة:

### الخيار الأول: النشر التلقائي على Netlify (موصى به - Serverless SSR + Netlify Functions)

المشروع مُهيأ بالكامل للعمل مباشرة على **Netlify** عبر GitHub مع رندرة سيرفرية كاملة (SSR) ودوال سحابية (Netlify Functions v1) لمسارات الـ API:

1. ارفع المشروع إلى حسابك على **GitHub**.
2. ادخل إلى لوحة تحكم [Netlify Dashboard](https://app.netlify.com).
3. اضغط على **Add new site** ثم **Import an existing project**.
4. اختر مستودع المشروع (GitHub Repository).
5. سيتعرف Netlify تلقائياً على ملف `netlify.toml` ويقوم بضبط كل من:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist/client`
   - **Functions directory**: `netlify/functions`
6. انتقل إلى **Site configuration > Environment variables** وأضف المتغيرات المطلوبة (مثل `NODE_ENV=production`, `APP_URL`, `META_PIXEL_ID`, وغيرها).
7. اضغط **Deploy Site** وسيعمل موقعك مع SSR الحقيقي ودوال الـ API بدون أي إعدادات يدوية إضافية!

---

### الخيار الثاني: النشر على Render.com / خوادم Node.js (Express SSR)

لتشغيل وسيرفر المشروع بشكل سليم ومستمر، استخدم أي استضافة تدعم خوادم **Node.js**:
1. **[Render.com](https://render.com)** *(موصى به - متوفر ملف إعداد تلقائي `render.yaml`)*
2. **[Railway.app](https://railway.app)**
3. **[Fly.io](https://fly.io)**
4. **سيرفر خاص (VPS / Ubuntu / Debian)** عبر Nginx + PM2 / Docker

---

### خطوات النشر على Render.com (دليل خطوة بخطوة)

#### الطريقة الأولى: النشر التلقائي عبر Blueprint (`render.yaml`)
1. ارفع المشروع إلى حسابك على GitHub أو GitLab.
2. ادخل إلى لوحة تحكم [Render Dashboard](https://dashboard.render.com).
3. اضغط على **New +** ثم اختر **Blueprint**.
4. اختر المستودع (Repository) وسيتعرف Render تلقائياً على ملف `render.yaml` ويقوم بتهيئة السيرفر.
5. أضف قيم متغيرات البيئة (Environment Variables) المطلوبة.

#### الطريقة الثانية: النشر اليدوي (Web Service)
1. في [Render Dashboard](https://dashboard.render.com)، اضغط **New +** واختر **Web Service**.
2. اختر مستودع المشروع (GitHub Repo).
3. اضبط الإعدادات التالية:
   - **Environment**: `Node`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm run start`
   - **Plan**: `Starter` أو `Free` (يُفضل Starter لضمان استمرار السيرفر دون إيقاف مؤقت)
4. انتقل إلى تبويب **Environment Variables** وأضف المتغيرات الموضحة أدناه.
5. اضغط **Deploy Web Service**.

---

### متغيرات البيئة المطلوبة / Environment Variables

| المتغير | الوصف | إلزامي؟ |
|---|---|---|
| `NODE_ENV` | يُضبط على `production` | نعم |
| `APP_URL` | رابط موقعك بعد النشر (مثال: `https://your-app.onrender.com`) | نعم |
| `ROLEMALL_API_TOKEN` | توكن المورد Rolemall | نعم |
| `SUPABASE_URL` | رابط مشروع Supabase | نعم (للوحة التحكم والنسخة الاحتياطية) |
| `SUPABASE_SERVICE_ROLE_KEY` | المفتاح السري لـ Supabase | نعم |
| `ADMIN_PASSWORD` | كلمة سر لوحة التحكم `/admin` (10 أحرف فأكثر) | نعم |
| `GOOGLE_SHEET_WEBHOOK_URL_MANUAL` | رابط سكربت الشيت الآخر للمنتجات اليدوية | نعم إذا استخدمت الشيت الآخر |
| `META_PIXEL_ID` | معرّف بيكسل فيسبوك/ميتا | اختياري |
| `META_ACCESS_TOKEN` | توكن الوصول لـ Meta Conversions API (CAPI) | اختياري |
| `IQD_TO_USD_RATE` | سعر صرف الدينار مقابل الدولار للتحويل في البيكسل (افتراضي: `1400`) | اختياري |
| `GOOGLE_SHEET_WEBHOOK_URL` | رابط Google Apps Script Webhook لتسجيل الطلبات | اختياري |
| `TELEGRAM_BOT_TOKEN` | توكن بوت التلغرام لإشعارات الطلبات الفورية | اختياري |
| `TELEGRAM_CHAT_ID` | معرّف القناة أو المجموعة لاستلام الطلبات | اختياري |

---

## 🛠️ التشغيل والتطوير المحلي / Local Development

```bash
# 1. تثبيت الحزم
npm install

# 2. تشغيل بيئة التطوير (مع Vite SSR Dev Server)
npm run dev

# 3. بناء المشروع للإنتاج (Client + SSR Server)
npm run build

# 4. تشغيل خادم الإنتاج
npm run start
```

---

## ⚠️ قيود ومعمارية التخزين المؤقت / Architecture & Limitations

1. **خدمة تحسين ومعالجة الصور (`Netlify Image CDN`)**: تُقدَّم صور المنتجات وتُحوَّل إلى صيغ WebP و AVIF فائقة الكفاءة عبر شبكة **Netlify Image CDN** السحابية عند الحافة (`/.netlify/images?url=...&w=...&q=80`)، مع كاش سريع واستجابة فورية، وأحجام متجاوبة مخصصة لكل عنصر (بطاقات المنتجات، المعرض، وملخص الطلب)، مع آلية تراجع Fallback تلقائية ومباشرة لرابط الصورة الأصلي من Rolemall عند أي تعذر.
2. **كاش المنتجات والفئات (`memoryCache`)**: يحفظ بيانات متجر Rolemall في الرام لتسريع التصفح وحماية الـ API.
3. **حماية منع الطلبات المكررة (`recentOrders`)**: يمنع إرسال نفس الطلب مرتين خلال نافذة 5 دقائق من نفس رقم الهاتف والمنتج.

### ما يجب معرفته بخصوص هذا الكاش:
- **إعادة التشغيل**: يُعاد تصفير كاش الذاكرة بالكامل تلقائياً عند إعادة تشغيل السيرفر أو إعادة النشر (Redeploy).
- **التوسع الأفقي (Horizontal Scaling / خوادم متعددة)**: في حال تشغيل أكثر من نسخة سيرفر بالتوازي خلف موزع أحمال (Load Balancer)، لن تتشارك الخوادم هذه الذاكرة، وقد يسمح ذلك بمرور طلب مكرر لو توزع النقرتين على نسختين مختلفتين.
- **الحل المقترح عند التوسع الكبير مستقبلاً**: عند الحاجة لتشغيل عدة خوادم (Cluster / Multi-Container)، يُنصح باستبدال الذاكرة المحلية بقاعدة بيانات أو كاش مركزي مشترك وسريع مثل **Redis** لإدارة الكاش والأقفال الموزعة (Distributed Locks) لمنع التكرار.

---

## 📄 رخصة الاستخدام / License
جميع الحقوق محفوظة © متجر تمام شوب (TAMAM SHOP).
