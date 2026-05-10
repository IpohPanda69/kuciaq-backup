# 🐱 Kuciaq (@kuciaq) — Backup

**Niche:** Cat/pet owner life content  
**Handle:** @kuciaq (Threads)  
**Backup date:** 2026-05-10

## Status at Backup

- **Queue:** 193 total — 13 posted, 180 pending
- **Last post:** May 6, 2026 (stalled since)
- **Content:** Cat/pet owner life (138 cat posts — old food/recipes replaced)
- **Autopilot:** Script exists (598 lines) but was NOT running

## Files

| File | Description |
|------|-------------|
| `.env.kuciaq` | Threads API credentials |
| `scripts/autopilot-kuciaq.js` | Main auto-poster |
| `scripts/generate-kuciaq-queue.js` | Content queue generator |
| `scripts/manual-post-*.js` | Emergency manual posting |
| `data/queue/kuciaq-warmup.json` | Main content queue (193 items) |
| `data/queue/kuciaq-month2.json` | Month 2 queue backup |
| `data/intelligence/kuciaq-intel.json` | Scraped Threads competitor data |
| `config/kuciaq-affiliate-links.json` | Affiliate links (29 products confirmed) |
| `data/autopilot-kuciaq.log` | Autopilot logs (until May 2) |

## To Restart

```bash
cd /root/.openclaw/workspace/kuciaq-backup
cp .env.kuciaq .env  # rename for autopilot
cd scripts
nohup node autopilot-kuciaq.js >> ../data/autopilot-kuciaq.log 2>&1 &
```

⚠️ **Note:** 180 pending items have past-due schedules. Run reschedule before restarting!