#!/usr/bin/env python3
"""
Smart Content Generator for Kuciaq — analyzes performance, generates next batch.
Flow: run performance-tracker.js → analyze → generate via DeepSeek → push to queue
"""

import json
import os
import sys
import urllib.request
import time
from datetime import datetime, timedelta

DEEPSEEK_KEY = "sk-c0935974612a4d4fbffa58c91e21018d"
DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"

WORKSPACE = os.path.expanduser("~/.openclaw/workspace")
KUCIAQ_DIR = os.path.join(WORKSPACE, "kuciaq")
EMPIRE_DIR = os.path.join(WORKSPACE, "empire")
QUEUE_FILE = os.path.join(KUCIAQ_DIR, "data", "queue", "kuciaq-warmup.json")
AFFILIATE_FILE = os.path.join(KUCIAQ_DIR, "data", "queue", "kuciaq-affiliate-pending.json")

# Persona-specific — Kuciaq content guidelines
KUCIAQ_CONTENT = """You are creating Threads posts for @kuciaq, a Malaysian cat owner. Each post must be EXACTLY the right voice.

━━━ VOICE (MANDATORY) ━━━
- Mixed BM & English naturally. At LEAST 40% BM words per post.
- Short, messy, conversational. Not polished.
- Funny, relatable, chaotic cat parent energy.
- NO dashes. NO quotes. NO hashtags. NO markdown.
- ONE emoji max at the end only if natural.
- 1-3 short sentences per post max.
- Sounds like a real Malaysian typing on their phone during lunch break.

━━━ WHAT WORKS ━━━
- Cat struggles ("kucing aku bangun aku pukul 4 pagi tadi sebab dia nak makan")
- Funny cat observations ("kenapa kucing tenung dinding 10 minit tak gerak")
- Cat parent confessions ("aku buat bodo je bila kucing aku naik meja dapur")
- Vet/health stories ("aku tak tau kucing boleh kena UTI sebab stress")
- Product mentions slipped in naturally ("beli mainan RM15 kat Shopee, dia obsessed gila")
- Hot takes ("kucing indoor lagi manja dari budak kecik")

━━━ FORBIDDEN (POST WILL BE REJECTED) ━━━
- Pure English posts — MUST have BM mixed in
- AI slop phrases: "it's important to remember", "in conclusion", "ultimately", "at the end of the day", "let's be real", "here's the thing", "the truth is"
- Preachy tone: "you should", "everyone needs to", "we must"
- Sounding like a content creator or brand account
- Generic Google-search pet advice
- Formal or poetic language
- Lists or bullet points
- Overly structured (hook → point → lesson format)

━━━ CONTENT TYPES ━━━
story — "semalam kucing aku buat hal lagi..."
hot-take — "aku rasa kucing oren bukan bodoh, dia假装 je"
funny — "my cat slept 16 hours and still looks tired. i feel her"
lesson — "lepas 2 tahun baru aku tau rupanya..."
ask — "korang punya kucing suka buat macam ni juga ke?"
soft-shill — "aku beli ni kat Shopee sebab..."

━━━ FORMAT ━━━
Just the post text. Nothing else. No labels, no prefixes, no quotes wrapping it.
Write like you're texting a friend about your cat.
If it sounds like AI wrote it, throw it away and rewrite."""

AFFILIATE_CONTENT = """You are creating a SOFT affiliate post for @kuciaq on Threads. This goes to Don Pan for manual review and posting.

RULES:
- 80% valuable content, 20% product mention
- The product mention must feel NATURAL — part of a story, not an ad
- Mention product name casually, like telling a friend
- Include Shopee affiliate link at the very end
- Format: story → product mention → link
- Same voice as regular posts: BM/English mix, casual, relatable

PRODUCTS available (use these affiliate links):
- Cat food/treats: https://shp.ee/kuciaq-food
- Cat toys: https://shp.ee/kuciaq-toys  
- Cat litter/sand: https://shp.ee/kuciaq-litter
- Cat furniture (scratching post, bed): https://shp.ee/kuciaq-furniture
- Cat health (supplements, dewormer): https://shp.ee/kuciaq-health

OUTPUT FORMAT:
[engagement_hook] [story] [natural_product_mention] [link]

Example:
"kucing aku tak nak makan 3 hari. risau gila. vet kata try wet food instead of kibble. lepas tu aku cuba brand ni dari Shopee tiba tiba selera dia balik. link kat bawah kalau nak try"
https://shp.ee/kuciaq-food"""


def load_queue():
    with open(QUEUE_FILE) as f:
        return json.load(f)


def save_queue(queue):
    with open(QUEUE_FILE, 'w') as f:
        json.dump(queue, f, indent=2, ensure_ascii=False)


def load_affiliate_queue():
    if not os.path.exists(AFFILIATE_FILE):
        return []
    with open(AFFILIATE_FILE) as f:
        return json.load(f)


def save_affiliate_queue(items):
    os.makedirs(os.path.dirname(AFFILIATE_FILE), exist_ok=True)
    with open(AFFILIATE_FILE, 'w') as f:
        json.dump(items, f, indent=2, ensure_ascii=False)


def quality_filter(post_text):
    """Reject posts that don't meet quality standards. Returns (ok, reason)."""
    text = post_text.strip()
    
    # Empty or too short
    if len(text) < 20:
        return False, "too short"
    
    # Too long
    if len(text) > 400:
        return False, "too long"
    
    # Has dashes
    if '—' in text or ' - ' in text:
        return False, "has dash"
    
    # Has quotes (quoted speech is ok, but wrapped in quotes is not)
    if text.startswith('"') and text.endswith('"'):
        return False, "wrapped in quotes"
    
    # Has hashtags
    if '#' in text:
        return False, "has hashtag"
    
    # Has markdown
    if '**' in text or '__' in text:
        return False, "has markdown"
    
    # AI slop phrases
    slop = [
        "it's important to remember", "in conclusion", "ultimately",
        "at the end of the day", "let's be real", "here's the thing",
        "the truth is", "remember that", "always remember",
        "one thing i've learned", "what i've learned is",
        "so what does this mean", "the key takeaway",
        "hope this helps", "feel free to", "as a cat owner",
        "it's worth noting", "generally speaking"
    ]
    lower = text.lower()
    for phrase in slop:
        if phrase in lower:
            return False, f"AI slop: {phrase}"
    
    # Pure English check — must have at least some BM
    bm_words = ['aku', 'kau', 'korang', 'tak', 'nak', 'ni', 'tu', 'je', 'dah', 'pun', 'pula',
                'kena', 'tengok', 'macam', 'sebab', 'sama', 'beli', 'mainan', 'makanan',
                'kucing', 'kucing aku', 'dia', 'sangat', 'gila', 'comel', 'manja']
    has_bm = any(w in lower for w in bm_words)
    if not has_bm:
        return False, "pure English, no BM"
    
    # Has labels or prefixes
    bad_prefixes = ['story:', 'hot-take:', 'funny:', 'lesson:', 'ask:', 'soft-shill:', 
                    'post:', 'content:', '[', '1.', '2.', '3.']
    for prefix in bad_prefixes:
        if lower.startswith(prefix):
            return False, f"has label prefix"
    
    return True, "ok"


def call_deepseek(system_prompt, user_prompt, max_tokens=250):
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "max_tokens": max_tokens,
        "temperature": 0.9,
        "stream": False
    }
    req = urllib.request.Request(
        DEEPSEEK_URL,
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {DEEPSEEK_KEY}"
        }
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read())
        return result["choices"][0]["message"]["content"].strip()


def get_learning_state():
    """Track what's working and what's not across generations."""
    state_file = os.path.join(KUCIAQ_DIR, "data", "content-learning.json")
    if os.path.exists(state_file):
        with open(state_file) as f:
            return json.load(f)
    return {
        "type_performance": {},
        "topic_performance": {},
        "generation_history": [],
        "fatigue_tracker": {},
        "wildcards_tried": []
    }


def save_learning_state(state):
    state_file = os.path.join(KUCIAQ_DIR, "data", "content-learning.json")
    os.makedirs(os.path.dirname(state_file), exist_ok=True)
    with open(state_file, 'w') as f:
        json.dump(state, f, indent=2)


def analyze_posted_performance():
    """Analyze which content types got posted recently."""
    queue = load_queue()
    posted = [q for q in queue if q.get("status") == "posted" and q.get("posted_at")]
    if not posted:
        return {}
    type_stats = {}
    for p in posted[-30:]:
        ct = p.get("strategy", {}).get("contentType", "story")
        if ct not in type_stats:
            type_stats[ct] = {"count": 0, "posts": []}
        type_stats[ct]["count"] += 1
        type_stats[ct]["posts"].append({
            "id": p.get("id"),
            "text": p.get("text", "")[:60],
            "posted_at": p.get("posted_at")
        })
    return type_stats


def pick_smart_types(needed):
    """Intelligently pick content types for next batch."""
    state = get_learning_state()
    perf = state.get("type_performance", {})
    fatigue = state.get("fatigue_tracker", {})
    all_types = ["story", "hot-take", "funny", "lesson", "ask", "soft-shill"]
    
    scores = {}
    for t in all_types:
        score = 10
        if t in perf:
            ratio = perf[t].get("wins", 0) / max(perf[t].get("tried", 1), 1)
            score += ratio * 15
            score += min(perf[t].get("tried", 0), 5)
        else:
            score += 8
        score -= fatigue.get(t, 0) * 3
        if perf.get(t, {}).get("tried", 0) < 3:
            score += 5
        scores[t] = max(1, score)
    
    import random
    picked = []
    available = list(all_types)
    for i in range(needed):
        if not available:
            available = list(all_types)
        weights = [scores.get(t, 10) for t in available]
        total = sum(weights)
        r = random.random() * total
        cum = 0
        for j, t in enumerate(available):
            cum += weights[j]
            if r <= cum:
                picked.append(t)
                scores[t] = max(1, scores[t] - 5)
                if len(picked) >= 2 and picked[-1] == picked[-2]:
                    available.remove(t)
                break
    return picked


def update_learning(batch_types):
    """Update learning state after a generation cycle."""
    state = get_learning_state()
    fatigue = state.get("fatigue_tracker", {})
    for t in batch_types:
        fatigue[t] = fatigue.get(t, 0) + 1
    for t in list(fatigue.keys()):
        fatigue[t] = max(0, fatigue[t] - 1)
    type_perf = state.get("type_performance", {})
    for t in set(batch_types):
        if t not in type_perf:
            type_perf[t] = {"tried": 0, "wins": 0}
        type_perf[t]["tried"] += 1
    history = state.get("generation_history", [])
    history.append({"time": datetime.utcnow().isoformat(), "types": batch_types, "count": len(batch_types)})
    if len(history) > 20:
        history = history[-20:]
    state["fatigue_tracker"] = fatigue
    state["type_performance"] = type_perf
    state["generation_history"] = history
    save_learning_state(state)


def generate_content_batch(count, content_types=None, improvise=False):
    """Generate a batch via DeepSeek. If improvise=True, adapt based on what's working."""
    if content_types is None:
        if improvise:
            content_types = pick_smart_types(count)
            print(f"  Smart pick: {content_types}")
        else:
            content_types = ["story", "hot-take", "funny", "lesson", "ask", "soft-shill"]
    
    if improvise and len(set(content_types)) <= 2:
        wildcards = ["wild-experiment", "controversial", "ultra-relatable", "storytime-long"]
        import random
        content_types.append(random.choice(wildcards))
        print(f"  Added wildcard: {content_types[-1]}")

    user_prompt = f"""Generate {count} Threads posts for @kuciaq. Mix these content types: {', '.join(content_types)}.

Each post on a new line, separated by "---". NO numbers, NO labels, just the post text.

Vary the topics: cat behavior, feeding, vet visits, cat products, cat parent life, funny cat moments, cat vs human relationships.

CRITICAL: If previous content types had low traction, DO NOT repeat those patterns. Try new angles, different hooks, different structures.

Make each one feel like a REAL person wrote it — imperfect, conversational, relatable."""
    
    result = call_deepseek(KUCIAQ_CONTENT, user_prompt, max_tokens=count * 120)
    posts = [p.strip() for p in result.split("---") if p.strip()]
    return posts, content_types


def push_to_queue(posts, start_hours_from_now=0):
    """Push generated posts to queue. Filter out bad quality."""
    queue = load_queue()
    existing_ids = {item['id'] for item in queue}
    
    now = datetime.utcnow()
    new_items = []
    rejected = 0
    
    types = ["story", "funny", "hot-take", "lesson", "ask", "soft-shill", "story", "funny"]
    
    for i, post_text in enumerate(posts):
        # Quality filter
        ok, reason = quality_filter(post_text)
        if not ok:
            print(f"  REJECTED [{reason}]: {post_text[:60]}...")
            rejected += 1
            continue
        
        ts = int(time.time() * 1000)
        idx = 0
        while f"kq-gen-{ts + idx}" in existing_ids:
            idx += 1
        pid = f"kq-gen-{ts + idx}"
        existing_ids.add(pid)
        
        day_offset = i // 3
        hour = [8, 13, 21][i % 3]
        schedule = now + timedelta(hours=start_hours_from_now + day_offset * 24 + hour - now.hour)
        
        item = {
            "id": pid,
            "slot": ["morning", "afternoon", "night"][i % 3],
            "text": post_text,
            "pillar": types[i % len(types)],
            "status": "pending",
            "strategy": {"contentType": types[i % len(types)], "generated_by": "tun-perak"},
            "date": now.strftime("%Y-%m-%d"),
            "scheduled_utc": schedule.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "preflight_error": None,
            "preflight_checked_at": now.isoformat()
        }
        new_items.append(item)
        queue.append(item)
    
    if rejected > 0:
        print(f"  Filtered: {rejected} rejected, {len(new_items)} accepted")
    
    save_queue(queue)
    return new_items, rejected


def generate_affiliate(top_post):
    """Generate affiliate/shill versions of top-performing posts. NOT autoposted."""
    post_text = top_post.get("text", "")
    topic = top_post.get("strategy", {}).get("topic", "general")
    
    user_prompt = f"""Based on this high-engagement post:

"{post_text}"

Create ONE soft affiliate version. Remember: 80% content, 20% product. Include the product link naturally at the end.
Use a product from the list that matches the post topic: {topic}"""
    
    result = call_deepseek(AFFILIATE_CONTENT, user_prompt, max_tokens=200)
    
    affiliate_item = {
        "id": f"kq-affiliate-{int(time.time())}",
        "text": result,
        "generated_at": datetime.utcnow().isoformat(),
        "source_post_id": top_post.get("id"),
        "source_engagement": top_post.get("engagement", {}),
        "status": "pending_review",
        "posted": False
    }
    
    # Save to separate affiliate queue for Don Pan review
    affiliates = load_affiliate_queue()
    affiliates.append(affiliate_item)
    save_affiliate_queue(affiliates)
    
    return affiliate_item


def analyze_and_generate(target_pending=30):
    """Main entry: analyze current state, adapt content, fill queue."""
    queue = load_queue()
    posted = [q for q in queue if q.get("status") == "posted"]
    pending = [q for q in queue if q.get("status") != "posted"]
    
    print(f"Queue: {len(posted)} posted, {len(pending)} pending")
    
    needed = max(0, target_pending - len(pending))
    if needed <= 0:
        print(f"No new content needed ({len(pending)} pending >= {target_pending})")
        return []
    
    # Analyze what worked
    perf = analyze_posted_performance()
    if perf:
        print(f"Posted type distribution: {', '.join(k + ':' + str(v.get('count', 0)) for k,v in sorted(perf.items()))}")
    else:
        print("No performance data yet — using smart pick")
    
    print(f"Generating {needed} new posts with adaptive selection...")
    
    # Smart generation with learning
    posts, types_used = generate_content_batch(needed, improvise=True)
    new_items, rejected = push_to_queue(posts)
    
    # Update learning
    update_learning(types_used)
    
    print(f"Generated {len(new_items)} posts, pushed to queue")
    for item in new_items[:5]:
        print(f"  [{item['id']}] {item['text'][:60]}...")
    if len(new_items) > 5:
        print(f"  ... and {len(new_items) - 5} more")
    
    return new_items


def check_for_affiliates(like_threshold=20):
    """Check if any posted content has high engagement — generate affiliate versions."""
    queue = load_queue()
    posted = [q for q in queue if q.get("status") == "posted" and q.get("posted_at")]
    
    # For now, we don't have real-time engagement data
    # This would integrate with performance-tracker.js data
    # Placeholder: check last 20 posted
    
    affiliates = load_affiliate_queue()
    pending_review = [a for a in affiliates if a.get("status") == "pending_review"]
    
    if pending_review:
        print(f"Affiliate posts waiting for review: {len(pending_review)}")
        for a in pending_review:
            print(f"  [{a['id']}] {a['text'][:80]}...")
    
    return pending_review


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: smart-content.py [analyze|generate|affiliate|status]")
        print("  analyze  — auto-fill queue to target pending count")
        print("  generate <count> — generate N new posts and push to queue")
        print("  affiliate — check for high-engagement posts, generate affiliate versions")
        print("  status — show queue and affiliate status")
        sys.exit(1)
    
    cmd = sys.argv[1]
    
    if cmd == "analyze":
        # First purge bad content
        queue = load_queue()
        pending = [q for q in queue if q.get("status") != "posted"]
        bad_count = sum(1 for p in pending if len(p.get("text", "")) < 30 or not p.get("text", "").strip()[-1] in '.!?')
        print(f"Pending: {len(pending)}, Bad quality: {bad_count}")
        
        if bad_count > 10:
            print("Purging bad-quality pending items...")
            # Keep only posted + good pending
            good = [q for q in queue if q.get("status") == "posted" or 
                    (len(q.get("text", "")) >= 30 and q.get("text", "").strip()[-1] in '.!?')]
            save_queue(good)
            print(f"Kept {len(good)} items (posted + good pending)")
        
        analyze_and_generate(target_pending=30)
    
    elif cmd == "generate":
        count = int(sys.argv[2]) if len(sys.argv) > 2 else 20
        posts, _ = generate_content_batch(count)
        new_items, _ = push_to_queue(posts)
        print(f"Pushed {len(new_items)} new posts to queue")
    
    elif cmd == "affiliate":
        pending = check_for_affiliates()
        if not pending:
            print("No affiliate posts pending review")
    
    elif cmd == "status":
        queue = load_queue()
        posted = [q for q in queue if q.get("status") == "posted"]
        pending = [q for q in queue if q.get("status") != "posted"]
        affiliates = load_affiliate_queue()
        print(f"Total queue: {len(queue)}")
        print(f"  Posted: {len(posted)}")
        print(f"  Pending: {len(pending)}")
        print(f"Affiliate queue: {len(affiliates)} pending review")
