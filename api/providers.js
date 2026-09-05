'use strict';

// ============================================================
// providers.js — مسؤولية واحدة: إدارة مزودي الذكاء الاصطناعي
// ============================================================

const PROVIDERS = {
  gemini: {
    base: 'https://generativelanguage.googleapis.com/v1beta/models',
    defaultModel: 'gemini-2.5-flash',
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
    defaultModel: 'openai/gpt-4o',
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
  const response = await fetch(provider.base, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 7000
    })
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

  const apiKey = getApiKey(provider);
  if (!apiKey) throw new Error(`مفتاح API غير موجود للمزود: ${providerName}`);

  const resolvedModel = model || provider.defaultModel;
  const text = provider.type === 'gemini'
    ? await callGeminiProvider(provider, apiKey, resolvedModel, systemPrompt, userPrompt)
    : await callChatProvider(provider, apiKey, resolvedModel, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

  return { text, provider: providerName, model: resolvedModel };
}

module.exports = { generate, getProvider, getProviderNames };
