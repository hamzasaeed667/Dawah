# Dawah Social Media Automation

Automated multi-platform Islamic knowledge distribution system supporting daily images and video reflections (Pages 1 to 1446) with automatic start/end loop rollover.

---

## 🚀 Overview

- **Images Pipeline**: Sequentially publishes book pages 1 to 1446 across Facebook, Instagram, Twitter/X, Pinterest, LinkedIn, Telegram, Threads, Reddit, and TikTok.
- **Videos Pipeline**: Sequentially streams book video reflections 1 to 1446 across Facebook Video, Dailymotion, and TikTok.
- **Auto-Looping**: Automatically resets back to Page 1 upon reaching Page 1446.
- **Token Maintenance**: Daily automatic token refresh cron for OAuth credentials.

---

## 🛠️ Production Ecosystem & Deployment

### Option 1: PM2 Daemon (Self-Hosted / VPS)

Manage the continuous background process with PM2 using the configured `ecosystem.config.js`:

```bash
# Start in production mode
npm run pm2:start

# View status & logs
npm run pm2:status
npm run pm2:logs

# Restart / Reload / Stop
npm run pm2:restart
npm run pm2:reload
npm run pm2:stop
```

### Option 2: Serverless GitHub Actions Runner

The `.github/workflows/social_media_cron.yml` workflow automatically runs daily:
- Triggers at `00:17 UTC` daily.
- Runs token maintenance, image upload, and video upload tasks.
- Commits updated `state.json` and `videoState.json` back to the repository.
- Supports manual execution anytime via `workflow_dispatch` in the GitHub Actions tab.

---

## 🧪 Testing & Validation

```bash
# Run unit test suite
npm test

# Run manual single image upload
node -e "require('./cron/uploadPage')()"

# Run manual single video upload
node -e "require('./cron/uploadVideo')()"
```
