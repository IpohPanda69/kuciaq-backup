#!/usr/bin/env node
const fs = require('fs');
const https = require('https');

const ENV_FILE = '/root/.openclaw/workspace/empire/.env.kuciaq';

function loadEnv() {
  const env = {};
  fs.readFileSync(ENV_FILE, 'utf8').split('\n').forEach(line => {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) return;
    const i = line.indexOf('=');
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  });
  if (!env.THREADS_ACCESS_TOKEN && env.KUCIAQ_THREADS_ACCESS_TOKEN) env.THREADS_ACCESS_TOKEN = env.KUCIAQ_THREADS_ACCESS_TOKEN;
  if (!env.THREADS_USER_ID && env.KUCIAQ_THREADS_USER_ID) env.THREADS_USER_ID = env.KUCIAQ_THREADS_USER_ID;
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

async function publishText(userId, token, text, replyToId = null) {
  const payload = { media_type: 'TEXT', text, access_token: token, no_link_preview: true };
  if (replyToId) payload.reply_to_id = replyToId;
  const create = await httpPost(`https://graph.threads.net/v1.0/${userId}/threads`, payload);
  if (!create.id) throw new Error('No container id: ' + JSON.stringify(create));
  await new Promise(r => setTimeout(r, 32000));
  const pub = await httpPost(`https://graph.threads.net/v1.0/${userId}/threads_publish`, { creation_id: create.id, access_token: token });
  return pub.id || create.id;
}

async function main() {
  const env = loadEnv();
  const token = env.THREADS_ACCESS_TOKEN;
  const userId = env.THREADS_USER_ID;

  const parts = [
    'korang pernah tak kucing you tiba-tiba jadi cerewet gila makan, dulu selalu habiskan bowl, tapi sekarang cium je terus pusing pergi macam kita bagi dia racun, sampai kita rasa macam kita lah yang tak pandai jaga dia padahal dah tukar tiga empat brand makanan pun still sama je',
    'i dah try macam-macam weh, pernah campur wet food, pernah panaskan sikit, pernah letak treats atas kibble, still kucing i buat muka kesian je taknak sentuh, lepas tu member i recommend try letak kibble topper ni, i ingatkan gimmick je, rupanya bila i tabur sikit atas makanan kering dia, bau dia wangi gila macam fresh cook, kucing i terus datang sondol habis licin dalam seminit',
    'yang i pakai ni nanovet kibble topper, i beli yang ni https://s.shopee.com.my/AADm9LNrXu, 70g ni tahan lama sebab cuma tabur sikit-sikit je, kucing you yang picky tu confirm terus selera balik, i tak tipu, korang try dulu tengok sendiri'
  ];

  const ids = [];
  let parentId = null;

  for (let i = 0; i < parts.length; i++) {
    console.log(`Posting part ${i + 1}/3: ${parts[i].substring(0, 60)}...`);
    const id = await publishText(userId, token, parts[i], parentId);
    ids.push(id);
    console.log(`✅ part ${i + 1}: ${id}`);
    parentId = id;
    if (i < parts.length - 1) {
      console.log('Waiting 5 minutes before next part...');
      await new Promise(r => setTimeout(r, 5 * 60 * 1000));
    }
  }

  console.log('All parts posted:', ids.join(','));
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
