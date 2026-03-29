# DJ Elky Mixes

Personal podcast site for DJ Elky mixes, built with [Hugo](https://gohugo.io/) and the custom `podcast4deejays` theme.

Live at: <https://djdadoo.pilato.fr/>

---

## Prerequisites

- [Hugo Extended](https://gohugo.io/installation/) v0.157.0 or later

```bash
brew install hugo        # macOS
```

---

## Build & preview

```bash
# Local development server (live reload)
hugo server

# Local development server with auto-rebuilt search index
./scripts/dev-site.sh

# One-command local production build (Hugo + Pagefind)
./scripts/build-site.sh

# Equivalent manual steps
hugo --gc --minify
npx --yes pagefind --site public
```

The output lands in `public/`. The site is deployed to GitHub Pages via GitHub Actions on every push to `main`.

`./scripts/dev-site.sh` performs an initial full build, starts `hugo server`, and rebuilds the Pagefind index whenever content, data, static assets, theme files, or `hugo.toml` change. It uses port `1313` by default and automatically falls back to the next free port if needed.

---

## Project structure

```sh
content/
  mixes/
    YYYY/
      YYYY-MM-DD-slug/
        index.md          # episode frontmatter + body
        cover.jpg         # optional episode artwork
static/
  djdadoo-new.jpg         # default podcast cover
  img/                    # favicons, site manifest
themes/podcast4deejays/
  layouts/
    index.html            # home page (grid + player)
    index.rss.rss         # iTunes/podcast RSS feed
    partials/head.html
  static/
    css/style.css
    js/player.js
    js/howler.min.js
hugo.toml                 # site configuration
```

---

## Configuration

Essential site-level config in `hugo.toml`:

```toml
title = "DJ Elky Mixes"                    # Site title (fallback for RSS feed <title>)
baseURL = "https://djdadoo.pilato.fr/"
languageCode = "en-us"

[params.podcast]
name = "DJ Elky"                           # Podcast/author name (displayed in header)
title = "DJ Elky Mixes"                    # Optional: RSS feed channel <title> (defaults to Site.title)
filename = "djdadoo.rss"                   # RSS feed filename
subtitle = "Deep House & Techno"           # Short description
description = "..."                        # Long description for RSS
author = "DJ Elky"                         # Episode author fallback
email = "contact@example.com"              # iTunes owner email
cover = "/djdadoo-new.jpg"                 # Default podcast cover (episode fallback)
keywords = ["DJ Elky", "Mix"]              # Global keywords merged with episode keywords
trackTitle = "David's Mix"                 # Prefix for auto-generated RSS titles
baseAudioURL = "https://storage.googleapis.com/djdadoo/"
audioType = "audio/mpeg"
podcastLink = "https://podcasts.apple.com/..."
podcastGUID = "..."                        # Unique podcast ID
```

---

## Adding a new episode

1. **Create the page bundle** under `content/mixes/YYYY/`:

   ```bash
   mkdir -p content/mixes/2026/2026-06-21-summer-solstice
   ```

2. **Add a cover image** (optional) — name it `cover.jpg` (or `cover.png`) inside the bundle:

   ```bash
   cp /path/to/artwork.jpg content/mixes/2026/2026-06-21-summer-solstice/cover.jpg
   ```

3. **Create `index.md`** with the required frontmatter (see table below):

   ```yaml
   ---
   title: "Summer Solstice"
   date: 2026-06-21T18:00:00+02:00
   season: 2026
   episode: 68
   audio_length: 98765432
   duration: "01:08:30"
   subtitle: "David's Mix #2026/06/21"
   youtube: "uHfwLjwCIGw"
   keywords: ["House", "Deep House"]
   chapters:
     - time: "00:00:00"
       title: "Artist - Track Name"
     - time: "00:04:12"
       title: "Artist - Another Track"
   ---

   Written description of the mix (Markdown). Shown in the info popup on the site
   and in the podcast episode description.
   ```

   The audio URL is **auto-derived** from the page bundle path: `{baseAudioURL}mixes/2026/2026-06-21-summer-solstice.mp3`.
   Set `audio_url` explicitly only if the GCS file has not yet been renamed to match the bundle structure.

4. **Preview** with `hugo server` and verify the episode appears in the grid and the RSS feed (`/djdadoo.rss`).

---

## Frontmatter reference

| Field          | Type            | Required | Default                    | Description |
|----------------|-----------------|----------|----------------------------|-------------|
| `title`            | string          | **yes**  | —                          | Event name shown on the card (e.g. `"Touraine Tech 2025"`). Used as the suffix in the auto-generated RSS `<title>` |
| `date`             | datetime        | **yes**  | —                          | Publication date (ISO 8601). Controls sort order, RSS `<pubDate>`, and the `#YYYY/MM/DD` part of the RSS title |
| `season`           | integer         | **yes**  | —                          | Season number (typically the year). Used for grid grouping and `<itunes:season>` |
| `episode`          | integer         | **yes**  | —                          | Episode number. Shown in the info popup and `<itunes:episode>` |
| `audio_length`     | integer (bytes) | **yes**  | —                          | File size in bytes for the RSS `<enclosure>` tag |
| `duration`         | string          | **yes**  | —                          | Playback duration in `HH:MM:SS` format. Displayed on the card and in `<itunes:duration>` |
| `subtitle`         | string          | no       | —                          | Mix reference shown below the title on the card (e.g. `"David's Mix #2025/02/06"`). Sent to `<itunes:subtitle>` |
| `youtube`          | string          | no       | —                          | YouTube video ID or URL (`youtu.be/...`, `youtube.com/watch?v=...`). Shows a YouTube icon on the episode card and embeds a video player on the episode page |
| `audio_url`        | string (URL)    | no       | auto-derived from bundle path | Full GCS URL of the MP3. Set only when the GCS file does not follow the standard path `mixes/YYYY/slug.mp3`. Used by the player and as the RSS `<guid>` |
| `itunes_title`     | string          | no       | —                          | When set, overrides the auto-generated RSS `<title>` entirely. Useful for one-off episode titles that don't follow the standard pattern |
| `itunes_subtitle`  | string          | no       | —                          | Overrides `subtitle` for `<itunes:subtitle>` and the RSS title suffix. Rarely needed |
| `author`           | string          | no       | `params.podcast.author`    | Episode author. Falls back to the site-level author |
| `keywords`         | string[]        | no       | —                          | Extra tags merged with the site-level keywords (`["DJ Elky", "Mix"]`) for `<itunes:keywords>`. No need to repeat the global ones |
| `audio_type`       | string (MIME)   | no       | `params.podcast.audioType` | MIME type of the audio file. Site default is `audio/mpeg` |
| `chapters`         | list            | no       | —                          | Tracklist. Each entry has `time` (`HH:MM:SS`) and `title`. Enables chapter navigation in the player |
| `explicit`         | boolean         | no       | `false`                    | Marks the episode as explicit in the RSS feed |

### RSS title generation

The RSS `<title>` is built automatically from the episode date and title fields:

```txt
{params.podcast.trackTitle} #{YYYY/MM/DD}[ - {itunes_subtitle ?? title}]
```

Examples:

- date `2025-02-06`, title `Touraine Tech 2025` → `David's Mix #2025/02/06 - Touraine Tech 2025`
- date `2012-01-22`, no title → `David's Mix #2012/01/22`

Set `itunes_title` in the frontmatter to bypass this logic and use a fully custom title.

### Audio URL derivation

The audio URL is auto-derived from the page bundle path:

```txt
{params.podcast.baseAudioURL} + path.Dir(File.Path) + ".mp3"
# → https://storage.googleapis.com/djdadoo/mixes/2026/2026-06-21-summer-solstice.mp3
```

Set `audio_url` explicitly (full URL) only for episodes whose GCS file hasn't been renamed to the standard `mixes/YYYY/slug.mp3` structure yet. Run `rename-gcs-buckets.sh` to migrate and auto-remove `audio_url` from frontmatter.

### Cover image

Place a `cover.jpg` or `cover.png` file inside the episode bundle directory. If absent, the site-wide default cover (`/djdadoo-new.jpg`) is used.

### Chapters format

```yaml
chapters:
  - time: "00:00:00"
    title: "Artist - Track Title"
  - time: "00:04:32"
    title: "Artist - Another Track"
```

Times must be in `HH:MM:SS` format. The player highlights the current chapter in real time and allows seeking directly to any chapter.

### YouTube format

The `youtube` field accepts either:

- a raw video ID, e.g. `uHfwLjwCIGw`
- a full URL, e.g. `https://www.youtube.com/watch?v=uHfwLjwCIGw`
- a short URL, e.g. `https://youtu.be/uHfwLjwCIGw`

---

## RSS feed

The podcast RSS feed is available at `/djdadoo.rss` and is compatible with Apple Podcasts, Spotify, and any standard podcast client.

To validate the feed: [https://podba.se/](https://podba.se/)
