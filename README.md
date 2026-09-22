# CodePilot2

مولّد تطبيقات بالذكاء الاصطناعي مرتبط بـ GitHub، يعمل الآن بهندسة **GitHub-only**.

## المعمارية

`الهاتف → GitHub Pages → GitHub Actions → مزود AI → مستودع GitHub مستقل`

- GitHub Pages: واجهة ثابتة فقط.
- GitHub Actions: التنفيذ، استدعاء مزود AI، والتحقق، وإنشاء المستودع.
- AI/GitHub secrets: تبقى داخل GitHub Actions Secrets.
- كل مشروع مولّد يذهب إلى مستودع مستقل.
- لا يتم تعديل `main` في CodePilot2 أثناء التوليد.

### لماذا لا يوجد /api؟

GitHub Pages لا يشغّل Node.js أو Python كـ Backend. لذلك كانت محاولة الواجهة السابقة لاستدعاء `/api/generate` معمارياً غير صحيحة. وجود ملف JavaScript داخل المستودع لا يحوله إلى API على GitHub Pages.

لذلك أزيل مسار Vercel/API من CodePilot2، وأصبح GitHub Actions هو مسار التنفيذ الوحيد.

## الاستخدام من الهاتف

1. افتح CodePilot2 على GitHub Pages.
2. اكتب فكرة التطبيق.
3. اختر المزود والتقنية والمنصة واسم المشروع.
4. اضغط **توليد المشروع الآن**.
5. سيُنسخ طلب التوليد ويفتح GitHub Actions.
6. اختر **CodePilot - Generate Project** ثم **Run workflow**.
7. الصق وصف التطبيق في خانة `prompt` واضبط الخيارات.
8. شغّل الـ workflow.
9. بعد نجاحه سيظهر رابط المستودع الجديد في ملخص التشغيل، وستوجد ملفات المشروع أيضاً كـ Artifact.

هذا الفصل بين الواجهة والتنفيذ مقصود لأسباب أمنية: لا نضع `GH_REPO_TOKEN` أو مفاتيح AI في JavaScript المنشور.

## GitHub Actions

الملف الرئيسي:

`.github/workflows/codepilot-generate.yml`

يدعم:

- Gemini
- DeepSeek
- OpenAI
- OpenRouter

ويستخدم `workflow_dispatch` مع مدخلات `prompt`, `provider`, `stack`, `platform`, `project`.

## Secrets

أضف المفاتيح من:

**Settings → Secrets and variables → Actions**

يمكن استخدام:

- `GEMINI_API_KEY`
- `DEEPSEEK_API_KEY`
- `OPENAI_API_KEY`
- `OPENROUTER_API_KEY`
- `GH_REPO_TOKEN`

لا تضع أي مفتاح داخل الواجهة أو في المستودع.

## Gemini

الموديل الحالي في Actions هو `gemini-3.8-flash`. وهو اسم موديل مستقر موثق في قائمة نماذج Gemini API الحالية. citeturn1search10

## OpenRouter

يستخدم workflow موجّه `openrouter/free` بدلاً من تثبيت معرف نموذج مجاني قد يتغير أو يتوقف.

## النتيجة

مثال:

- اسم المشروع: `test-clock`
- النتيجة: مستودع مستقل `gophisb/test-clock`
- CodePilot2: يبقى سليماً ولا يستقبل ملفات المشروع المولّد.

## مراجع هندسية مفتوحة المصدر

راجعنا مشاريع مفتوحة المصدر مشابهة للاستفادة من الأنماط الهندسية، لا لنسخها:

- Open Builder: مولّد تطبيقات AI مفتوح المصدر مع live preview وبنية GitHub Pages/Actions. urlOpen Builder على GitHubhttps://github.com/Amery2010/open-builder
- OpenPage: بنية JSON-first مع معاينة مباشرة وتعديلات قابلة للتتبع. urlOpenPage على GitHubhttps://github.com/buildingopen/openpage

المبدأ الذي نأخذه منهما: فصل التوليد عن العرض، وإبقاء حالة المشروع قابلة للتتبع، بدلاً من محاولة تشغيل Backend داخل GitHub Pages.
