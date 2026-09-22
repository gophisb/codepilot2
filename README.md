# CodePilot2

مولّد تطبيقات AI مبني حول GitHub، مع واجهة تعمل على GitHub Pages ومحرك تنفيذ آمن داخل GitHub Actions.

## المعمارية الحالية

`الهاتف → GitHub Pages → GitHub Actions → AI → مستودع GitHub مستقل → CodePilot2 Loader`

- **GitHub Pages:** واجهة ثابتة؛ لا تحتوي أسراراً ولا تحاول تشغيل Backend.
- **GitHub Actions:** يستقبل الطلب عبر `workflow_dispatch`، يستدعي مزود AI، يتحقق من الملفات، وينشئ مستودعاً مستقلاً.
- **AI/GitHub secrets:** تبقى داخل GitHub Actions Secrets.
- **المستودع الناتج:** كل مشروع يولّد في مستودع مستقل.
- **CodePilot2:** يستطيع تحميل المستودع العام الناتج وعرض الملفات والكود وتعديله محلياً وفتح معاينة مؤقتة.

## لماذا أزلنا /api؟

وجود `/api/generate` في مشروع منشور على GitHub Pages لا ينشئ خادماً. GitHub Pages يخدم ملفات ثابتة فقط؛ لذلك كان مسار `fetch("/api/generate")` سبباً مباشراً لفشل النسخة السابقة.

لن نضع `GH_REPO_TOKEN` أو مفاتيح AI داخل JavaScript المنشور كحل سريع. هذا كان سيحوّل إصلاح العطل إلى تسريب أسرار.

## الاستخدام من الهاتف

1. افتح CodePilot2.
2. اكتب وصف التطبيق واختر المزود والتقنية والمنصة واسم المشروع.
3. اضغط **تجهيز التوليد وفتح GitHub Actions**.
4. في GitHub Actions اختر **Run workflow**.
5. أدخل نفس القيم التي جهزتها الواجهة، ثم شغّل Workflow.
6. بعد نجاحه، سيظهر رابط المستودع الجديد في ملخص التشغيل.
7. انسخ رابط المستودع إلى خانة **تحميل المشروع الناتج** داخل CodePilot2.
8. ستظهر الملفات، ويمكن تعديل الكود ونسخه وتجربة `index.html` في المعاينة المؤقتة.

## الكود والملفات والمعاينة

واجهة CodePilot2 تحتوي الآن على:

- قائمة ملفات المشروع.
- محرر نصي للكود.
- نسخ الكود.
- نسخ مسار الملف.
- تحميل مستودع GitHub عام مباشرة.
- معاينة مؤقتة داخل `iframe sandbox`.
- دمج CSS وJS المحليين في `index.html` للمعاينة.
- تحديث المعاينة عند تعديل الكود محلياً.

المعاينة ليست Build نهائياً ولا تنشر التعديلات إلى GitHub؛ هي مساحة اختبار سريعة.

## Workflow

الملف:

`.github/workflows/codepilot-generate.yml`

يدعم:

- Gemini
- DeepSeek
- OpenAI
- OpenRouter

ويستخدم `workflow_dispatch` مع:

- `prompt`
- `provider`
- `stack`
- `platform`
- `project`

## Gemini

يستخدم Workflow حالياً `gemini-3.8-flash` مع إخراج JSON منظّم. تم إزالة `temperature` من طلب Gemini لأن وثائق Gemini 3.8 الحالية تنص على إزالة معاملات أخذ العينات القديمة عند الترحيل إلى 3.8، كما يدعم النموذج إخراج JSON منظماً. citeturn1search0turn3search0turn3search5

## التحقق من الناتج

قبل إنشاء المستودع:

- يتم التحقق من اسم المشروع.
- يتم رفض مسارات `.git` و`.github` ومسارات traversal.
- يتم رفض الملفات النصية الكبيرة جداً.
- يتم فرض حد للملفات المولدة.
- يتم إنشاء `generation-meta.json` وملخص للتشغيل.
- يتم إنشاء Artifact مضغوط للمشروع.

ثم ينشأ مستودع مستقل ويُدفع إليه المشروع. لا يتم تعديل `main` في CodePilot2.

## Secrets

من:

**Settings → Secrets and variables → Actions**

المتغيرات المطلوبة بحسب المزود:

- `GEMINI_API_KEY`
- `DEEPSEEK_API_KEY`
- `OPENAI_API_KEY`
- `OPENROUTER_API_KEY`
- `GH_REPO_TOKEN`

### GH_REPO_TOKEN

إنشاء مستودع عبر GitHub API يحتاج صلاحية مناسبة لإنشاء المستودعات؛ بالنسبة إلى Fine-grained PAT، توضح وثائق GitHub أن endpoint إنشاء مستودع للمستخدم يحتاج **Administration: write**، بينما PAT الكلاسيكي يحتاج `public_repo` أو `repo` للمستودع العام. citeturn2search1turn2search3turn2search7

لا تضع هذا التوكن في الواجهة.

## لماذا لا يوجد زر توليد سري مباشر من Pages؟

صفحة GitHub Pages لا تملك هوية GitHub للمستخدم. تشغيل `workflow_dispatch` من API يتطلب مصادقة وصلاحية Actions مناسبة؛ وثائق GitHub تحدد أن Fine-grained tokens تحتاج **Actions: write** لهذا endpoint. citeturn0search1

لذلك المرحلة الحالية تفصل الواجهة عن التنفيذ بدلاً من وضع PAT داخل المتصفح.

**المرحلة التالية، إذا أردنا زر Generate حقيقياً من داخل الصفحة، هي GitHub App/OAuth مع أقل صلاحيات ممكنة.** لن نستخدم PAT مكشوفاً في JavaScript.

## مبدأ المشروع

CodePilot2 ليس مجرد مولّد نصوص. المسار المستهدف:

**فكرة → مواصفات → توليد → مستودع → قراءة الملفات → تعديل الكود → معاينة → نشر/تسليم**

مع إبقاء الأسرار والتنفيذ الموثوق داخل GitHub Actions.
