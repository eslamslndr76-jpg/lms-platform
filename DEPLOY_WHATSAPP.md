# 🚀 دليل نشر WhatsApp Bot على Render.com

## الخطوات:

### 1. افتح Render Dashboard
https://dashboard.render.com/

### 2. أنشئ خدمة جديدة
- اضغط **New +**
- اختر **Web Service**

### 3. اربط المستودع
- اختر **GitHub**
- اختر المستودع: `eslamslndr76-jpg/lms-platform`

### 4. اضبط الإعدادات
| الإعداد | القيمة |
|---------|--------|
| **Name** | `whatsapp-bot` |
| **Root Directory** | `whatsapp-bot` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `node dist/index.js` |
| **Plan** | `Free` |

### 5. أضف متغيرات البيئة
من قسم **Environment Variables**:

| المفتاح | القيمة |
|---------|--------|
| `WA_BOT_PORT` | `3002` |
| `WA_BOT_SECRET` | `secure-random-secret-here` |
| `NODE_ENV` | `production` |

### 6. أنشئ الخدمة
- اضغط **Create Web Service**
- انتظر حتى ينتهي البناء (Build)

### 7. امسح QR Code
- بعد النجاح، افتح **Logs** للخدمة
- ستجد QR code في السجلات
- امسحه بهاتفك

### 8. اضبط Backend
أضف في Vercel Environment Variables:

| المفتاح | القيمة |
|---------|--------|
| `WHATSAPP_BOT_URL` | `https://whatsapp-bot.onrender.com` |
| `WHATSAPP_BOT_SECRET` | `secure-random-secret-here` |

---

## ⚠️ ملاحظات مهمة:
1. **Free tier على Render**: الخدمة تتوقف بعد 15 دقيقة من عدم النشاط
2. **إعادة التشغيل**: قد يستغرق 30-60 ثانية للتشغيل مرة أخرى
3. **أول تشغيل**: ستحتاج مسح QR code من واتساب
