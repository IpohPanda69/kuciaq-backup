#!/usr/bin/env node
// Post one affiliate shill for Kuciaq tonight - PETSEE Booster Gemuk Kucing
const https = require('https');

const USER_ID = '27649238778009793';
const TOKEN = 'THAAVL4V9RgGFBYllNYXc5Q3ZA2dWRkOVRJUkdmRGExYUNLYm9LdEJIMjdrM2M0dEhSMUNCVWU2em9rdmFIRWZAPVDZAlZAkdJaURMLWJzdDhVdkhIVnlwaW5sclRHVFVKMzlEUGVBRWIyYk94RlZApbllQbndVQWs3UklfZAnNfYi1yclBOYUpmMWMwMVphNzUtR1EZD';

const posts = [
  'kucing korang kurus tak nak gemuk walaupun dah bagi makan banyak kali sehari. maybe masalah dia bukan kuantiti tapi nutrisi. kucing kurus bukan comel. kucing kurus maybe ada deficiency. aku pernah alami masalah sama dengan kucing aku',
  'then aku try PETSEE Booster Gemuk Kucing ni. freeze dried chicken breast. high protein natural. bukan filler bukan chemical. kucing aku makan gila sebab rasa ayam real. after 2 minggu berat badan naik gila. bulu pun lebih lebat dan berkilat',
  'link https://s.shopee.com.my/4VZBXUcJWh. kucing gemuk si lagi cantik. tapi jangan bagi overdose. follow dosage on pack. consistency is key. bukan magic. proper nutrition'
];

function createText(text, replyToMediaId) {
  return new Promise((resolve, reject) => {
    const body = { text, media_type: 'TEXT', access_token: TOKEN };
    if (replyToMediaId) body.reply_to_id = replyToMediaId;
    const req = https.request({
      hostname: 'graph.threads.net',
      path: '/v1.0/' + USER_ID + '/threads',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(parsed.error.message));
          else resolve(parsed);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

function publishPost(creationId) {
  return new Promise((resolve, reject) => {
    const body = { creation_id: creationId, access_token: TOKEN };
    const req = https.request({
      hostname: 'graph.threads.net',
      path: '/v1.0/' + USER_ID + '/threads_publish',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(parsed.error.message));
          else resolve(parsed);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  // Part 1: Create & Publish
  console.log('Creating part 1 (hook)...');
  const c1 = await createText(posts[0]);
  console.log('Part 1 container:', c1.id);
  
  console.log('Waiting 31s for processing...');
  await new Promise(r => setTimeout(r, 31000));
  
  console.log('Publishing part 1...');
  const p1 = await publishPost(c1.id);
  const mediaId1 = p1.id;
  console.log('Part 1 published! Media ID:', mediaId1);
  
  // Part 2: Create as reply to published part 1, then publish
  console.log('Creating part 2 (solution)...');
  const c2 = await createText(posts[1], mediaId1);
  console.log('Part 2 container:', c2.id);
  
  console.log('Waiting 31s for processing...');
  await new Promise(r => setTimeout(r, 31000));
  
  console.log('Publishing part 2...');
  const p2 = await publishPost(c2.id);
  const mediaId2 = p2.id;
  console.log('Part 2 published! Media ID:', mediaId2);
  
  // Part 3: Create as reply to published part 2, then publish
  console.log('Creating part 3 (link)...');
  const c3 = await createText(posts[2], mediaId2);
  console.log('Part 3 container:', c3.id);
  
  console.log('Waiting 31s for processing...');
  await new Promise(r => setTimeout(r, 31000));
  
  console.log('Publishing part 3...');
  const p3 = await publishPost(c3.id);
  const mediaId3 = p3.id;
  console.log('Part 3 published! Media ID:', mediaId3);
  
  console.log('\n✅ 3-part chain posted successfully!');
  console.log('Thread root:', mediaId1);
}

run().catch(e => console.error('Error:', e.message || e));
