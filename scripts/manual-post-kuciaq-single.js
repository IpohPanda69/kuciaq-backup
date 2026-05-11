#!/usr/bin/env node
const fs = require('fs');
const https = require('https');

const ENV_FILE = '/Users/ab1234/.openclaw/workspace/kuciaq/.env.kuciaq';

function loadEnv() {
  const env = {};
  fs.readFileSync(ENV_FILE, 'utf8').split('\n').forEach(line => {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) return;
    const i = line.indexOf('=');
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  });
  if (!env.THREADS_ACCESS_TOKEN && env.KUCIAQ_THREADS_ACCESS_TOKEN) {
    env.THREADS_ACCESS_TOKEN = env.KUCIAQ_THREADS_ACCESS_TOKEN;
  }
  if (!env.THREADS_USER_ID && env.KUCIAQ_THREADS_USER_ID) {
    env.THREADS_USER_ID = env.KUCIAQ_THREADS_USER_ID;
  }
  return env;
}

function httpPost(url, params) {
  const body = new URLSearchParams(params).toString();
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(new Error(data)); } });
    }).on('error', reject);
    req.write(body); req.end();
  });
}

async function publishText(userId, token, text) {
  const create = await httpPost(`https://graph.threads.net/v1.0/${userId}/threads`, {
    media_type: 'TEXT', text, access_token: token, no_link_preview: true,
  });
  if (!create.id) throw new Error('No container id: ' + JSON.stringify(create));
  await new Promise(r => setTimeout(r, 32000));
  const pub = await httpPost(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
    creation_id: create.id, access_token: token,
  });
  return pub.id || create.id;
}

async function main() {
  const env = loadEnv();
  const text = 'korang yang ada kucing. pernah tak rasa kucing you lebih manja dengan partner you dari you? i bela dia dari kecik. makan i beli. pasir i cuci. tapi boyfriend i datang. dia pergi duduk atas riba dia. betrayal gila.';
  const id = await publishText(env.THREADS_USER_ID, env.THREADS_ACCESS_TOKEN, text);
  console.log('Kuciaq posted:', id);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
