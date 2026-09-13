// CamiTube — app logic
// Uses the YouTube Data API v3 with a key the visitor supplies and stores
// only in their own browser (localStorage). No server, no backend.

const LS_KEY = "camitube_api_key";
const LS_CHANNELS = "camitube_channel_cache_v1";

const SWATCHES = ["#c1121f", "#3a5a40", "#1d3557", "#e07a5f", "#6a4c93", "#2a9d8f", "#bc6c25", "#457b9d"];

let apiKey = localStorage.getItem(LS_KEY) || "";
let channels = [];          // [{ handle, channelId, uploadsId, title, thumb, color, nextPageToken, exhausted }]
let pool = [];              // combined fetched videos across all channels, sorted desc by publishedAt
let activeFilter = "all";   // "all" or a channelId
let shown = 0;              // how many of the current filtered list are rendered

const $ = (sel) => document.querySelector(sel);
const grid = $("#grid");
const statusEl = $("#status");
const loadMoreBtn = $("#loadMoreBtn");
const filterRow = $("#filterRow");

// ---------- Setup modal ----------

const modalOverlay = $("#modalOverlay");
const apiKeyInput = $("#apiKeyInput");

function openModal() {
  apiKeyInput.value = apiKey;
  modalOverlay.hidden = false;
  apiKeyInput.focus();
}
function closeModal() { modalOverlay.hidden = true; }

$("#keyBtn").addEventListener("click", openModal);
$("#cancelKeyBtn").addEventListener("click", () => {
  if (apiKey) closeModal();
});
$("#saveKeyBtn").addEventListener("click", () => {
  const val = apiKeyInput.value.trim();
  if (!val) return;
  apiKey = val;
  localStorage.setItem(LS_KEY, apiKey);
  closeModal();
  boot();
});

// ---------- Status helper ----------

function setStatus(text, isError) {
  if (!text) { statusEl.hidden = true; return; }
  statusEl.hidden = false;
  statusEl.textContent = text;
  statusEl.classList.toggle("error", !!isError);
}

// ---------- YouTube API ----------

async function ytFetch(path, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set("key", apiKey);
  const res = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok) {
    const message = data?.error?.message || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

async function resolveChannel(handle) {
  const cleanHandle = handle.startsWith("@") ? handle : `@${handle}`;
  const data = await ytFetch("channels", {
    part: "snippet,contentDetails",
    forHandle: cleanHandle,
  });
  const item = data.items && data.items[0];
  if (!item) throw new Error(`Channel not found: ${cleanHandle}`);
  return {
    handle: cleanHandle,
    channelId: item.id,
    uploadsId: item.contentDetails.relatedPlaylists.uploads,
    title: item.snippet.title,
    thumb: item.snippet.thumbnails?.default?.url || "",
  };
}

async function resolveAllChannels() {
  const cached = JSON.parse(localStorage.getItem(LS_CHANNELS) || "null");
  const cachedByHandle = {};
  if (cached) cached.forEach((c) => (cachedByHandle[c.handle.toLowerCase()] = c));

  const results = [];
  for (const { handle } of CHANNELS) {
    const clean = (handle.startsWith("@") ? handle : `@${handle}`).toLowerCase();
    if (cachedByHandle[clean]) {
      results.push(cachedByHandle[clean]);
      continue;
    }
    const resolved = await resolveChannel(handle);
    results.push(resolved);
  }
  localStorage.setItem(LS_CHANNELS, JSON.stringify(results));
  return results;
}

async function fetchUploadsPage(channel) {
  if (channel.exhausted) return [];
  const params = {
    part: "snippet,contentDetails",
    maxResults: "50",
    playlistId: channel.uploadsId,
  };
  if (channel.nextPageToken) params.pageToken = channel.nextPageToken;

  const data = await ytFetch("playlistItems", params);
  channel.nextPageToken = data.nextPageToken || null;
  if (!channel.nextPageToken) channel.exhausted = true;

  return (data.items || [])
    .filter((it) => it.snippet && it.snippet.resourceId?.kind === "youtube#video" && it.snippet.title !== "Private video" && it.snippet.title !== "Deleted video")
    .map((it) => ({
      videoId: it.contentDetails.videoId,
      title: it.snippet.title,
      publishedAt: it.contentDetails.videoPublishedAt || it.snippet.publishedAt,
      thumb: it.snippet.thumbnails?.medium?.url || it.snippet.thumbnails?.default?.url || "",
      channelId: channel.channelId,
      channelTitle: channel.title,
    }));
}

// ---------- Rendering ----------

function colorFor(channelId) {
  const idx = channels.findIndex((c) => c.channelId === channelId);
  return SWATCHES[idx % SWATCHES.length];
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function currentList() {
  if (activeFilter === "all") return pool;
  return pool.filter((v) => v.channelId === activeFilter);
}

function renderFilters() {
  filterRow.innerHTML = "";
  const allPill = document.createElement("button");
  allPill.className = "pill" + (activeFilter === "all" ? " active" : "");
  allPill.textContent = "All channels";
  allPill.addEventListener("click", () => setFilter("all"));
  filterRow.appendChild(allPill);

  channels.forEach((c) => {
    const pill = document.createElement("button");
    pill.className = "pill" + (activeFilter === c.channelId ? " active" : "");
    pill.textContent = c.title;
    pill.addEventListener("click", () => setFilter(c.channelId));
    filterRow.appendChild(pill);
  });
}

function setFilter(channelId) {
  activeFilter = channelId;
  shown = 0;
  renderFilters();
  renderGrid(true);
}

function renderGrid(reset) {
  const list = currentList();
  if (reset) grid.innerHTML = "";

  if (list.length === 0) {
    setStatus("No videos yet for this channel.");
    loadMoreBtn.hidden = true;
    return;
  }
  setStatus("");

  const nextShown = Math.min(shown + PAGE_SIZE, list.length);
  const slice = list.slice(shown, nextShown);
  slice.forEach((video) => grid.appendChild(renderCard(video)));
  shown = nextShown;

  const canFetchMore = activeFilter === "all"
    ? channels.some((c) => !c.exhausted)
    : channels.some((c) => c.channelId === activeFilter && !c.exhausted);

  loadMoreBtn.hidden = !(shown < list.length || canFetchMore);
}

function renderCard(video) {
  const card = document.createElement("button");
  card.className = "card";
  card.type = "button";

  const thumbWrap = document.createElement("div");
  thumbWrap.className = "thumb-wrap";
  const img = document.createElement("img");
  img.src = video.thumb;
  img.alt = "";
  img.loading = "lazy";
  thumbWrap.appendChild(img);

  const title = document.createElement("div");
  title.className = "card-title";
  title.textContent = video.title;

  const meta = document.createElement("div");
  meta.className = "card-meta";
  const swatch = document.createElement("span");
  swatch.className = "channel-swatch";
  swatch.style.background = colorFor(video.channelId);
  const channelName = document.createElement("span");
  channelName.textContent = video.channelTitle;
  const date = document.createElement("span");
  date.textContent = formatDate(video.publishedAt);

  meta.appendChild(swatch);
  meta.appendChild(channelName);
  meta.appendChild(date);

  card.appendChild(thumbWrap);
  card.appendChild(title);
  card.appendChild(meta);

  card.addEventListener("click", () => openPlayer(video));
  return card;
}

// ---------- Player ----------

const playerOverlay = $("#playerOverlay");
const playerFrame = $("#playerFrame");
const playerTitle = $("#playerTitle");
const playerSub = $("#playerSub");

function openPlayer(video) {
  playerFrame.innerHTML = `<iframe src="https://www.youtube.com/embed/${video.videoId}?autoplay=1" title="${escapeHtml(video.title)}" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  playerTitle.textContent = video.title;
  playerSub.textContent = `${video.channelTitle} · ${formatDate(video.publishedAt)}`;
  playerOverlay.hidden = false;
}

function closePlayer() {
  playerOverlay.hidden = true;
  playerFrame.innerHTML = "";
}

$("#closePlayerBtn").addEventListener("click", closePlayer);
playerOverlay.addEventListener("click", (e) => {
  if (e.target === playerOverlay) closePlayer();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !playerOverlay.hidden) closePlayer();
});

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

// ---------- Load more ----------

loadMoreBtn.addEventListener("click", async () => {
  const list = currentList();
  if (shown < list.length) {
    renderGrid(false);
    return;
  }
  loadMoreBtn.disabled = true;
  loadMoreBtn.textContent = "Loading…";
  try {
    const targets = activeFilter === "all"
      ? channels.filter((c) => !c.exhausted)
      : channels.filter((c) => c.channelId === activeFilter && !c.exhausted);

    const batches = await Promise.all(targets.map((c) => fetchUploadsPage(c)));
    batches.flat().forEach((v) => pool.push(v));
    pool.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    renderGrid(false);
  } catch (err) {
    setStatus(`Couldn't load more videos: ${err.message}`, true);
  } finally {
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = "Show older videos";
  }
});

// ---------- Boot ----------

async function boot() {
  if (!apiKey) {
    setStatus("");
    openModal();
    return;
  }
  modalOverlay.hidden = true;
  grid.innerHTML = "";
  loadMoreBtn.hidden = true;
  setStatus("Loading channels…");

  try {
    channels = await resolveAllChannels();
    renderFilters();

    setStatus("Loading videos…");
    const batches = await Promise.all(channels.map((c) => fetchUploadsPage(c)));
    pool = batches.flat().sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    shown = 0;
    renderGrid(true);
  } catch (err) {
    setStatus(`Something went wrong: ${err.message}. Check your API key and that the YouTube Data API v3 is enabled.`, true);
  }
}

boot();
