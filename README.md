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


## GitHub Integration

CodePilot2 now includes a simple GitHub connection foundation:
- OAuth login from the app
- Encrypted HttpOnly session cookie
- CSRF state validation
- Repository listing and controlled project writing
- GitHub access token stays server-side in an encrypted HttpOnly session cookie

### Vercel environment variables

Add these variables in Vercel Project Settings → Environment Variables:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_SESSION_SECRET` — long random secret

Create a GitHub OAuth App and set its callback URL to:

`https://YOUR-DOMAIN/api/github?action=callback`

For local development, use the matching local callback URL.

### Current flow
1. Sign in with GitHub.
2. Select a repository.
3. Use **بناء** to generate complete project files with the selected AI provider.
4. Upload the generated files to a new `codepilot/<timestamp>` branch.
5. `main` is not modified by CodePilot.

### Important
The AI keys and GitHub OAuth variables must be configured in the **Vercel runtime**. GitHub Actions Secrets do not automatically become Vercel runtime environment variables.

Required for GitHub login:
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_SESSION_SECRET`

Required for AI generation (at least one provider):
- `GEMINI_API_KEY`, or
- `DEEPSEEK_API_KEY`, or
- `OPENAI_API_KEY`, or
- `OPENROUTER_API_KEY`

After changing Vercel environment variables, redeploy the project so the new runtime values are loaded.
