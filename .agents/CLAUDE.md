# CLAUDE.md — djdadoo.net

Site web et flux RSS pour la publication des mixes de DJ Elky (David Pilato) sur Apple Podcasts et le web.

## Architecture du projet

```sh
djdadoo.net/
├── index.html         # Web player (Howler.js + SiriWave)
├── playlist.js        # Tableau JS des mixes (ordre antéchronologique)
├── djdadoo.rss        # Flux RSS podcast (iTunes/Apple Podcasts)
├── djdadoo-new.jpg    # Logo du podcast
├── CNAME              # Domaine : djdadoo.pilato.fr
├── css/styles.css     # Style (dégradé violet → bleu)
├── js/player.js       # Logique du player audio
└── img/               # Artworks des mixes (format: YYYYMMDD-nomevt.jpg)
```

Les fichiers audio (MP3/M4A) sont hébergés sur **Google Cloud Storage** dans le bucket `djdadoo` :
`https://storage.googleapis.com/djdadoo/`

Le site est déployé via **GitHub Pages** sur la branche `gh-pages`.

## Publier un nouveau mix

### 1. Uploader l'audio sur Google Cloud Storage

Uploader le fichier MP3 ou M4A dans le bucket `djdadoo`.

### 2. Ajouter le mix dans `playlist.js`

Insérer une entrée **en tête du tableau** `dadoonetPlayList` :

```js
{
  title: "Nom du mix",
  file: "https://storage.googleapis.com/djdadoo/nom-du-fichier.mp3",
  image: "img/YYYYMMDD-nomevt.jpg"  // optionnel
},
```

### 3. Ajouter l'item dans `djdadoo.rss`

Insérer un nouvel `<item>` **juste après** la balise `<channel>` (ordre antéchronologique).

Structure d'un item :

```xml
<item>
  <itunes:season>YYYY</itunes:season>
  <itunes:episode>N</itunes:episode>
  <title>Nom du mix</title>
  <itunes:subtitle>Funk / House / Groove</itunes:subtitle>
  <description>Description de l'événement ou du mix</description>
  <itunes:image href="https://djdadoo.pilato.fr/img/YYYYMMDD-nomevt.jpg" />
  <enclosure url="https://storage.googleapis.com/djdadoo/nom-du-fichier.mp3"
             length="TAILLE_EN_OCTETS"
             type="audio/mpeg" />
  <pubDate>Sat, 21 Mar 2026 12:00:00 +0200</pubDate>
  <itunes:duration>MM:SS</itunes:duration>
  <guid isPermaLink="false">GUID_UNIQUE</guid>
</item>
```

Points importants :

- Le numéro d'épisode (`itunes:episode`) est incrémental.
- Le `guid` doit être unique — utiliser un UUID v4.
- La `length` est la taille en octets du fichier audio.
- Le type MIME est `audio/mpeg` pour MP3 et `audio/x-m4a` pour M4A.
- La `pubDate` doit être au format RFC 2822.

### 4. Ajouter l'artwork dans `img/`

Nommer le fichier `YYYYMMDD-nomevt.jpg` (ou `.png`).

### 5. Commiter et pousser

```bash
git add playlist.js djdadoo.rss img/YYYYMMDD-nomevt.jpg
git commit -m "Add <Nom du mix>"
git push
```

GitHub Pages déploie automatiquement depuis `gh-pages`.

## Informations du podcast

| Champ        | Valeur                                      |
|--------------|---------------------------------------------|
| Titre        | DJ Elky mixes                               |
| Auteur       | David Pilato (david@pilato.fr)              |
| Site         | https://djdadoo.pilato.fr/                  |
| Description  | Funk, house and DJ groove mixes             |
| Catégorie    | Music                                       |
| Explicit     | false                                       |
| GUID feed    | 5e560267-5f32-55d3-b370-8f66f80ddb8f        |

## Validation RSS

Utiliser [podba.se](https://podba.se/) pour valider le flux RSS avant de pousser.

## Règles importantes

- Toujours maintenir l'ordre **antéchronologique** (le plus récent en premier) dans `playlist.js` et `djdadoo.rss`.
- Ne jamais modifier les fichiers JS/CSS liés au player (`js/player.js`, `css/styles.css`) sauf si explicitement demandé.
- Les fichiers audio ne sont **pas** dans ce dépôt — ils sont sur GCS.
- Ne pas modifier le GUID du feed RSS (`<podcast:guid>`).
