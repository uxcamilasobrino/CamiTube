"""
Fetches the video list for every channel in channels.json using yt-dlp
(no YouTube API key required) and writes the combined result to videos.json.

Run automatically by .github/workflows/update-videos.yml on a schedule.
Can also be run locally: pip install yt-dlp && python scripts/fetch_videos.py
"""

import json
import sys
from datetime import datetime, timedelta, timezone

import yt_dlp

MAX_VIDEOS_PER_CHANNEL = 200

# "private" videos are truly broken links and get dropped entirely.
# Subscriber/membership videos are kept, just tagged, so people know before clicking.
SKIP_AVAILABILITY = {"private"}
MEMBERS_ONLY_AVAILABILITY = {"subscriber_only", "premium_only"}

# The fast channel-page scrape doesn't always carry an accurate membership
# flag. For recent videos (the ones that actually show up in "Latest videos")
# we do one extra, precise check per video. Bounded so it stays fast overall.
RECHECK_WINDOW_DAYS = 14
RECHECK_MAX_PER_CHANNEL = 20


def load_channel_handles():
    with open("channels.json", "r", encoding="utf-8") as f:
        return json.load(f)


def check_members_only(video_id):
    """
    Does a precise, single-video check of membership status. Slower than the
    flat channel scrape (one real request), so this is only used sparingly,
    for recent videos.
    """
    ydl_opts = {"quiet": True, "no_warnings": True, "skip_download": True}
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
        return info.get("availability") in MEMBERS_ONLY_AVAILABILITY
    except Exception as exc:
        print(f"  recheck failed for {video_id}: {exc}", file=sys.stderr)
        return None


def fetch_channel(handle):
    url = f"https://www.youtube.com/{handle}/videos"
    ydl_opts = {
        "extract_flat": "in_playlist",
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "playlistend": MAX_VIDEOS_PER_CHANNEL,
        "extractor_args": {"youtubetab": {"approximate_date": ["1"]}},
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)

    entries = info.get("entries") or []
    channel_id = info.get("channel_id") or info.get("uploader_id") or handle
    channel_title = info.get("channel") or info.get("uploader") or handle.lstrip("@")

    videos = []
    for e in entries:
        if not e or not e.get("id"):
            continue

        if e.get("availability") in SKIP_AVAILABILITY:
            continue

        badge_labels = " ".join(
            (b.get("label") or "") for b in (e.get("badges") or [])
        ).lower()
        members_only = e.get("availability") in MEMBERS_ONLY_AVAILABILITY or "member" in badge_labels

        published = None
        ts = e.get("timestamp")
        if ts:
            published = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        elif e.get("upload_date"):
            published = datetime.strptime(e["upload_date"], "%Y%m%d").strftime("%Y-%m-%dT00:00:00Z")

        videos.append({
            "videoId": e["id"],
            "title": e.get("title") or "(untitled)",
            "channelId": channel_id,
            "channelTitle": channel_title,
            "publishedAt": published,
            "thumb": f"https://i.ytimg.com/vi/{e['id']}/mqdefault.jpg",
            "membersOnly": members_only,
        })

    channel_meta = {"channelId": channel_id, "handle": handle, "title": channel_title}

    # Precisely recheck membership status for recent videos only, so the
    # "Latest videos" tab is accurate without slowing down full-history scraping.
    cutoff = datetime.now(timezone.utc) - timedelta(days=RECHECK_WINDOW_DAYS)
    rechecked = 0
    for v in videos:
        if rechecked >= RECHECK_MAX_PER_CHANNEL:
            break
        if not v["publishedAt"]:
            continue
        published_dt = datetime.strptime(v["publishedAt"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        if published_dt < cutoff:
            continue
        accurate = check_members_only(v["videoId"])
        if accurate is not None:
            v["membersOnly"] = accurate
        rechecked += 1

    return channel_meta, videos


def main():
    handles = load_channel_handles()
    all_channels = []
    all_videos = []
    had_failure = False

    for handle in handles:
        try:
            channel_meta, videos = fetch_channel(handle)
            all_channels.append(channel_meta)
            all_videos.extend(videos)
            print(f"OK  {handle}: {len(videos)} videos")
        except Exception as exc:
            had_failure = True
            print(f"FAIL {handle}: {exc}", file=sys.stderr)

    # Drop anything we couldn't date, then sort newest first
    all_videos = [v for v in all_videos if v["publishedAt"]]
    all_videos.sort(key=lambda v: v["publishedAt"], reverse=True)

    data = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "channels": all_channels,
        "videos": all_videos,
    }

    with open("videos.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    # Fail the Action loudly only if every single channel failed
    if had_failure and not all_channels:
        sys.exit(1)


if __name__ == "__main__":
    main()
