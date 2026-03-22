# CLAUDE.md — djdadoo.net

Site web et flux RSS pour la publication des mixes de DJ Elky (David Pilato) sur Apple Podcasts et le web.
Construit avec **Hugo** + thème custom **djelky**.

## Architecture du projet

```
djdadoo.net/           (branche: main — source Hugo)
├── hugo.toml          # Config Hugo (RSS format, markup, params)
├── content/
│   └── mixes/         # Un fichier .md par mix
│       └── YYYY-MM-DD-slug.md
├── themes/djelky/
│   ├── layouts/
│   │   ├── index.html          # Page d'accueil SPA (grille + player)
│   │   ├── index.rss.rss       # Template RSS podcast iTunes
│   │   ├── _default/baseof.html
│   │   ├── _default/single.html
│   │   └── partials/head.html
│   └── static/
│       ├── css/style.css       # Thème sombre dégradé violet→bleu
│       └── js/player.js        # Player Howler.js + chapitres
├── static/
│   ├── img/           # Artworks des mixes (format: YYYYMMDD-nomevt.jpg)
│   ├── djdadoo-new.jpg
│   └── CNAME          # djdadoo.pilato.fr
├── scripts/
│   └── migrate_rss.py # Script de migration RSS → Hugo .md (usage unique)
└── .github/
    └── workflows/
        └── gh-pages.yml  # Build Hugo → déploiement GitHub Pages
```

**Déploiement** : push sur `main` → GitHub Actions build Hugo → déploie dans `gh-pages`

Les fichiers audio (MP3/M4A) sont hébergés sur **Google Cloud Storage** :
`https://storage.googleapis.com/djdadoo/`

## Publier un nouveau mix

### 1. Uploader l'audio sur Google Cloud Storage

Uploader le fichier MP3 ou M4A dans le bucket `djdadoo`.

### 2. Créer le fichier contenu Hugo

Créer `content/mixes/YYYY-MM-DD-slug.md` :

```yaml
---
title: "David's Mix #2026/04/15 - Nom du mix"
date: 2026-04-15T20:00:00+02:00
season: 2026
episode: 68                       # Incrémenter depuis le dernier épisode
subtitle: "Description courte"
author: "David Pilato"            # Changer si co-DJ
keywords: ["DJ Elky", "Mix", "Live", "House"]
audio_url: "https://storage.googleapis.com/djdadoo/nom-du-fichier.mp3"
audio_length: 123456789           # Taille en octets
audio_type: "audio/mpeg"          # ou "audio/x-m4a"
duration: "01:23:45"              # Format HH:MM:SS ou MM:SS
cover: "img/YYYYMMDD-nomevt.jpg"  # Chemin relatif depuis static/
guid: "https://storage.googleapis.com/djdadoo/nom-du-fichier.mp3"
chapters:                         # Optionnel — si tracklist avec timecodes
  - time: "00:00:00"
    title: "Artist - Track Name"
  - time: "00:03:30"
    title: "Artist - Track Name"
---
<p>Description HTML du mix.</p>
```

> **Note** : Le `guid` est l'URL GCS pour les mixes existants (rétrocompatibilité). Pour les nouveaux mixes, utiliser un UUID v4 unique.

### 3. Ajouter l'artwork dans `static/img/`

Nommer le fichier `YYYYMMDD-nomevt.jpg` (ou `.png`).

### 4. Commiter et pousser (par l'utilisateur)

```bash
git add content/mixes/YYYY-MM-DD-slug.md static/img/YYYYMMDD-nomevt.jpg
git commit -m "Add <Nom du mix>"
git push
```

GitHub Actions déploie automatiquement depuis `main` vers `gh-pages`.

## Informations du podcast

| Champ        | Valeur                                           |
|--------------|--------------------------------------------------|
| Titre        | DJ Elky mixes                                    |
| Auteur       | David Pilato (david@pilato.fr)                   |
| Site         | https://djdadoo.pilato.fr/                       |
| RSS          | https://djdadoo.pilato.fr/djdadoo.rss            |
| Description  | Funk, house and DJ groove mixes                  |
| Catégorie    | Music                                            |
| Explicit     | false                                            |
| GUID feed    | 5e560267-5f32-55d3-b370-8f66f80ddb8f             |
| iTunes       | Configurer dans hugo.toml > params.itunesLink    |

## Validation RSS

Utiliser [podba.se](https://podba.se/?url=https://djdadoo.pilato.fr/djdadoo.rss) pour valider le flux RSS après chaque déploiement.

## Test local

```bash
hugo server        # Site disponible sur http://localhost:1313
hugo --gc --minify # Build de production dans ./public
```

## Règles importantes

- Toujours incrémenter `episode` depuis le dernier fichier dans `content/mixes/`
- Le `guid` d'un item existant **ne doit jamais changer** (rétrocompatibilité podcast)
- `audio_type` = `"audio/mpeg"` pour MP3, `"audio/x-m4a"` pour M4A
- Les fichiers audio ne sont **pas** dans ce dépôt — ils sont sur GCS
- Ne **jamais** modifier le GUID du feed RSS (`podcastGUID` dans hugo.toml)
- Ne **jamais** pusher sur `main` à la place de l'utilisateur
