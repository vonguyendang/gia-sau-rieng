#!/usr/bin/env python3
"""
scripts/youtube_crawler.py

Thu thập video và bóc tách phụ đề từ YouTube:
- Lấy video qua RSS Feed
- Fallback bóc tách trang /videos và Uploads Playlist UU
- Trích xuất phụ đề tiếng Việt qua youtube-transcript-api
- Fallback trích xuất phụ đề qua yt-dlp với cơ chế vượt rào chống bot (player_client android, player_skip webpage/configs)
"""

import os
import re
import json
import tempfile
import glob
import shutil
from datetime import datetime, timezone
import xml.etree.ElementTree as ET

from utils import safe_requests_get, parse_relative_time, VN_TZ

# Kiểm tra thư viện phụ thuộc
try:
    import feedparser
    HAS_FEEDPARSER = True
except ImportError:
    HAS_FEEDPARSER = False

try:
    from youtube_transcript_api import (
        YouTubeTranscriptApi,
        TranscriptsDisabled,
        NoTranscriptFound,
        VideoUnavailable,
        CouldNotRetrieveTranscript,
    )
    HAS_TRANSCRIPT_API = True
except ImportError:
    HAS_TRANSCRIPT_API = False


def fetch_channel_videos_via_page(channel_id: str, handle: str = "") -> list:
    """
    Fallback bóc tách video trực tiếp từ trang /videos của kênh
    khi RSS feed bị YouTube chặn hoặc 404.
    Hỗ trợ cả lockupViewModel mới và videoRenderer.
    """
    if handle:
        url = f"https://www.youtube.com/{handle}/videos"
    else:
        url = f"https://www.youtube.com/channel/{channel_id}/videos"

    try:
        resp = safe_requests_get(url, timeout=15)
        if not resp or resp.status_code != 200:
            return []

        match = re.search(r"var ytInitialData = ({.*?});</script>", resp.text)
        if not match:
            return []

        data = json.loads(match.group(1))
        extracted = []

        def find_nodes(node):
            if isinstance(node, dict):
                if "lockupViewModel" in node:
                    lvm = node["lockupViewModel"]
                    vid = lvm.get("contentId")
                    meta = lvm.get("metadata", {}).get("lockupMetadataViewModel", {})
                    title = meta.get("title", {}).get("content", "")
                    time_str = ""
                    try:
                        rows = meta.get("metadata", {}).get("contentMetadataViewModel", {}).get("metadataRows", [])
                        for row in rows:
                            parts = row.get("metadataParts", [])
                            if len(parts) >= 2:
                                time_str = parts[1].get("text", {}).get("content", "")
                    except Exception:
                        pass
                    if vid and title:
                        extracted.append({"vid": vid, "title": title, "time_str": time_str})
                elif "videoRenderer" in node:
                    vr = node["videoRenderer"]
                    vid = vr.get("videoId")
                    title = vr.get("title", {}).get("runs", [{}])[0].get("text", "")
                    time_str = vr.get("publishedTimeText", {}).get("simpleText", "")
                    if vid and title:
                        extracted.append({"vid": vid, "title": title, "time_str": time_str})
                for v in node.values():
                    find_nodes(v)
            elif isinstance(node, list):
                for item in node:
                    find_nodes(item)

        find_nodes(data)

        seen = set()
        videos = []
        for item in extracted:
            vid = item["vid"]
            if vid in seen:
                continue
            seen.add(vid)

            pub_dt = parse_relative_time(item["time_str"])
            videos.append({
                "video_id": vid,
                "title": item["title"],
                "link": f"https://www.youtube.com/watch?v={vid}",
                "published_dt": pub_dt,
                "published_at": pub_dt.astimezone(VN_TZ).isoformat(),
            })

        return videos
    except Exception as e:
        print(f"[ERR] Không thể bóc tách trang kênh {channel_id}: {e}")
        return []


def fetch_channel_videos_via_playlist(channel_id: str) -> list:
    """
    Lấy danh sách lên đến 100 video gần nhất từ Uploads Playlist đặc biệt (UU...) của YouTube.
    Thay thế 'UC' bằng 'UU' ở channel_id để lấy toàn bộ danh mục video tải lên của kênh.
    """
    if not channel_id or not channel_id.startswith("UC"):
        return []

    playlist_id = "UU" + channel_id[2:]
    url = f"https://www.youtube.com/playlist?list={playlist_id}"

    try:
        resp = safe_requests_get(url, timeout=15)
        if not resp or resp.status_code != 200:
            return []

        match = re.search(r"var ytInitialData = ({.*?});</script>", resp.text)
        if not match:
            return []

        data = json.loads(match.group(1))
        extracted = []

        def find_lv(node):
            if isinstance(node, dict):
                if "lockupViewModel" in node:
                    lvm = node["lockupViewModel"]
                    vid = lvm.get("contentId")
                    meta = lvm.get("metadata", {}).get("lockupMetadataViewModel", {})
                    title = meta.get("title", {}).get("content", "")
                    if vid and title:
                        extracted.append({"vid": vid, "title": title})
                for v in node.values():
                    find_lv(v)
            elif isinstance(node, list):
                for i in node:
                    find_lv(i)

        find_lv(data)

        seen = set()
        videos = []
        now = datetime.now(timezone.utc)
        for item in extracted:
            vid = item["vid"]
            if vid in seen:
                continue
            seen.add(vid)
            videos.append({
                "video_id": vid,
                "title": item["title"],
                "link": f"https://www.youtube.com/watch?v={vid}",
                "published_dt": now,
                "published_at": now.astimezone(VN_TZ).isoformat(),
            })
        return videos
    except Exception as e:
        print(f"[INFO] Không thể lấy uploads playlist UU cho {channel_id}: {e}")
        return []


def fetch_channel_videos(channel_id: str, handle: str = "") -> list:
    """
    Lấy danh sách video từ RSS feed của YouTube.
    Nếu RSS trả về rỗng hoặc 404, tự động fallback sang bóc tách trang kênh an toàn.
    """
    rss_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"

    videos = []
    try:
        resp = safe_requests_get(rss_url, timeout=12)
        if resp and resp.status_code == 200:
            if HAS_FEEDPARSER:
                feed = feedparser.parse(resp.content)
                for entry in feed.entries:
                    video_id = entry.get("yt_videoid")
                    if not video_id and "link" in entry:
                        match = re.search(r"v=([a-zA-Z0-9_-]+)", entry["link"])
                        if match:
                            video_id = match.group(1)

                    if not video_id:
                        continue

                    published_str = entry.get("published", "")
                    try:
                        pub_dt = datetime.fromisoformat(published_str.replace("Z", "+00:00"))
                    except Exception:
                        pub_dt = datetime.now(timezone.utc)

                    videos.append({
                        "video_id": video_id,
                        "title": entry.get("title", ""),
                        "link": entry.get("link", f"https://www.youtube.com/watch?v={video_id}"),
                        "published_dt": pub_dt,
                        "published_at": pub_dt.astimezone(VN_TZ).isoformat(),
                    })
            else:
                root = ET.fromstring(resp.content)
                atom_ns = {"atom": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}
                for entry in root.findall("atom:entry", atom_ns):
                    vid_el = entry.find("yt:videoId", atom_ns)
                    title_el = entry.find("atom:title", atom_ns)
                    pub_el = entry.find("atom:published", atom_ns)
                    link_el = entry.find("atom:link", atom_ns)

                    video_id = vid_el.text if vid_el is not None else ""
                    title = title_el.text if title_el is not None else ""
                    published_str = pub_el.text if pub_el is not None else ""
                    link = link_el.attrib.get("href", f"https://www.youtube.com/watch?v={video_id}") if link_el is not None else f"https://www.youtube.com/watch?v={video_id}"

                    if not video_id:
                        continue

                    try:
                        pub_dt = datetime.fromisoformat(published_str.replace("Z", "+00:00"))
                    except Exception:
                        pub_dt = datetime.now(timezone.utc)

                    videos.append({
                        "video_id": video_id,
                        "title": title,
                        "link": link,
                        "published_dt": pub_dt,
                        "published_at": pub_dt.astimezone(VN_TZ).isoformat(),
                    })
    except Exception as e:
        print(f"[INFO] RSS feed không khả dụng ({e}), chuyển sang chế độ quét trực tiếp...")

    # Nếu RSS không lấy được video nào, dùng fallback quét trực tiếp từ trang kênh
    if not videos:
        videos = fetch_channel_videos_via_page(channel_id, handle)

    return videos


def fetch_all_channel_videos(channel_id: str, handle: str = "") -> list:
    """
    Lấy tối đa danh sách video của kênh (kết hợp Uploads Playlist UU + RSS + Trang /videos).
    Phục vụ cào lùi lịch sử sâu với hàng chục đến 100 video.
    """
    combined = []
    seen = set()

    # 1. Thử lấy từ Uploads playlist UU (cho tới 100 video)
    pl_videos = fetch_channel_videos_via_playlist(channel_id)
    for v in pl_videos:
        if v["video_id"] not in seen:
            seen.add(v["video_id"])
            combined.append(v)

    # 2. Thử lấy từ RSS để cập nhật ngày đăng chuẩn xác
    rss_videos = fetch_channel_videos(channel_id, handle)
    for v in rss_videos:
        if v["video_id"] not in seen:
            seen.add(v["video_id"])
            combined.append(v)
        else:
            for c in combined:
                if c["video_id"] == v["video_id"]:
                    c["published_dt"] = v["published_dt"]
                    c["published_at"] = v["published_at"]
                    break

    # 3. Quét thêm từ trang kênh nếu còn ít
    if len(combined) < 20:
        page_videos = fetch_channel_videos_via_page(channel_id, handle)
        for v in page_videos:
            if v["video_id"] not in seen:
                seen.add(v["video_id"])
                combined.append(v)

    return combined


def get_transcript_via_ytdlp(video_id: str) -> str:
    """
    Fallback trích xuất phụ đề tiếng Việt bằng yt-dlp khi YouTube chặn IP datacenter/cloud.
    Cấu hình chống bot: android player client + skip webpage/configs.
    """
    tmpdir = tempfile.mkdtemp(prefix="ytdlp_sub_")
    try:
        import yt_dlp
        ydl_opts = {
            "skip_download": True,
            "writesubtitles": True,
            "writeautomaticsub": True,
            "subtitleslangs": ["vi"],
            "extractor_args": {
                "youtube": {
                    "player_client": ["android"],
                    "player_skip": ["webpage", "configs"]
                }
            },
            "quiet": True,
            "no_warnings": True,
            "outtmpl": os.path.join(tmpdir, "%(id)s"),
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([f"https://www.youtube.com/watch?v={video_id}"])

        vtt_files = glob.glob(os.path.join(tmpdir, "*.vtt")) + glob.glob(os.path.join(tmpdir, "*.srv3"))
        if vtt_files:
            with open(vtt_files[0], "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            lines = []
            for line in content.splitlines():
                line = line.strip()
                if not line or line.startswith("WEBVTT") or line.startswith("Kind:") or line.startswith("Language:") or "-->" in line:
                    continue
                cleaned = re.sub(r"<[^>]+>", "", line).strip()
                if cleaned and (not lines or lines[-1] != cleaned):
                    lines.append(cleaned)
            result = " ".join(lines).strip()
            if result:
                print(f"        -> [yt-dlp fallback] Thành công trích xuất {len(result)} ký tự phụ đề!")
                return result

        # Dự phòng bổ sung: Nếu không có file sub, trích xuất phần mô tả video (description)
        try:
            info_opts = {
                "skip_download": True,
                "extractor_args": {
                    "youtube": {
                        "player_client": ["android"],
                        "player_skip": ["webpage", "configs"]
                    }
                },
                "quiet": True,
                "no_warnings": True,
            }
            with yt_dlp.YoutubeDL(info_opts) as ydl:
                info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
                desc = (info.get("description") or "").strip()
                if desc and len(desc) > 30:
                    print(f"        -> [yt-dlp fallback] Trích xuất {len(desc)} ký tự từ mô tả video!")
                    return f"[Nội dung mô tả video]: {desc}"
        except Exception:
            pass
    except Exception as e:
        print(f"        [DEBUG yt-dlp fallback] {type(e).__name__}: {e}")
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
    return ""


def get_video_transcript(video_id: str) -> str:
    """
    Lấy phụ đề tiếng Việt của video bằng youtube-transcript-api.
    Hỗ trợ cả version 1.2+ mới nhất (api.fetch), class methods cũ,
    và fallback sang yt-dlp khi YouTube chặn dải IP cloud datacenter.
    """
    if HAS_TRANSCRIPT_API:
        # Cách 1: Thử api.fetch (youtube-transcript-api >= 1.2.0)
        try:
            api = YouTubeTranscriptApi()
            fetched = api.fetch(video_id, languages=["vi"])
            if hasattr(fetched, "snippets"):
                return " ".join([s.text for s in fetched.snippets if getattr(s, "text", "")]).strip()
        except Exception:
            pass

        # Cách 2: Thử list / find_transcript trên instance api
        try:
            api = YouTubeTranscriptApi()
            t_list = api.list(video_id)
            transcript = None
            try:
                transcript = t_list.find_transcript(["vi"])
            except Exception:
                try:
                    transcript = t_list.find_generated_transcript(["vi"])
                except Exception:
                    pass
            if transcript:
                fetched = transcript.fetch()
                if hasattr(fetched, "snippets"):
                    return " ".join([s.text for s in fetched.snippets if getattr(s, "text", "")]).strip()
                elif isinstance(fetched, list):
                    return " ".join([item.get("text", "") for item in fetched]).strip()
        except Exception:
            pass

        # Cách 3: Thử class methods (version cũ < 1.0)
        try:
            if hasattr(YouTubeTranscriptApi, "list_transcripts"):
                t_list = YouTubeTranscriptApi.list_transcripts(video_id)
                transcript = t_list.find_transcript(["vi"])
                data = transcript.fetch()
                return " ".join([item.get("text", "") for item in data]).strip()
            elif hasattr(YouTubeTranscriptApi, "get_transcript"):
                data = YouTubeTranscriptApi.get_transcript(video_id, languages=["vi"])
                return " ".join([item.get("text", "") for item in data]).strip()
        except Exception:
            pass

    # Cách 4 (Vũ khí dự phòng mạnh nhất): yt-dlp vượt rào chặn IP datacenter
    return get_transcript_via_ytdlp(video_id)
