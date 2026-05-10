#!/usr/bin/env node
const fs = require('fs');
const https = require('https');

const ENV_FILE = '/root/.openclaw/workspace/empire/.env.kuciaq';
const QUEUE_FILE = '/root/.openclaw/workspace/empire/data/queue/kuciaq-warmup.json';

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
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { reject(new Error(data)); }
      });
    }).on('error', reject);
    req.write(body);
    req.end();
  });
}

async function publishText(userId, token, text, replyToId = null) {
  const payload = {
    media_type: 'TEXT',
    text,
    access_token: token,
    no_link_preview: true,
  };
  if (replyToId) payload.reply_to_id = replyToId;

  const create = await httpPost(`https://graph.threads.net/v1.0/${userId}/threads`, payload);
  if (!create.id) throw new Error('No container id: ' + JSON.stringify(create));

  await new Promise(r => setTimeout(r, 32000));

  const pub = await httpPost(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
    creation_id: create.id,
    access_token: token,
  });
  return pub.id || create.id;
}

async function postItem(item, env) {
  const token = env.THREADS_ACCESS_TOKEN;
  const userId = env.THREADS_USER_ID;

  const parts = item.thread_parts || [item.text];
  const ids = [];
  let parentId = null;

  for (let i = 0; i < parts.length; i++) {
    const text = typeof parts[i] === 'string' ? parts[i] : parts[i].text;
    console.log(`[${item.id}] posting part ${i + 1}/${parts.length}: ${text.substring(0, 60)}...`);
    const id = await publishText(userId, token, text, parentId);
    ids.push(id);
    console.log(`[${item.id}] ✅ part ${i + 1}: ${id}`);
    parentId = id;
    if (i < parts.length - 1) await new Promise(r => setTimeout(r, 3000));
  }

  return ids;
}

async function main() {
  const env = loadEnv();
  const data = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));

  const items = [
    data.find(x => x.id === 'kq-hq-407'),
    data.find(x => x.id === 'kq-hq-408'),
    data.find(x => x.id === 'kq-hq-409'),
  ];

  for (const item of items) {
    if (!item) {
      console.log('Item not found');
      continue;
    }
    if (item.status === 'posted') {
      console.log(`[${item.id}] already posted`);
      continue;
    }

    try {
      console.log(`\n=== Posting ${item.id} ===`);
      const ids = await postItem(item, env);
      item.status = 'posted';
      item.thread_id = ids[0];
      item.thread_chain_ids = ids;
      item.posted_at = new Date().toISOString();
      fs.writeFileSync(QUEUE_FILE, JSON.stringify(data, null, 2));
      console.log(`[${item.id}] Queue updated`);
    } catch (e) {
      console.error(`[${item.id}] ❌ ERROR: ${e.message}`);
    }

    if (item !== items[items.length - 1]) {
      console.log('Waiting 60s before next post...');
      await new Promise(r => setTimeout(r, 60000));
    }
  }
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
