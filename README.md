# DJ Elky Mixes

Personal podcast site for DJ Elky mixes, built with [Hugo](https://gohugo.io/) and the custom `djelky` theme.

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

# Production build
hugo --gc --minify
```

The output lands in `public/`. The site is deployed to GitHub Pages via GitHub Actions on every push to `main`.

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
themes/djelky/
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
   title: "David's Mix #2026/06/21 - Summer Solstice"
   date: 2026-06-21T18:00:00+02:00
   season: 2026
   episode: 68
   audio_url: "https://storage.googleapis.com/djdadoo/2026-06-21-Summer_Solstice.mp3"
   audio_length: 98765432
   duration: "01:08:30"
   subtitle: "Deep house sunset session"
   keywords: ["DJ Elky", "Mix", "House", "Deep House"]
   chapters:
     - time: "00:00:00"
       title: "Artist - Track Name"
     - time: "00:04:12"
       title: "Artist - Another Track"
   ---

   Written description of the mix (Markdown). Shown in the info popup on the site
   and in the podcast episode description.
   ```

4. **Preview** with `hugo server` and verify the episode appears in the grid and the RSS feed (`/djdadoo.rss`).

---

## Frontmatter reference

| Field          | Type            | Required | Default                    | Description |
|----------------|-----------------|----------|----------------------------|-------------|
| `title`        | string          | **yes**  | —                          | Episode title, shown on the card and in the RSS feed |
| `date`         | datetime        | **yes**  | —                          | Publication date (ISO 8601). Controls sort order and RSS `<pubDate>` |
| `season`       | integer         | **yes**  | —                          | Season number (typically the year). Used for grid grouping and `<itunes:season>` |
| `episode`      | integer         | **yes**  | —                          | Episode number. Shown in the info popup and `<itunes:episode>` |
| `audio_url`    | string (URL)    | **yes**  | —                          | Direct URL to the MP3 file. Used by the player and as the RSS `<guid>` when no explicit guid is set |
| `audio_length` | integer (bytes) | **yes**  | —                          | File size in bytes for the RSS `<enclosure>` tag |
| `duration`     | string          | **yes**  | —                          | Playback duration in `HH:MM:SS` format. Displayed on the card and in `<itunes:duration>` |
| `subtitle`     | string          | no       | —                          | Short tagline shown below the title on the card and in `<itunes:subtitle>` |
| `author`       | string          | no       | `params.author` (site)     | Episode author. Falls back to the site-level author |
| `keywords`     | string[]        | no       | —                          | Tags shown in the info popup and in `<itunes:keywords>` |
| `audio_type`   | string (MIME)   | no       | `params.audioType` (site)  | MIME type of the audio file. Site default is `audio/mpeg` |
| `chapters`     | list            | no       | —                          | Tracklist. Each entry has `time` (`HH:MM:SS`) and `title`. Enables chapter navigation in the player |
| `explicit`     | boolean         | no       | `false`                    | Marks the episode as explicit in the RSS feed |

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

---

## RSS feed

The podcast RSS feed is available at `/djdadoo.rss` and is compatible with Apple Podcasts, Spotify, and any standard podcast client.

To validate the feed: [https://podba.se/](https://podba.se/)
