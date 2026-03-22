#!/usr/bin/env python3
"""
Migrate djdadoo.rss → Hugo content files in content/mixes/
Each RSS <item> becomes one .md file with YAML frontmatter.
Timecodes found in description are extracted as chapters.
"""

import re
import sys
import unicodedata
from datetime import datetime
from email.utils import parsedate_to_datetime
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {
    "itunes":   "http://www.itunes.com/dtds/podcast-1.0.dtd",
    "podcast":  "https://podcastindex.org/namespace/1.0",
    "atom":     "http://www.w3.org/2005/Atom",
    "content":  "http://purl.org/rss/1.0/modules/content/",
}

SITE_BASE = "https://djdadoo.pilato.fr/"
OUTPUT_DIR = Path(__file__).parent.parent / "content" / "mixes"

# Timecode patterns: 00:00:00 or 00:00 at start of text (inside <li>)
TIMECODE_RE = re.compile(
    r"^\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–]\s*(.+?)\s*$"
)


def slugify(text: str) -> str:
    """Convert text to a URL-safe slug."""
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")


def parse_date(pub_date_str: str) -> datetime:
    """Parse the various (non-standard) pubDate formats used in the feed."""
    if not pub_date_str:
        return None
    # Normalise month names to 3-letter abbreviations so parsedate_to_datetime
    # can handle both "07 July 2012" and "07 Jul 2012"
    long_months = {
        "January": "Jan", "February": "Feb", "March": "Mar",
        "April": "Apr",   "May": "May",      "June": "Jun",
        "July": "Jul",    "August": "Aug",   "September": "Sep",
        "October": "Oct", "November": "Nov", "December": "Dec",
    }
    s = pub_date_str.strip()
    for long, short in long_months.items():
        s = s.replace(long, short)
    try:
        return parsedate_to_datetime(s)
    except Exception:
        # Last-resort: try dateutil if available
        try:
            from dateutil import parser as dp
            return dp.parse(pub_date_str)
        except ImportError:
            raise ValueError(f"Cannot parse date: {pub_date_str!r}")


def cover_path(image_url: str) -> str:
    """Extract the site-relative path from a full image URL."""
    if not image_url:
        return ""
    if image_url.startswith(SITE_BASE):
        return image_url[len(SITE_BASE):]
    return image_url


def extract_chapters(description_html: str):
    """
    Detect timecoded track listings inside HTML description.
    Returns (chapters_list, cleaned_html).
    chapters_list is a list of {"time": "HH:MM:SS", "title": "Artist - Track"}.
    cleaned_html has the timecoded list removed (if fully extracted).
    """
    if not description_html:
        return [], description_html

    # Find all <li> contents
    li_texts = re.findall(r"<li[^>]*>(.*?)</li>", description_html, re.DOTALL)
    if not li_texts:
        return [], description_html

    chapters = []
    for li in li_texts:
        # Strip inner HTML tags
        plain = re.sub(r"<[^>]+>", "", li).strip()
        m = TIMECODE_RE.match(plain)
        if m:
            chapters.append({"time": m.group(1), "title": m.group(2)})

    if not chapters:
        return [], description_html

    # Remove the list block (<ol> or <ul>) that contained the timecodes
    cleaned = re.sub(r"<(?:ol|ul)[^>]*>.*?</(?:ol|ul)>", "", description_html,
                     flags=re.DOTALL).strip()
    # Collapse multiple blank lines / <p></p>
    cleaned = re.sub(r"(<p>\s*</p>)", "", cleaned).strip()

    return chapters, cleaned


def keywords_to_list(keywords_str: str):
    if not keywords_str:
        return []
    return [k.strip() for k in keywords_str.split(",") if k.strip()]


def yaml_str(value: str) -> str:
    """Quote a string for YAML if it contains special characters."""
    if not value:
        return '""'
    # Must quote if contains : # & * ? | > ' " % @ ` or starts with special chars
    needs_quote = any(c in value for c in ':#&*?|>\'"%@`{}[]') or value.startswith(' ')
    if needs_quote:
        escaped = value.replace('"', '\\"')
        return f'"{escaped}"'
    return value


def item_to_markdown(item: ET.Element) -> tuple[str, str]:
    """
    Convert an RSS <item> to (filename, markdown_content).
    """
    def text(tag, ns_key=None):
        if ns_key:
            el = item.find(f"{ns_key}:{tag}", NS)
        else:
            el = item.find(tag)
        return (el.text or "").strip() if el is not None else ""

    title       = text("title")
    season      = text("season", "itunes")
    episode     = text("episode", "itunes")
    subtitle    = text("subtitle", "itunes")
    author      = text("author", "itunes")
    keywords    = text("keywords", "itunes")
    duration    = text("duration", "itunes")
    pub_date    = text("pubDate")
    guid        = text("guid")
    explicit    = text("explicit", "itunes") or "false"

    image_el    = item.find("itunes:image", NS)
    image_url   = (image_el.get("href") or "") if image_el is not None else ""

    enclosure   = item.find("enclosure")
    audio_url    = enclosure.get("url", "") if enclosure is not None else ""
    audio_length = enclosure.get("length", "") if enclosure is not None else ""
    audio_type   = enclosure.get("type", "audio/mpeg") if enclosure is not None else "audio/mpeg"

    # Description (CDATA)
    desc_el = item.find("description")
    description_raw = ""
    if desc_el is not None and desc_el.text:
        description_raw = desc_el.text.strip()

    # Parse date
    dt = None
    if pub_date:
        try:
            dt = parse_date(pub_date)
        except ValueError as e:
            print(f"WARNING: {e}", file=sys.stderr)

    date_str = dt.isoformat() if dt else ""
    date_for_filename = dt.strftime("%Y-%m-%d") if dt else "0000-00-00"

    # Chapters: extract into structured frontmatter but keep full description body for RSS clients
    chapters, _clean_desc = extract_chapters(description_raw)

    # Slug from date + title (strip the "David's Mix #YYYY/MM/DD - " prefix for slug)
    slug_title = re.sub(r"^David's Mix #\d{4}/\d{2}/\d{2}\s*-?\s*", "", title)
    slug_title = slug_title or title
    slug = slugify(f"{date_for_filename}-{slug_title}")
    filename = f"{slug}.md"

    # Cover: site-relative path
    cover = cover_path(image_url)

    # Build YAML frontmatter
    lines = ["---"]
    lines.append(f"title: {yaml_str(title)}")
    if date_str:
        lines.append(f"date: {date_str}")
    if season:
        lines.append(f"season: {season}")
    if episode:
        lines.append(f"episode: {episode}")
    if subtitle:
        lines.append(f"subtitle: {yaml_str(subtitle)}")
    if author:
        lines.append(f"author: {yaml_str(author)}")

    kw_list = keywords_to_list(keywords)
    if kw_list:
        kw_yaml = "[" + ", ".join(f'"{k}"' for k in kw_list) + "]"
        lines.append(f"keywords: {kw_yaml}")

    if audio_url:
        lines.append(f"audio_url: {yaml_str(audio_url)}")
    if audio_length:
        lines.append(f"audio_length: {audio_length}")
    if audio_type:
        lines.append(f"audio_type: {yaml_str(audio_type)}")
    if duration:
        lines.append(f"duration: {yaml_str(duration)}")
    if cover:
        lines.append(f"cover: {yaml_str(cover)}")
    if guid:
        lines.append(f"guid: {yaml_str(guid)}")
    if explicit and explicit.lower() != "false":
        lines.append(f"explicit: true")

    if chapters:
        lines.append("chapters:")
        for ch in chapters:
            lines.append(f'  - time: "{ch["time"]}"')
            lines.append(f'    title: {yaml_str(ch["title"])}')

    lines.append("---")

    # Always use the full original description as body (chapters are also in frontmatter)
    body = description_raw
    content = "\n".join(lines) + "\n"
    if body:
        content += "\n" + body + "\n"

    return filename, content


def main():
    rss_path = Path(__file__).parent.parent / "djdadoo.rss"
    if not rss_path.exists():
        print(f"ERROR: {rss_path} not found", file=sys.stderr)
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    tree = ET.parse(rss_path)
    root = tree.getroot()
    channel = root.find("channel")
    items = channel.findall("item")

    print(f"Found {len(items)} items in RSS feed")

    # Track slugs to handle duplicates
    seen_slugs: dict[str, int] = {}

    for i, item in enumerate(items, 1):
        filename, content = item_to_markdown(item)

        # Deduplicate filenames
        base = filename[:-3]  # strip .md
        if base in seen_slugs:
            seen_slugs[base] += 1
            filename = f"{base}-{seen_slugs[base]}.md"
        else:
            seen_slugs[base] = 0

        out_path = OUTPUT_DIR / filename
        out_path.write_text(content, encoding="utf-8")
        print(f"  [{i:02d}] {filename}")

    print(f"\nDone. {len(items)} files written to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
