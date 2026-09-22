'use strict';

module.exports = function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'الطريقة غير مسموح بها' });
  const keys = {
    gemini: Boolean(process.env.GEMINI_API_KEY),
    deepseek: Boolean(process.env.DEEPSEEK_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY)
  };
  const providers = Object.keys(keys).filter((name) => keys[name]);
  return res.status(200).json({ ok: true, service: 'CodePilot2 API', providers });
};
