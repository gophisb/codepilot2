'use strict';

// ============================================================
// providers.js — مسؤولية واحدة: إدارة مزودي الذكاء الاصطناعي
// ============================================================

const OPENROUTER_FREE_MODELS = [
  'nvidia/nemotron-3-ultra-550b-a55b-20260604:free',
  'poolside/laguna-s-2.1:free',
  'inclusionai/ling-3.0-flash:free',
  'nvidia/nemotron-3.5-lightning:free'
];

const PROVIDERS = {
  gemini: {
    base: 'https://generativelanguage.googleapis.com/v1beta/models',
    defaultModel: 'gemini-3.8-flash',
    envKey: 'GEMINI_API_KEY',
    type: 'gemini'
  },
  deepseek: {
    base: 'https://api.deepseek.com/chat/completions',
    defaultModel: 'deepseek-chat',
    envKey: 'DEEPSEEK_API_KEY',
    type: 'chat'
  },
  openai: {
    base: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o',
    envKey: 'OPENAI_API_KEY',
    type: 'chat'
  },
  openrouter: {
    base: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: OPENROUTER_FREE_MODELS[0],
    fallbackModels: OPENROUTER_FREE_MODELS,
    envKey: 'OPENROUTER_API_KEY',
    type: 'chat'
  }
};

function getProvider(name) {
  return PROVIDERS[name] || null;
}

function getProviderNames() {
  return Object.keys(PROVIDERS);
}

function getApiKey(provider) {
  return process.env[provider.envKey] || null;
}

async function readResponse(response) {
  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }
  return { raw, data };
}

async function callChatProvider(provider, apiKey, model, messages) {
  const body = {
    model,
    messages,
    temperature: 0.2,
    max_tokens: 7000
  };

  // OpenRouter supports server-side model fallback: if the selected
  // model fails/rate-limits/is unavailable, it tries the next model.
  if (provider.fallbackModels) {
    body.models = provider.fallbackModels;
  }

  const response = await fetch(provider.base, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  const { raw, data } = await readResponse(response);
  if (!response.ok) {
    throw new Error(data?.error?.message || raw.slice(0, 300) || `HTTP ${response.status}`);
  }

  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('لم يرد المزود بنص');
  return text;
}

async function callGeminiProvider(provider, apiKey, model, systemPrompt, userPrompt) {
  const response = await fetch(
    `${provider.base}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 7000 }
      })
    }
  );

  const { raw, data } = await readResponse(response);
  if (!response.ok) {
    throw new Error(data?.error?.message || raw.slice(0, 300) || `HTTP ${response.status}`);
  }

  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('');
  if (!text) throw new Error('لم يرد Gemini بنص');
  return text;
}

async function generate({ providerName, model, systemPrompt, userPrompt }) {
  const provider = getProvider(providerName);
  if (!provider) throw new Error(`مزود غير معروف: ${providerName}`);

  const resolvedModel = model || provider.defaultModel;

  // Primary path: Gemini. If it is unavailable or fails, use OpenRouter,
  // which has its own server-side fallback list of free models.
  if (providerName === 'gemini') {
    const geminiKey = getApiKey(PROVIDERS.gemini);
    try {
      if (!geminiKey) throw new Error('مفتاح GEMINI_API_KEY غير موجود');
      const text = await callGeminiProvider(
        PROVIDERS.gemini,
        geminiKey,
        resolvedModel,
        systemPrompt,
        userPrompt
      );
      return { text, provider: 'gemini', model: resolvedModel };
    } catch (geminiError) {
      const openrouterKey = getApiKey(PROVIDERS.openrouter);
      if (!openrouterKey) {
        throw new Error(
          `فشل Gemini ولا يوجد مفتاح OpenRouter للبديل: ${geminiError.message}`
        );
      }

      try {
        const fallbackModel = PROVIDERS.openrouter.defaultModel;
        const text = await callChatProvider(
          PROVIDERS.openrouter,
          openrouterKey,
          fallbackModel,
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        );
        return {
          text,
          provider: 'openrouter',
          model: fallbackModel,
          fallbackFrom: 'gemini'
        };
      } catch (openrouterError) {
        throw new Error(
          `فشل Gemini وOpenRouter معاً. Gemini: ${geminiError.message}; OpenRouter: ${openrouterError.message}`
        );
      }
    }
  }

  const apiKey = getApiKey(provider);
  if (!apiKey) throw new Error(`مفتاح API غير موجود للمزود: ${providerName}`);

  const text = provider.type === 'gemini'
    ? await callGeminiProvider(provider, apiKey, resolvedModel, systemPrompt, userPrompt)
    : await callChatProvider(provider, apiKey, resolvedModel, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

  return { text, provider: providerName, model: resolvedModel };
}

module.exports = { generate, getProvider, getProviderNames };
