'use strict';

const crypto = require('crypto');

const OAUTH_AUTHORIZE = 'https://github.com/login/oauth/authorize';
const OAUTH_TOKEN = 'https://github.com/login/oauth/access_token';
const GITHUB_API = 'https://api.github.com';

function cookieOptions(maxAge) {
  return [
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=' + maxAge
  ].join('; ');
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(
    header.split(';').map(function(part) { return part.trim(); }).filter(Boolean).map(function(part) {
      const i = part.indexOf('=');
      return i === -1 ? [part, ''] : [part.slice(0, i), decodeURIComponent(part.slice(i + 1))];
    })
  );
}

function getSecret() {
  return process.env.GITHUB_SESSION_SECRET || '';
}

function seal(value) {
  const secret = getSecret();
  if (!secret) throw new Error('GITHUB_SESSION_SECRET غير مضبوط');
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map(function(x) { return x.toString('base64url'); }).join('.');
}

function unseal(value) {
  try {
    const secret = getSecret();
    if (!secret || !value) return null;
    const parts = value.split('.');
    if (parts.length !== 3) return null;
    const key = crypto.createHash('sha256').update(secret).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(parts[0], 'base64url'));
    decipher.setAuthTag(Buffer.from(parts[1], 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(parts[2], 'base64url')),
      decipher.final()
    ]).toString('utf8');
  } catch {
    return null;
  }
}

function baseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  return proto + '://' + host;
}

function send(res, status, body, headers) {
  if (headers) Object.entries(headers).forEach(function(pair) { res.setHeader(pair[0], pair[1]); });
  return res.status(status).json(body);
}

async function githubFetch(path, token) {
  const response = await fetch(GITHUB_API + path, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
  const data = await response.json().catch(function() { return {}; });
  if (!response.ok) throw new Error(data.message || ('GitHub HTTP ' + response.status));
  return data;
}



async function githubRequest(path, token, options) {
  const response = await fetch(GITHUB_API + path, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options && options.headers ? options.headers : {})
    }
  });
  const data = await response.json().catch(function() { return {}; });
  if (!response.ok) throw new Error(data.message || ('GitHub HTTP ' + response.status));
  return data;
}

function validRepoName(value) {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value);
}

function validPath(value) {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 240 &&
    !value.startsWith('/') &&
    !value.includes('..') &&
    !value.includes('\\0');
}

async function writeProject(token, repository, files, message) {
  if (!validRepoName(repository)) throw new Error('اسم المستودع غير صالح.');
  if (!Array.isArray(files) || files.length < 1 || files.length > 80) {
    throw new Error('عدد الملفات يجب أن يكون بين 1 و80.');
  }

  const repo = await githubRequest('/repos/' + repository, token, { method: 'GET' });
  const baseBranch = repo.default_branch;
  const ref = await githubRequest('/repos/' + repository + '/git/ref/heads/' + encodeURIComponent(baseBranch), token, { method: 'GET' });
  const baseSha = ref.object.sha;
  const baseCommit = await githubRequest('/repos/' + repository + '/git/commits/' + baseSha, token, { method: 'GET' });

  const normalized = files.map(function(file) {
    const path = String(file.path || '');
    const content = String(file.content || '');
    if (!validPath(path)) throw new Error('مسار ملف غير صالح: ' + path);
    if (content.length > 200000) throw new Error('الملف كبير جداً: ' + path);
    return { path: path, content: content };
  });

  const blobs = [];
  for (const file of normalized) {
    const blob = await githubRequest('/repos/' + repository + '/git/blobs', token, {
      method: 'POST',
      body: JSON.stringify({ content: file.content, encoding: 'utf-8' })
    });
    blobs.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  const tree = await githubRequest('/repos/' + repository + '/git/trees', token, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: blobs })
  });

  const commit = await githubRequest('/repos/' + repository + '/git/commits', token, {
    method: 'POST',
    body: JSON.stringify({
      message: message || 'CodePilot: generate project',
      tree: tree.sha,
      parents: [baseSha]
    })
  });

  const branch = 'codepilot/' + Date.now().toString(36);
  await githubRequest('/repos/' + repository + '/git/refs', token, {
    method: 'POST',
    body: JSON.stringify({ ref: 'refs/heads/' + branch, sha: commit.sha })
  });

  return {
    branch: branch,
    commit_sha: commit.sha,
    files: normalized.map(function(file) { return file.path; })
  };
}

module.exports = async function handler(req, res) {
  const action = String(req.query && req.query.action || 'status');

  try {
    if (action === 'login') {
      if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
        return send(res, 503, { error: 'أضف GITHUB_CLIENT_ID و GITHUB_CLIENT_SECRET في Vercel أولاً.' });
      }
      const state = crypto.randomBytes(24).toString('hex');
      res.setHeader('Set-Cookie', 'github_oauth_state=' + encodeURIComponent(seal(state)) + '; ' + cookieOptions(600));
      const params = new URLSearchParams({
        client_id: process.env.GITHUB_CLIENT_ID,
        redirect_uri: baseUrl(req) + '/api/github?action=callback',
        scope: 'repo read:user'
      });
      return res.redirect(302, OAUTH_AUTHORIZE + '?' + params.toString());
    }

    if (action === 'callback') {
      const code = String(req.query && req.query.code || '');
      const state = String(req.query && req.query.state || '');
      const cookies = parseCookies(req);
      const expectedState = unseal(cookies.github_oauth_state);
      if (!code || !state || !expectedState || state !== expectedState) {
        return send(res, 400, { error: 'فشل التحقق من جلسة GitHub.' });
      }

      const tokenResponse = await fetch(OAUTH_TOKEN, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code: code,
          redirect_uri: baseUrl(req) + '/api/github?action=callback'
        })
      });
      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok || !tokenData.access_token) {
        return send(res, 502, { error: tokenData.error_description || 'فشل الحصول على رمز GitHub.' });
      }

      const session = seal(JSON.stringify({
        access_token: tokenData.access_token,
        created_at: Date.now()
      }));

      res.setHeader('Set-Cookie', [
        'github_session=' + encodeURIComponent(session) + '; ' + cookieOptions(2592000),
        'github_oauth_state=; ' + cookieOptions(0)
      ]);
      return res.redirect(302, '/');
    }

    if (action === 'logout') {
      res.setHeader('Set-Cookie', 'github_session=; ' + cookieOptions(0));
      return res.redirect(302, '/');
    }

    const cookies = parseCookies(req);
    const sessionRaw = unseal(cookies.github_session);
    const session = sessionRaw ? JSON.parse(sessionRaw) : null;

    if (action === 'status') {
      if (!session || !session.access_token) return send(res, 200, { connected: false });
      try {
        const user = await githubFetch('/user', session.access_token);
        return send(res, 200, { connected: true, login: user.login });
      } catch {
        return send(res, 200, { connected: false });
      }
    }

    if (action === 'write') {
      if (!session || !session.access_token) return send(res, 401, { error: 'اربط حساب GitHub أولاً.' });
      let payload = req.body;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch { payload = {}; }
      }
      const result = await writeProject(
        session.access_token,
        String(payload.repository || ''),
        payload.files,
        String(payload.message || 'CodePilot: generate project')
      );
      return send(res, 200, result);
    }

    if (action === 'repos') {
      if (!session || !session.access_token) return send(res, 401, { error: 'اربط حساب GitHub أولاً.' });
      const repos = await githubFetch('/user/repos?sort=updated&per_page=50', session.access_token);
      return send(res, 200, {
        repositories: repos.map(function(repo) {
          return {
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            private: repo.private,
            default_branch: repo.default_branch
          };
        })
      });
    }

    return send(res, 400, { error: 'إجراء GitHub غير معروف.' });
  } catch (error) {
    return send(res, 500, { error: error.message || 'خطأ في GitHub integration.' });
  }
};
