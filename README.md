# CamiTube

A private, minimal YouTube front end that shows only the channels you choose. Home mixes recent uploads from every channel by date, and **Show older videos** keeps paging back through full history. A filter row lets you jump to a single channel.

**No YouTube API key needed.** Instead, a GitHub Action runs [yt-dlp](https://github.com/yt-dlp/yt-dlp) on a schedule, writes the results to `videos.json`, and the site (pure HTML/CSS/JS) just reads that file. Nothing runs in your browser except reading a JSON file and embedding YouTube's normal player.

## Files

- `index.html`, `style.css`, `app.js` — the site itself
- `channels.json` — the list of channels to include (edit this to add/remove one)
- `videos.json` — generated automatically; don't edit by hand
- `scripts/fetch_videos.py` — the scraper, run by the workflow below
- `.github/workflows/update-videos.yml` — schedules the refresh

## 1. Upload everything to your repo

Keep the folder structure as-is — `scripts/` and `.github/workflows/` need to stay in those exact locations for the Action to be found.

## 2. Allow the Action to commit back to your repo

This is the one manual step:

1. In your repo, go to **Settings → Actions → General**.
2. Scroll to **Workflow permissions**.
3. Select **Read and write permissions**.
4. Click **Save**.

Without this, the workflow can fetch videos but can't save `videos.json` back to the repo.

## 3. Turn on GitHub Pages

**Settings → Pages** → Source: **Deploy from a branch** → Branch: `main`, folder `/ (root)` → Save.

## 4. Run it for the first time

Pushing your files should already trigger the workflow once automatically. To check or trigger it manually:

1. Go to the **Actions** tab in your repo.
2. Click **Update video list** in the left sidebar.
3. Click **Run workflow** (top right) if it hasn't run yet, or to force a refresh.
4. It takes a minute or two. When it's done, `videos.json` in your repo will have real content.

After that it refreshes on its own every 6 hours — no visits or clicks needed from you. Change the schedule by editing the `cron` line in `.github/workflows/update-videos.yml` if you'd like it more or less often.

## Changing the channel list

Edit `channels.json` (one handle per line, e.g. `"@Figma"`). Pushing that change also triggers an immediate refresh.

## A known limitation

YouTube occasionally blocks scraping from cloud-hosted IPs, including GitHub's own runners. If a run fails for one or more channels, it's usually temporary and clears up on the next scheduled run. You can check what happened under the **Actions** tab → the failed run → its logs. If this becomes a persistent problem for you, the original YouTube Data API key approach (no scraping, official and much more reliable) is the fallback — just ask and I can switch it back.
