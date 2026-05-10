#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execFile } = require('child_process');

const QUEUE_FILE = '/root/.openclaw/workspace/empire/data/queue/kuciaq-warmup.json';
const ENV_FILE = '/root/.openclaw/workspace/empire/.env.kuciaq';
const LOCK_FILE = '/root/.openclaw/workspace/empire/data/autopilot-kuciaq.lock';
const ALERT_FILE = '/root/.openclaw/workspace/empire/data/autopilot-alerts.jsonl';
const LOG_PREFIX = '[autopilot]';
const MIN_POST_GAP_MIN = 90;
const MAX_OVERDUE_MIN = 360; // 6 hours
const AFFILIATE_BEST_HOURS_UTC = [3, 12]; // 11:00 MYT, 20:00 MYT

function loadEnv() {
  const env = {};
  if (!fs.existsSync(ENV_FILE)) return env;
  fs.readFileSync(ENV_FILE, 'utf8').split('\n').forEach((line) => {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) return;
    const i = line.indexOf('=');
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  });
  if (!env.THREADS_TOKEN && env.THREADS_ACCESS_TOKEN) env.THREADS_TOKEN = env.THREADS_ACCESS_TOKEN;
  return env;
}

function emitAlert(env, payload) {
  const rec = { ts: new Date().toISOString(), account: 'kuciaq', ...payload };
  try { fs.appendFileSync(ALERT_FILE, JSON.stringify(rec) + '\n'); } catch {}

  const bot = env.TELEGRAM_BOT_TOKEN;
  const chat = env.TELEGRAM_CHAT_ID;
  if (!bot || !chat) return;

  const msg = `[qiesya-alert] ${rec.type || 'event'}\n${rec.id || ''}\n${rec.reason || rec.error || ''}`.trim();
  httpPost(`https://api.telegram.org/bot${bot}/sendMessage`, {
    chat_id: chat,
    text: msg,
    disable_web_page_preview: 'true',
  }).catch(() => {});
}

function httpPost(url, params, timeoutMs = 30000) {
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
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message || 'Threads API error'));
          resolve(parsed);
        } catch {
          reject(new Error(`Bad response: ${data}`));
        }
      });
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`HTTP request timeout after ${timeoutMs}ms`));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function loadQueue() {
  if (!fs.existsSync(QUEUE_FILE)) return [];
  const raw = fs.readFileSync(QUEUE_FILE, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    const backup = `${QUEUE_FILE}.broken-${Date.now()}.json`;
    try { fs.writeFileSync(backup, raw); } catch {}
    throw new Error(`Queue JSON invalid. Backup saved to ${backup}. ${e.message}`);
  }
}

function saveQueue(queue) {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

function isHardShill(item) {
  const pillar = String(item?.pillar || '').toLowerCase();
  const ctype = String(item?.strategy?.contentType || '').toLowerCase();
  return ctype === 'hard-shill' || pillar.includes('hard-shill');
}

function hardShillCounts(queue, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  let todayCount = 0;
  let weekCount = 0;

  for (const item of queue) {
    if (item.status !== 'posted' || !isHardShill(item)) continue;
    const ts = item.posted_at ? new Date(item.posted_at) : null;
    if (!ts || Number.isNaN(ts.getTime())) continue;
    if (ts.toISOString().slice(0, 10) === today) todayCount++;
    if (ts >= weekAgo) weekCount++;
  }

  return { todayCount, weekCount };
}

function postponeByOneDay(item) {
  const base = item.scheduled_utc ? new Date(item.scheduled_utc) : new Date();
  const next = new Date(base.getTime() + 24 * 60 * 60 * 1000);
  item.scheduled_utc = next.toISOString().slice(0, 19) + 'Z';
  item.date = next.toISOString().slice(0, 10);
}

function alignAffiliateToBestWindow(item, now = new Date()) {
  if (!isAffiliatePost(item)) return false;

  const current = item.scheduled_utc ? new Date(item.scheduled_utc) : new Date(now);
  const dayStart = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate(), 0, 0, 0));

  const candidates = AFFILIATE_BEST_HOURS_UTC
    .map(h => {
      const t = new Date(Date.UTC(dayStart.getUTCFullYear(), dayStart.getUTCMonth(), dayStart.getUTCDate(), h, 0, 0));
      return { hour: h, time: t, diff: Math.abs(t - current) };
    })
    .filter(c => {
      const hoursSince = (now - c.time) / (60 * 60 * 1000);
      return c.time > now || (c.time <= now && hoursSince <= 2);
    })
    .sort((a, b) => a.diff - b.diff);

  let target;
  if (candidates.length > 0) {
    target = candidates[0].time;
  } else {
    const tomorrow = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    target = new Date(Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate(), AFFILIATE_BEST_HOURS_UTC[0], 0, 0));
  }

  if (Math.abs(target - current) < 120 * 60 * 1000) return false;

  const targetIso = target.toISOString().slice(0, 19) + 'Z';
  if (item.scheduled_utc !== targetIso) {
    item.scheduled_utc = targetIso;
    item.date = target.toISOString().slice(0, 10);
    item.slot = target.getUTCHours() === 12 ? 'night' : 'afternoon';
    return true;
  }
  return false;
}

async function publishText(userId, token, text, replyToId = null, opts = {}) {
  const cleaned = String(text || '').trim();
  const capped = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  const payload = {
    media_type: opts.imageUrl ? 'IMAGE' : 'TEXT',
    text: capped,
    access_token: token,
    no_link_preview: true,
  };
  if (opts.imageUrl) payload.image_url = opts.imageUrl;
  if (replyToId) payload.reply_to_id = replyToId;

  const create = await httpPost(`https://graph.threads.net/v1.0/${userId}/threads`, payload);
  if (!create.id) throw new Error('No container id');
  await new Promise((r) => setTimeout(r, 31000));
  const pub = await httpPost(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
    creation_id: create.id,
    access_token: token,
  });
  return pub.id || create.id;
}

function isAffiliatePost(item) {
  return item?.affiliate?.enabled === true ||
    item?.pillar === 'soft-shill' ||
    ['affiliate-soft-proof', 'affiliate-chain-7'].includes(item?.pillar) ||
    (item?.affiliateLink && item?.affiliateLink.length > 0);
}

function stripLinks(text = '') {
  return String(text)
    .split('\n')
    .filter(line => !/https?:\/\/\S+/i.test(line) && !/s\.shopee\.com\.my\//i.test(line) && !/shopee\.com\.my\//i.test(line))
    .join('\n')
    .trim();
}

function normalizePartText(t = '') {
  return String(t).replace(/\s*\b\d+\s*\/\s*\d+\b\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractTextFromPart(p) {
  if (typeof p === 'string') {
    const match1 = p.match(/['"]text['"]\s*:\s*['"](.+?)['"]\s*\}/);
    if (match1) return match1[1];
    return p;
  }
  if (typeof p === 'object' && p !== null) {
    return String(p.text || '');
  }
  return String(p || '');
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatLinkForPost(link = '') {
  // Reduce rich preview chance: remove scheme + wrap in parentheses with CTA text
  const clean = String(link).replace(/^https?:\/\//i, '');
  return clean;
}

function inferContentType(item) {
  const t = String(item?.strategy?.contentType || '').toLowerCase();
  if (t) return t;
  const pillar = String(item?.pillar || '').toLowerCase();
  if (pillar.includes('hard-shill')) return 'hard-shill';
  if (pillar.includes('affiliate')) return 'soft-shill';
  if (pillar.includes('value') || pillar.includes('tip') || pillar.includes('advice')) return 'value';
  return 'engagement';
}

function recentMix(queue, n = 10) {
  const posted = queue
    .filter(x => x.status === 'posted' && x.posted_at)
    .sort((a, b) => new Date(b.posted_at) - new Date(a.posted_at))
    .slice(0, n);
  const counts = { engagement: 0, value: 0, 'soft-shill': 0, 'hard-shill': 0 };
  for (const p of posted) {
    const ct = inferContentType(p);
    counts[ct] = (counts[ct] || 0) + 1;
  }
  return counts;
}

function hasTwoRecentNonAffiliate(queue) {
  const posted = queue
    .filter(x => x.status === 'posted' && x.posted_at)
    .sort((a, b) => new Date(b.posted_at) - new Date(a.posted_at))
    .slice(0, 2);
  // If fewer than 2 total posts exist, allow posting (cold start)
  if (posted.length < 2) return true;
  return posted.every(x => !isAffiliatePost(x));
}

function shouldPostByMix(queue, item) {
  const ct = inferContentType(item);
  const m = recentMix(queue, 10);
  if (ct === 'hard-shill' && m['hard-shill'] >= 1) return { ok: false, reason: 'mix-cap-hard-shill' };
  if (ct === 'soft-shill' && m['soft-shill'] >= 2) return { ok: false, reason: 'mix-cap-soft-shill' };

  // New rule: require 2 non-affiliate posts before each affiliate post
  if (isAffiliatePost(item) && !hasTwoRecentNonAffiliate(queue)) {
    return { ok: false, reason: 'need-2-non-aff-before-affiliate' };
  }

  // Keep value/advice healthy in feed
  if ((ct === 'engagement' || ct === 'soft-shill') && m.value < 2) {
    const hasDueValue = queue.some(q => q.status === 'pending' && q.scheduled_utc && new Date(q.scheduled_utc) <= new Date() && inferContentType(q) === 'value');
    if (hasDueValue) return { ok: false, reason: 'prioritize-value-content' };
  }
  return { ok: true };
}

function preflightCheck(item) {
  const text = String(item?.text || '');
  const parts = Array.isArray(item?.thread_parts) && item.thread_parts.length > 0 ? item.thread_parts : [text];
  
  // CRITICAL: Detect stringified objects in thread_parts (e.g., {'order': 1, 'text': '...'})
  for (const p of parts) {
    if (typeof p === 'string' && /['"]order['"]\s*:\s*\d/.test(p)) {
      return { ok: false, reason: 'stringified-object-in-thread-parts' };
    }
  }
  
  const hasShopeeLink = /s\.shopee\.com\.my\/|shopee\.com\.my\//i.test(parts.join('\n'));

  if (!isAffiliatePost(item) && hasShopeeLink) {
    return { ok: false, reason: 'engagement/value post contains affiliate link' };
  }

  if (!isAffiliatePost(item)) {
    const allText = parts.join(' ');
    const shillCue = /(berbaloi|item yang|check kat bawah|tengok item|beli kat sini|banding produk|soft je|share result|aku repeat|aku rasa berbaloi|ni antara item|test dulu)/i.test(allText);
    if (shillCue) return { ok: false, reason: 'shill-cue-without-affiliate' };
  }

  if (isAffiliatePost(item)) {
    // Single-post affiliate: just needs hook + CTA
    const hasHook = /\?|penat|masalah|kenapa|dulu|ramai|sejak|tipulah|honestly/.test(text.toLowerCase());
    const hasCta = /link|s\.shopee\.com\.my|shopee\.com\.my|beli|try|check/i.test(text.toLowerCase());
    if (!hasHook && !hasCta) {
      return { ok: false, reason: 'affiliate post missing hook or CTA' };
    }
  }

  return { ok: true };
}

function ensureAffiliateChainFormatting(item) {
  if (!isAffiliatePost(item)) {
    // hard fail-safe: engagement posts cannot carry links
    item.text = stripLinks(item.text || '');
    item.thread_parts = Array.isArray(item.thread_parts) ? item.thread_parts.map(p => stripLinks(p || '')) : item.thread_parts;
    return;
  }

  const link = item?.affiliate?.shortLink;
  if (!link) return;

  // Force chain format for affiliate posts
  let parts = Array.isArray(item.thread_parts) && item.thread_parts.length > 0
    ? item.thread_parts.map(x => normalizePartText(stripLinks(String(x || '').trim())))
    : [normalizePartText(stripLinks(String(item.text || '').trim()))];

  parts = parts.filter(Boolean);

  const targetLen = item?.affiliate?.chainLength || randomInt(3, 4);
  if (parts.length < targetLen) {
    const fillers = [
      'i paling suka sebab result dia nampak konsisten bila guna betul-betul.',
      'yang penting bukan trend semata, tapi memang practical untuk routine harian.',
      'i dah compare beberapa option, ni yang paling balance dari segi value + quality.',
      'i share ni sebab ramai tanya benda yang sama kat komen.',
      'lepas beberapa hari, perubahan dia lebih mudah nampak pada routine harian i.',
    ];
    while (parts.length < targetLen) {
      parts.push(fillers[(parts.length - 1) % fillers.length]);
    }
  } else if (parts.length > targetLen) {
    parts = parts.slice(0, targetLen);
  }

  const hook = parts[0] || 'i nak share satu benda yang betul2 membantu i lately 😮‍💨';
  const solution = parts[1] || 'lepas i tukar routine, benda ni paling membantu dari segi praktikal harian.';
  const postLink = formatLinkForPost(link);
  const cta = `kalau awak nak terus tengok produk ni, i beli kat sini ${postLink} sebab ni yang i guna sekarang.`;
  const reassurance = parts[3] || 'kalau awak dah try nanti bagitau i okay ka tak, boleh compare result sama-sama.';

  if (targetLen === 3) {
    parts = [hook, solution, cta];
  } else {
    parts = [hook, solution, cta, reassurance];
  }

  // Keep first part as item.text for compatibility
  item.text = parts[0];
  item.thread_parts = parts;
}

async function publishChain(userId, token, item) {
  ensureAffiliateChainFormatting(item);

  // For affiliate AND value-instructional posts, publish all thread_parts as a chain
  // Single posts (no thread_parts or length 1) just publish the text
  const hasChain = Array.isArray(item.thread_parts) && item.thread_parts.length > 1;
  const parts = hasChain ? item.thread_parts.map(p => extractTextFromPart(p)) : [item.text];

  let parentId = null;
  const postedIds = [];
  const isAffiliate = isAffiliatePost(item);
  // Non-affiliate chains: NO delay (publish all parts immediately)
  // Affiliate chains: 15-45 min delay for engagement
  const delayMin = 1;
  const delayMax = 2;

  for (let i = 0; i < parts.length; i++) {
    const text = String(parts[i] || '').trim();
    if (!text) continue;

    // Pause before follow-up parts in any chain
    if (hasChain && i >= 1) {
      const waitMs = randomInt(delayMin * 60 * 1000, delayMax * 60 * 1000);
      console.log(`${LOG_PREFIX} chain gap hold ${Math.round(waitMs / 60000)}m before part ${i + 1}`);
      await new Promise((r) => setTimeout(r, waitMs));
    }

    const imageUrl = (i === 0 && item.image_url) ? item.image_url : null;
    const postId = await publishText(userId, token, text, parentId, { imageUrl });
    postedIds.push(postId);
    parentId = postId;
    await new Promise((r) => setTimeout(r, 1500));
  }

  return postedIds;
}

async function runOnce() {
  const env = loadEnv();
  const token = env.THREADS_TOKEN;
  const userId = env.THREADS_USER_ID;
  if (!token || !userId) {
    console.error(`${LOG_PREFIX} missing THREADS_TOKEN/THREADS_USER_ID`);
    return;
  }

  const queue = loadQueue();
  const now = new Date();

  const postedTimes = queue
    .filter(x => x.status === 'posted' && x.posted_at)
    .map(x => new Date(x.posted_at).getTime())
    .filter(x => !Number.isNaN(x));
  const lastPostedAt = postedTimes.length ? Math.max(...postedTimes) : null;
  
  const overduePosts = queue.filter(p => p.status === 'pending' && p.scheduled_utc && new Date(p.scheduled_utc) <= now);
  const maxOverdueMin = overduePosts.length > 0 ? Math.max(...overduePosts.map(p => (Date.now() - new Date(p.scheduled_utc)) / 60000)) : 0;
  
  if (lastPostedAt && maxOverdueMin < 120) {
    const minsSinceLast = (Date.now() - lastPostedAt) / 60000;
    if (minsSinceLast < MIN_POST_GAP_MIN) {
      console.log(`${LOG_PREFIX} cooldown active (${minsSinceLast.toFixed(1)}m since last post)`);
      return;
    }
  } else if (maxOverdueMin >= 120) {
    console.log(`${LOG_PREFIX} bypassing cooldown — ${overduePosts.length} posts overdue (max: ${maxOverdueMin.toFixed(0)}m)`);
  }

  let due = queue
    .filter(p => p.status === 'pending' && p.scheduled_utc && new Date(p.scheduled_utc) <= now)
    .sort((a, b) => new Date(a.scheduled_utc) - new Date(b.scheduled_utc));

  if (due.length === 0) {
    console.log(`${LOG_PREFIX} no due posts at ${now.toISOString()}`);
    return;
  }

  for (const item of due) {
    try {
      // Skip items stuck in 'posting' state from crashed/SIGTERM runs (already published)
      if (item.status === 'posting') {
        console.log(`${LOG_PREFIX} ⚠ ${item.id} stuck in 'posting' — already published, skipping`);
        continue;
      }

      const overdueMin = (Date.now() - new Date(item.scheduled_utc).getTime()) / 60000;
      if (overdueMin > MAX_OVERDUE_MIN) {
        postponeByOneDay(item);
        saveQueue(queue);
        console.log(`${LOG_PREFIX} ⏭ postponed stale item ${item.id} (${overdueMin.toFixed(0)}m overdue)`);
        continue;
      }

      if (isAffiliatePost(item) && overdueMin > 60) {
        // Severely overdue posts skip alignment — just publish now
        console.log(`${LOG_PREFIX} ⚡ ${item.id} severely overdue (${overdueMin.toFixed(0)}m), skipping window alignment`);
      } else if (isAffiliatePost(item)) {
        const shifted = alignAffiliateToBestWindow(item, now);
        if (shifted) {
          saveQueue(queue);
          console.log(`${LOG_PREFIX} ⏭ rescheduled ${item.id} to best affiliate window ${item.scheduled_utc}`);
          continue;
        }
      }

      if (isHardShill(item)) {
        const counts = hardShillCounts(queue, new Date());
        if (counts.todayCount >= 1 || counts.weekCount >= 2) {
          postponeByOneDay(item);
          saveQueue(queue);
          console.log(`${LOG_PREFIX} ⏭ postponed ${item.id} (hard-shill cap hit: today=${counts.todayCount}, week=${counts.weekCount})`);
          continue;
        }
      }

      const mixCheck = shouldPostByMix(queue, item);
      if (!mixCheck.ok) {
        postponeByOneDay(item);
        item.preflight_error = mixCheck.reason;
        item.preflight_checked_at = new Date().toISOString();
        saveQueue(queue);
        console.log(`${LOG_PREFIX} ⏭ mix-guard ${item.id}: ${mixCheck.reason}`);
        continue;
      }

      const pf = preflightCheck(item);
      if (!pf.ok) {
        postponeByOneDay(item);
        item.preflight_error = pf.reason;
        item.preflight_checked_at = new Date().toISOString();
        saveQueue(queue);
        console.log(`${LOG_PREFIX} ⏭ preflight-fail ${item.id}: ${pf.reason}`);
        emitAlert(env, { type: 'preflight-fail', id: item.id, reason: pf.reason });
        continue;
      }

      console.log(`${LOG_PREFIX} posting ${item.id} (${item.slot})`);
      // Mark as 'posting' BEFORE API call — prevents duplicate if watchdog SIGTERM during publish
      item.status = 'posting';
      item.preflight_error = null;
      item.preflight_checked_at = new Date().toISOString();
      saveQueue(queue);

      const postedIds = await publishChain(userId, token, item);
      item.status = 'posted';
      item.thread_id = postedIds[0] || null;
      item.thread_chain_ids = postedIds;
      item.posted_at = new Date().toISOString();
      saveQueue(queue);
      console.log(`${LOG_PREFIX} ✅ posted ${item.id}: ${postedIds.join(',')}`);

      // Every 20 posted contents: refresh dashboard + auto topup library
      execFile('node', ['/root/.openclaw/workspace/empire/scripts/performance-topup.js', 'qiesyarue'], () => {});
      break;
    } catch (e) {
      console.error(`${LOG_PREFIX} ❌ failed ${item.id}: ${e.message}`);
      emitAlert(env, { type: 'post-fail', id: item.id, error: e.message });
      break;
    }
  }
}

let lockFd = null;

function isPidAlive(pid) {
  try {
    process.kill(parseInt(pid), 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock() {
  // First try to create lock atomically
  try {
    lockFd = fs.openSync(LOCK_FILE, 'wx');
    fs.writeFileSync(lockFd, String(process.pid));
    return;
  } catch (e) {
    if (e && e.code !== 'EEXIST') throw e;
  }

  // Lock exists — check if owner is still alive
  try {
    const existingPid = fs.readFileSync(LOCK_FILE, 'utf8').trim();
    if (existingPid && isPidAlive(existingPid)) {
      console.error(`${LOG_PREFIX} another instance detected (PID ${existingPid} alive), exiting.`);
      process.exit(0);
    }
    // Stale lock — remove and retry
    console.log(`${LOG_PREFIX} detected stale lock (PID ${existingPid} dead), reclaiming.`);
    fs.unlinkSync(LOCK_FILE);
  } catch {}

  // Retry after stale cleanup
  try {
    lockFd = fs.openSync(LOCK_FILE, 'wx');
    fs.writeFileSync(lockFd, String(process.pid));
  } catch (e) {
    if (e && e.code === 'EEXIST') {
      console.error(`${LOG_PREFIX} lock race detected after reclaim, exiting.`);
      process.exit(0);
    }
    throw e;
  }
}

function releaseLock() {
  try { if (lockFd !== null) fs.closeSync(lockFd); } catch {}
  try { if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE); } catch {}
}

process.on('exit', releaseLock);
process.on('SIGINT', () => { releaseLock(); process.exit(0); });
process.on('SIGTERM', () => { releaseLock(); process.exit(0); });

async function main() {
  acquireLock();
  console.log(`${LOG_PREFIX} started`);
  while (true) {
    try {
      await runOnce();
    } catch (e) {
      console.error(`${LOG_PREFIX} loop error: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 60000));
  }
}

main().catch((e) => {
  console.error(`${LOG_PREFIX} fatal:`, e.message);
  releaseLock();
  process.exit(1);
});
