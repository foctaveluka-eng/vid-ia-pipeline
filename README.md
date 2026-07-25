# 🎬 Vid IA Pipeline PRO — VRAIES Vidéos Animées (img2video)

Pipeline GitHub Actions de création et publication de vidéos verticales en français. **Nouveau système PRO v3.0** : chaque scène est une VRAIE vidéo animée générée via l'API Glam img2video — plus d'images statiques avec simple Ken Burns, mais un vrai mouvement IA !

## 🆕 Changement majeur v3.0 — Glam img2video

**Avant (v2) :**
```
script → images + TTS → assemblage local Ken Burns (zoompan) → final
```
➡️ C'était encore des images statiques avec un simple effet de zoom.

**Maintenant (v3 GLAM PRO) :**
```
script → image source → API Glam img2video → VRAIE vidéo animée → audio TTS → clip final → YouTube
```
➡️ **De vraies vidéos animées** avec mouvement IA, pas des images statiques !

### 🔷 API Glam img2video

Le système utilise l'API **Android Glam** (`community_img2vid` / `chained_falai_img2video`) qui transforme une **image statique** en **vidéo animée réelle** avec :

- Mouvement de caméra AI fluide
- Animation du sujet selon votre prompt
- Durée configurable (3-10 secondes)
- Sortie MP4 prête à monter

**Aucune clé API nécessaire** — le système utilise le mécanisme de récompenses intégré de l'application Glam (génère automatiquement des credits).

### Architecture

```
Pour chaque segment :
  1. Générer l'image source (via IMAGE_API_URL)
  2. Envoyer l'image + prompt à l'API Glam
  3. L'API anime l'image en VRAIE vidéo (mouvement IA)
  4. Générer l'audio TTS français (Google Translate TTS)
  5. Assembler le clip final (vidéo animée + audio)
  └─ Fallback : si Glam échoue → image+audio+Ken Burns local

Assemblage final : concat pro avec crossfade (xfade + acrossfade)
```

## Les 4 formats

| Format | Créneau automatique (Europe/Paris) | Contenu |
|---|---:|---|
| `dessin_anime` | matin, 06h–12h | Dessin animé quotidien pour enfants avec des fruits qui parlent — épisodes continus |
| `actualites` | midi/après-midi, 12h–18h | Actualités du monde réelles et vérifiables |
| `horreur` | soir, 18h–00h | Moment d'horreur immersif |
| `manga` | nuit, 00h–06h | Manga original long, histoire complète |

### 🍎 Dessin animé — Les Aventures du Verger Magique
24 scènes par défaut (configurable 16–48). Structure : rappel → situation → conflit léger → résolution positive → leçon → teaser.

### 📰 Actualités du monde
Bulletin factuel, sources citées, distingue faits établis / incertain.

### 🌙 Manga — Les Veilleurs d'Obsidienne
48 scènes par défaut (configurable 24–120). Un chapitre par jour avec bible visuelle cohérente.

### 👻 Horreur
Première personne, tension progressive.

## Pipeline PRO Glam

```text
Sélection format (Europe/Paris) → scénario dynamique (16 / 24 / 48 scènes)
  → génération image source pour chaque scène
  → [GLAM] animation img→video via API Android Glam (vrai mouvement IA)
  → [fallback] image + TTS + Ken Burns local si API indisponible
  → vérif clips manquants (copie voisin / placeholder)
  → montage final concat pro + crossfade
  → titre / hashtags → YouTube
```

## Lancement manuel

Dans **Actions → Vid IA Pipeline PRO → Run workflow**, choisir `dessin_anime`, `manga`, `actualites`, `horreur` ou `auto`.

### 🚀 Nouveau : Pipeline GLAM (VRAIES vidéos animées)

```bash
npm install
PIPELINE_THEME=dessin_anime CARTOON_SEGMENTS=24 npm run step1
npm run step2:glam   # 🎬 utilise l'API Glam img2video (vrai mouvement IA)
npm run step2b       # vérif clips
npm run step4        # assemblage final
npm run step5
npm run upload-youtube
# ou tout en un (version GLAM) :
npm run pipeline:glam
```

### ⚡ CLI directe — Animer une image tout de suite

```bash
# Depuis une image locale
npm run glam:animate -- mon_image.jpg "le personnage court dans la forêt" 5

# Depuis une URL
npm run glam:animate -- https://exemple.com/photo.png "zoom avant dramatique" 3
```

### 📦 Pipeline standard (fallback local)

```bash
npm install
PIPELINE_THEME=dessin_anime CARTOON_SEGMENTS=24 npm run step1
npm run step2        # génère clips (image+audio+Ken Burns — fallback)
npm run step2b       # vérif clips
npm run step4        # assemblage final
npm run step5
npm run upload-youtube
# ou tout en un :
npm run pipeline
```

## Tests

```bash
# Tests unitaires (config, formats, continuité)
node scripts/test_unit.js

# Test d'intégration PRO (3 clips vidéo+audio)
node scripts/test_pipeline.js
```

## Configuration

Copier `.env.example` → `.env` en local, puis renseigner. Dans GitHub : **Settings → Secrets and variables → Actions**.

| Secret / variable | Rôle |
|---|---|
| `DELFA_API_URL` | Génération scripts et titres |
| `IMAGE_API_URL` | Génération images (fallback) |
| `VIDEO_API_URL` | Génération vidéo avec audio intégré (optionnel, sinon IMAGE_API_URL) |
| `GLAM_ENABLED` | Active le moteur Glam img2video (true/false, défaut: true) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | Publication YouTube |
| `PIPELINE_THEME` | Force `dessin_anime`, `actualites`, `horreur`, `manga` ou `auto` |
| `MANGA_SEGMENTS` | 24–120, défaut 48 |
| `CARTOON_SEGMENTS` | 16–48, défaut 24 |
| `MANGA_SERIES_START_DATE` | Date début série manga (YYYY-MM-DD) |
| `CARTOON_SERIES_START_DATE` | Date début série dessin animé |

Ne committez jamais `.env`.

## Professionnalisation

- **VRAIE vidéo animée** : via l'API Glam img2video (`chained_falai_img2video`), chaque image devient une vidéo avec mouvement IA réel (plus de simple Ken Burns)
- **Moteur Glam** : système de récompenses automatique, upload multipart, polling READY, téléchargement du MP4 final
- **Fallback robuste** : si API Glam ou image down, génère image placeholder + TTS local + Ken Burns (zoompan) avec fade
- **Prompt Glam** : `prompt_visuel + "Narration en français: <audio_texte>"` pour guider l'animation IA
- **TTS français** : Google Translate TTS intégré (voix française naturelle)
- **Concat pro** : tente `xfade` + `acrossfade` (0.5s), fallback concat demuxer `-c copy` puis ré-encodage
- **FFmpeg** : système Ubuntu + `@ffmpeg-installer` + `@ffprobe-installer`
- **Compat** : anciens `images_info.json` / `audio_info.json` toujours générés pour compatibilité
- **Aucune clé API** : le système Glam utilise le mécanisme de récompenses intégré de l'application — génération automatique de crédits
