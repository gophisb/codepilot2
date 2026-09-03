'use strict';

// ============================================================
// providers.js — مسؤولية واحدة: إدارة مزودي الذكاء الاصطناعي
// ============================================================

const PROVIDERS = {
  deepseek: {
    base: 'https://api.deepseek.com/chat/completions',
    defaultModel: 'deepseek-chat',
    envKey: 'DEEPSEEK_API_KEY'
  },
  openai: {
    base: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o',
    envKey: 'OPENAI_API_KEY'
  },
  openrouter: {
    base: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'openai/gpt-4o',
    envKey: 'OPENROUTER_API_KEY'
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

async function callProvider(provider, apiKey, model, messages) {
  const response = await fetch(provider.base, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 7000
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || `HTTP ${response.status}`);
  }

  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('لم يرد المزود بنص');

  return text;
}

async function generate({ providerName, model, systemPrompt, userPrompt }) {
  const provider = getProvider(providerName);
  if (!provider) throw new Error(`مزود غير معروف: ${providerName}`);

  const apiKey = getApiKey(provider);
  if (!apiKey) throw new Error(`مفتاح API غير موجود للمزود: ${providerName}`);

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  const resolvedModel = model || provider.defaultModel;
  const text = await callProvider(provider, apiKey, resolvedModel, messages);

  return { text, provider: providerName, model: resolvedModel };
}

module.exports = { generate, getProvider, getProviderNames };
