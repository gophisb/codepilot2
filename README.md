# CodePilot

وكيل هندسي لبناء التطبيقات — يحوّل أفكارك إلى كود.

## النشر على Vercel

1. ارفع المشروع على GitHub
2. استورده في Vercel
3. أضف متغير البيئة: `DEEPSEEK_API_KEY`
4. انشر

## المتغيرات المطلوبة

| المتغير | الوصف |
|---------|-------|
| `DEEPSEEK_API_KEY` | مفتاح DeepSeek API |
| `OPENAI_API_KEY` | مفتاح OpenAI (اختياري) |
| `OPENROUTER_API_KEY` | مفتاح OpenRouter (اختياري) |

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
