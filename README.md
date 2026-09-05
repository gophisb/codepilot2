# CodePilot

وكيل هندسي لبناء التطبيقات — يحوّل أفكارك إلى كود.

## النشر على Vercel

1. ارفع المشروع على GitHub
2. استورده في Vercel
3. أضف متغير البيئة: `GEMINI_API_KEY`
4. انشر

## المتغيرات المطلوبة

| المتغير | الوصف |
|---------|-------|
| `GEMINI_API_KEY` | مفتاح Google Gemini API |
| `AI_PROVIDER` | المزود الافتراضي، وقيمته المقترحة `gemini` |
| `AI_MODEL` | النموذج الاختياري، والافتراضي `gemini-2.5-flash` |
| `DEEPSEEK_API_KEY` | مفتاح DeepSeek API (اختياري) |
| `OPENAI_API_KEY` | مفتاح OpenAI (اختياري) |
| `OPENROUTER_API_KEY` | مفتاح OpenRouter (اختياري) |

يدعم التطبيق Google Gemini وDeepSeek وOpenAI وOpenRouter. أضف المفاتيح في إعدادات Vercel فقط، ولا ترفعها إلى GitHub.

## الهيكل

```
codepilot/
├── index.html        ← الواجهة
├── api/
│   ├── chat.js       ← معالج HTTP
│   └── providers.js  ← إدارة مزودي AI
├── .gitignore
└── README.md
```
