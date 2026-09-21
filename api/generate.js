'use strict';

const { generate } = require('./providers');

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

function systemPrompt(body) {
  return [
    'أنت CodePilot، مهندس توليد تطبيقات.',
    'حوّل طلب المستخدم إلى مشروع صغير قابل للتشغيل.',
    'أعد JSON صالحاً فقط، بدون Markdown أو شرح خارجي.',
    'الشكل الإلزامي: {"files":[{"path":"relative/path","content":"full file content"}],"summary":"short Arabic summary"}',
    'يجب أن تكون الملفات كاملة وليست مقتطفات.',
    'لا تستخدم مسارات مطلقة ولا .. في المسارات.',
    'لا تضع أسراراً أو مفاتيح API داخل الملفات.',
    'ابدأ بأقل مشروع عملي، ولا تضف مكتبات غير ضرورية.',
    'التقنية: ' + String(body.stack || 'HTML/CSS/JavaScript'),
    'المنصة: ' + String(body.platform || 'Web / PWA'),
    'اسم المشروع: ' + String(body.project || 'مشروع جديد')
  ].join('\n');
}

function extractJson(text) {
  const cleaned = String(text || '').trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('النموذج لم يُرجع JSON صالحاً.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'الطريقة غير مسموح بها' });
  try {
    const body = parseBody(req);
    const prompt = String(body.prompt || '').trim();
    if (!prompt) return res.status(400).json({ error: 'أدخل وصف التطبيق.' });
    if (prompt.length > 5000) return res.status(400).json({ error: 'الطلب طويل جداً.' });
    const providerName = String(body.provider || process.env.AI_PROVIDER || 'gemini').toLowerCase();
    const result = await generate({
      providerName,
      model: body.model || process.env.AI_MODEL || null,
      systemPrompt: systemPrompt(body),
      userPrompt: prompt
    });
    const parsed = extractJson(result.text);
    if (!Array.isArray(parsed.files) || parsed.files.length < 1 || parsed.files.length > 40) throw new Error('المشروع الناتج لا يحتوي على عدد ملفات صالح.');
    const files = parsed.files.map(function(file) { return { path: String(file.path || ''), content: String(file.content || '') }; });
    for (const file of files) {
      if (!/^[A-Za-z0-9._/-]+$/.test(file.path) || file.path.startsWith('/') || file.path.includes('..')) throw new Error('مسار ملف غير صالح: ' + file.path);
    }
    return res.status(200).json({ provider: result.provider, model: result.model, summary: String(parsed.summary || ''), files: files });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'فشل توليد المشروع.' });
  }
};