# CamiTube

A tiny, private YouTube front end that shows only the channels you choose — nothing else from YouTube ever appears. Home shows the most recent uploads across all your channels, mixed together by date, and you can keep clicking **Show older videos** to go back through each channel's full history. There's also a filter row to view one channel at a time.

It's a static site: three files (`index.html`, `style.css`, `app.js`) plus `config.js` for your channel list. No build step, no server.

## 1. Get a free YouTube API key

CamiTube talks directly to YouTube's own API from your browser, using a key only you hold (it's saved in your browser's local storage, never sent anywhere else).

1. Open the [Google Cloud Console](https://console.cloud.google.com/apis/library/youtube.googleapis.com) and create a project (or reuse one).
2. Enable **YouTube Data API v3**.
3. Go to **APIs & Services → Credentials → Create credentials → API key**.
4. Copy the key.

The free daily quota (10,000 units) comfortably covers many page loads for a list of 8 channels — each load costs roughly 1 unit per channel.

Optional but recommended: in the key's settings, restrict it to **YouTube Data API v3** and, if you like, to the `HTTP referrers` matching your GitHub Pages URL, so the key can't be reused elsewhere.

## 2. Edit your channel list

Open `config.js` and edit the `CHANNELS` array — one handle per line:

```js
const CHANNELS = [
  { handle: "@Figma" },
  { handle: "@UICollectiveDesign" },
  // add or remove as you like
];
```

## 3. Host it on GitHub Pages

1. Create a new GitHub repository (e.g. `camitube`).
2. Add these four files to the repo root: `index.html`, `style.css`, `app.js`, `config.js`.
3. In the repo, go to **Settings → Pages**, set **Source** to your default branch (`main`), root folder.
4. Wait a minute, then visit the URL GitHub gives you (something like `https://yourname.github.io/camitube/`).

## 4. First run

The first time you open the site, it'll ask you to paste your API key. After that it's remembered on that browser/device — you'd only need to re-enter it on a new browser or if you clear site data.

## Notes

- Everything runs client-side; there's no backend and no analytics.
- Channel-to-ID lookups are cached in local storage so they aren't re-fetched every visit.
- Videos are pulled from each channel's uploads playlist via the official API, so private/deleted entries are filtered out automatically.
