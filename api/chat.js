'use strict';

// ============================================================
// chat.js — مسؤولية واحدة: معالج HTTP للطلبات
// ============================================================

const { generate, getProviderNames } = require('./providers');

const MODES = {
  build: 'حوّل الفكرة إلى مشروع قابل للتنفيذ. ابدأ بمتطلبات وبنية ملفات، ثم ولّد الملفات الأساسية كاملة. لكل ملف استخدم كتلة مستقلة بصيغة ```language filename=path/to/file```.',
  debug: 'شخّص المشكلة أولاً، ثم اقترح أقل إصلاح آمن. لا تعيد الهيكلة ولا تحذف ميزات سليمة.',
  plan:  'أنشئ مواصفات عملية: الهدف، المستخدمون، الوظائف، الشاشات، البيانات، المعمارية، مراحل التنفيذ.',
  explain: 'اشرح المشروع أو الكود بالعربية بوضوح، مع التدفق والمخاطر والتحسينات المقترحة.'
};

function buildSystemPrompt(mode, project, platform, stack) {
  return `أنت CodePilot — وكيل هندسي متخصص في بناء تطبيقات Android والويب وPWA.

مبادئك الأساسية:
- لا تدّع اختبارًا لم يتم تشغيله
- لا تكشف الأسرار أو مفاتيح API
- لا تكسر ميزة سليمة
- استخدم أقل تغيير آمن
- اهتم بالأمان وRTL والاستجابة والأداء

وضع العمل: ${MODES[mode] || MODES.build}
المشروع: ${project || 'مشروع جديد'}
المنصة: ${platform || 'Web / PWA'}
التقنية: ${stack || 'HTML / CSS / JavaScript'}`;
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

function sendError(res, status, message) {
  return res.status(status).json({ error: message, providers: getProviderNames() });
}

module.exports = async function handler(req, res) {
  // رفض غير POST
  if (req.method !== 'POST') {
    return sendError(res, 405, 'الطريقة غير مسموح بها');
  }

  try {
    const body = parseBody(req);
    const prompt = String(body.prompt || '').trim();

    // التحقق من المدخلات
    if (!prompt) return sendError(res, 400, 'أدخل وصف المشروع أو طلبك.');
    if (prompt.length > 5000) return sendError(res, 400, 'الطلب طويل جداً (الحد 5000 حرف).');

    const systemPrompt = buildSystemPrompt(
      body.mode,
      body.project,
      body.platform,
      body.stack
    );

    const providerName = String(body.provider || process.env.AI_PROVIDER || 'gemini').toLowerCase();
    const model = body.model || process.env.AI_MODEL || null;

    const result = await generate({ providerName, model, systemPrompt, userPrompt: prompt });

    return res.status(200).json({
      text: result.text,
      provider: result.provider,
      model: result.model,
      providers: getProviderNames()
    });

  } catch (error) {
    const message = error?.message || 'خطأ داخلي في الخادم';
    const status = message.includes('مفتاح API') ? 503 : 500;
    return sendError(res, status, message);
  }
};
