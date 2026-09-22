# CodePilot2

مولّد تطبيقات بالذكاء الاصطناعي مرتبط بـ GitHub، مع مسار مباشر اختياري عبر Vercel API ومسار GitHub Actions مستقل.

## المعمارية الحالية

يوجد مساران مستقلان:

- **التوليد المباشر:** الواجهة → `/api/generate` على Vercel → مزود الذكاء الاصطناعي → عرض الملفات والمعاينة داخل CodePilot2.
- **التوليد الكامل عبر Actions:** الهاتف → GitHub Actions → مزود الذكاء الاصطناعي → مستودع GitHub مستقل باسم المشروع.

مسار Actions لم يُحذف، ومسار المعاينة لا يعدّل `main`.

الواجهة موجودة على GitHub Pages، بينما التوليد والتنفيذ الحساس يعملان داخل GitHub Actions. كل مشروع مولّد يذهب إلى مستودع مستقل، ولا يتم تعديل `main` في CodePilot2.

## التشغيل

1. افتح تبويب **Actions** في المستودع.
2. اختر **CodePilot - Generate Project**.
3. اضغط **Run workflow**.
4. اكتب وصف التطبيق.
5. اختر مزود الذكاء الاصطناعي والتقنية والمنصة.
6. اكتب اسم المستودع الجديد، مثل `test-clock`.
7. شغّل الـ workflow.
8. سيولد CodePilot الملفات ثم ينشئ مستودعاً مستقلاً باسم المشروع ويضع الملفات فيه.
9. `main` في CodePilot2 لا يتم تعديله.

رابط التشغيل:
https://github.com/gophisb/codepilot2/actions/workflows/codepilot-generate.yml

## مفاتيح الذكاء الاصطناعي

أضف مفتاح مزود الذكاء الاصطناعي من:
**Settings → Secrets and variables → Actions → New repository secret**

يمكن استخدام واحد من:
- `GEMINI_API_KEY`
- `DEEPSEEK_API_KEY`
- `OPENAI_API_KEY`
- `OPENROUTER_API_KEY`

ولا تضع أي مفتاح داخل الكود أو داخل GitHub Pages.

## صلاحية إنشاء المستودعات

لإنشاء مستودع مستقل تلقائياً، أضف سراً باسم:

`GH_REPO_TOKEN`

استخدم Fine-grained Personal Access Token لحساب GitHub نفسه، مع صلاحية **Administration: Read and write** لإنشاء مستودع جديد، وفق متطلبات GitHub الحالية.

لا تضع هذا الرمز داخل المحادثة أو الكود. ضعه فقط في **GitHub Actions Secrets**.

## النتيجة

مثال:
- اسم المشروع: `test-clock`
- النتيجة: مستودع مستقل `gophisb/test-clock`
- الملفات الناتجة: داخل `test-clock`
- CodePilot2: يبقى سليماً ولا يستقبل ملفات المشروع المولّد.

## إعداد التوليد المباشر على Vercel

إذا كان نطاق `codepilot2.vercel.app` مرتبطاً بهذا المستودع، يجب إضافة مفتاح مزود واحد على الأقل في **Vercel → Project → Settings → Environment Variables** باسم أحد المتغيرات: `GEMINI_API_KEY` أو `DEEPSEEK_API_KEY` أو `OPENAI_API_KEY` أو `OPENROUTER_API_KEY`، ثم إعادة النشر.

المسار `/api/health` لا يعرض المفاتيح نفسها؛ يعرض فقط أسماء المزودات التي تم إعدادها، لتسهيل تشخيص سبب عدم عمل التوليد.

Gemini الافتراضي الحالي هو `gemini-3.8-flash`. أما OpenRouter فيستخدم `openrouter/free` في مسار Actions، وهو موجّه رسمي للنماذج المجانية.

## الأمان

- مفاتيح AI وGitHub تبقى داخل GitHub Actions Secrets.
- CodePilot2 `main` لا يتم تعديله أثناء توليد المشاريع.
- كل تشغيل ينشئ مستودعاً مستقلاً.
- اسم المستودع ومسارات الملفات الناتجة تُفحص.
- لا توجد مفاتيح API في الواجهة.

## المزودات

يدعم workflow:
- Google Gemini
- DeepSeek
- OpenAI
- OpenRouter
