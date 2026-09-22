# CodePilot2

مولّد تطبيقات بالذكاء الاصطناعي مرتبط بـ GitHub، بدون الاعتماد على Vercel.

## المعمارية الحالية

الهاتف → GitHub Actions → مزود الذكاء الاصطناعي → فرع جديد في GitHub

الواجهة موجودة على GitHub Pages، بينما التوليد نفسه يعمل داخل GitHub Actions. هذا مهم لأن GitHub Pages لا يشغّل backend سرياً ولا يحفظ مفاتيح API.

## التشغيل

1. افتح تبويب **Actions** في المستودع.
2. اختر **CodePilot - Generate Project**.
3. اضغط **Run workflow**.
4. اكتب وصف التطبيق.
5. اختر مزود الذكاء الاصطناعي والتقنية والمنصة.
6. شغّل الـ workflow.
7. سيولد CodePilot الملفات ثم ينشئ فرعاً باسم `codepilot/run-...`.
8. فرع `main` لا يتم تعديله.

رابط التشغيل:
https://github.com/gophisb/codepilot2/actions/workflows/codepilot-generate.yml

## مفاتيح الذكاء الاصطناعي

أضف المفتاح المناسب من:
**Settings → Secrets and variables → Actions → New repository secret**

يمكن استخدام واحد من:
- `GEMINI_API_KEY`
- `DEEPSEEK_API_KEY`
- `OPENAI_API_KEY`
- `OPENROUTER_API_KEY`

لا تضع أي مفتاح داخل الكود أو داخل GitHub Pages.

## لماذا أزلنا Vercel؟

GitHub Pages خدمة ثابتة، وملفات `/api/*.js` السابقة كانت تعتمد على Vercel Serverless Functions. لذلك نقلنا التنفيذ الحساس إلى GitHub Actions بدلاً من وضع مفاتيح API في المتصفح.

## الأمان

- مفاتيح AI تبقى داخل GitHub Actions Secrets.
- التوليد لا يكتب مباشرة إلى `main`.
- كل تشغيل ينتج فرعاً مستقلاً.
- مسارات الملفات الناتجة تُفحص لمنع المسارات غير الآمنة.
- لا توجد مفاتيح API في الواجهة.

## المزودات

يدعم workflow:
- Google Gemini
- DeepSeek
- OpenAI
- OpenRouter

