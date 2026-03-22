#!/usr/bin/env python3
"""
Migrate djdadoo.rss → Hugo Page Bundle content files in content/mixes/
Each RSS <item> becomes one directory SLUG/ with:
  - index.md (YAML frontmatter + clean intro body)
  - cover.jpg (copied from static/img/ if available)

Chapters extracted from timecoded descriptions go into frontmatter.
The RSS template generates the tracklist from frontmatter chapters.
"""

import re
import shutil
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
REPO_ROOT  = Path(__file__).parent.parent
OUTPUT_DIR = REPO_ROOT / "content" / "mixes"
STATIC_DIR = REPO_ROOT / "static"

# Timecode at start of <li> text: "HH:MM:SS - ..." or "MM:SS - ..."
TIMECODE_RE = re.compile(
    r"^\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–]\s*(.+?)\s*$"
)


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")


def parse_date(pub_date_str: str) -> datetime:
    if not pub_date_str:
        return None
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
        try:
            from dateutil import parser as dp
            return dp.parse(pub_date_str)
        except ImportError:
            raise ValueError(f"Cannot parse date: {pub_date_str!r}")


def cover_img_path(image_url: str) -> str:
    """Return site-relative path (e.g. 'img/foo.jpg') from full or relative URL."""
    if not image_url:
        return ""
    if image_url.startswith(SITE_BASE):
        return image_url[len(SITE_BASE):]
    return image_url


def extract_chapters(description_html: str):
    """
    Find timecoded <li> items and return (chapters_list, clean_body).
    clean_body has the <ol>/<ul> block removed; chapters_list is structured data.
    If no timecodes found, returns ([], original_html).
    """
    if not description_html:
        return [], description_html

    li_texts = re.findall(r"<li[^>]*>(.*?)</li>", description_html, re.DOTALL)
    if not li_texts:
        return [], description_html

    chapters = []
    for li in li_texts:
        plain = re.sub(r"<[^>]+>", "", li).strip()
        m = TIMECODE_RE.match(plain)
        if m:
            chapters.append({"time": m.group(1), "title": m.group(2)})

    if not chapters:
        return [], description_html

    # Remove the <ol>/<ul> block from the description
    cleaned = re.sub(
        r"<(?:ol|ul)[^>]*>.*?</(?:ol|ul)>", "", description_html, flags=re.DOTALL
    ).strip()
    cleaned = re.sub(r"(<p>\s*</p>)", "", cleaned).strip()
    return chapters, cleaned


def keywords_to_list(keywords_str: str):
    if not keywords_str:
        return []
    return [k.strip() for k in keywords_str.split(",") if k.strip()]


def yaml_str(value: str) -> str:
    if not value:
        return '""'
    needs_quote = any(c in value for c in ':#&*?|>\'"%@`{}[]') or value.startswith(' ')
    if needs_quote:
        escaped = value.replace('"', '\\"')
        return f'"{escaped}"'
    return value


def item_to_bundle(item: ET.Element) -> dict:
    """Return a dict with: slug, markdown_content, source_image (Path|None)."""

    def text(tag, ns_key=None):
        if ns_key:
            el = item.find(f"{ns_key}:{tag}", NS)
        else:
            el = item.find(tag)
        return (el.text or "").strip() if el is not None else ""

    title        = text("title")
    season       = text("season", "itunes")
    episode      = text("episode", "itunes")
    subtitle     = text("subtitle", "itunes")
    author       = text("author", "itunes")
    keywords     = text("keywords", "itunes")
    duration     = text("duration", "itunes")
    pub_date     = text("pubDate")
    guid         = text("guid")

    image_el     = item.find("itunes:image", NS)
    image_url    = (image_el.get("href") or "") if image_el is not None else ""

    enclosure    = item.find("enclosure")
    audio_url    = enclosure.get("url", "")    if enclosure is not None else ""
    audio_length = enclosure.get("length", "") if enclosure is not None else ""
    audio_type   = enclosure.get("type", "audio/mpeg") if enclosure is not None else "audio/mpeg"

    desc_el = item.find("description")
    description_raw = (desc_el.text or "").strip() if desc_el is not None else ""

    # Parse date
    dt = None
    if pub_date:
        try:
            dt = parse_date(pub_date)
        except ValueError as e:
            print(f"WARNING: {e}", file=sys.stderr)

    date_str           = dt.isoformat() if dt else ""
    date_for_filename  = dt.strftime("%Y-%m-%d") if dt else "0000-00-00"

    # Extract chapters; keep only the clean intro in the body
    chapters, clean_body = extract_chapters(description_raw)

    # Slug
    slug_title = re.sub(r"^David's Mix #\d{4}/\d{2}/\d{2}\s*-?\s*", "", title)
    slug_title = slug_title or title
    slug = slugify(f"{date_for_filename}-{slug_title}")

    # Cover image source path (in static/)
    cover_rel = cover_img_path(image_url)  # e.g. "img/20260321-les3graces.jpg"
    source_image = None
    if cover_rel:
        candidate = STATIC_DIR / cover_rel
        if candidate.exists():
            source_image = candidate

    # Build YAML frontmatter (no 'cover' field — image is a Page Resource)
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
    if guid:
        lines.append(f"guid: {yaml_str(guid)}")

    if chapters:
        lines.append("chapters:")
        for ch in chapters:
            lines.append(f'  - time: "{ch["time"]}"')
            lines.append(f'    title: {yaml_str(ch["title"])}')

    lines.append("---")

    body = clean_body if chapters else description_raw
    content = "\n".join(lines) + "\n"
    if body:
        content += "\n" + body + "\n"

    return {"slug": slug, "content": content, "source_image": source_image}


def main():
    rss_path = REPO_ROOT / "djdadoo.rss"
    if not rss_path.exists():
        print(f"ERROR: {rss_path} not found", file=sys.stderr)
        sys.exit(1)

    # Clean previous output
    if OUTPUT_DIR.exists():
        for child in OUTPUT_DIR.iterdir():
            if child.is_dir():
                shutil.rmtree(child)
            elif child.name != "_index.md":
                child.unlink()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    tree = ET.parse(rss_path)
    root = tree.getroot()
    channel = root.find("channel")
    items = channel.findall("item")

    print(f"Found {len(items)} items in RSS feed")

    seen_slugs: dict[str, int] = {}

    for i, item in enumerate(items, 1):
        result = item_to_bundle(item)
        slug   = result["slug"]

        # Deduplicate
        if slug in seen_slugs:
            seen_slugs[slug] += 1
            slug = f"{slug}-{seen_slugs[slug]}"
        else:
            seen_slugs[slug] = 0

        # Create bundle directory
        bundle_dir = OUTPUT_DIR / slug
        bundle_dir.mkdir(parents=True, exist_ok=True)

        # Write index.md
        (bundle_dir / "index.md").write_text(result["content"], encoding="utf-8")

        # Copy cover image
        source_img = result["source_image"]
        if source_img:
            dest = bundle_dir / f"cover{source_img.suffix}"
            shutil.copy2(source_img, dest)
            print(f"  [{i:02d}] {slug}/ (cover: {source_img.name})")
        else:
            print(f"  [{i:02d}] {slug}/ (no cover)")

    print(f"\nDone. {len(items)} bundles written to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
