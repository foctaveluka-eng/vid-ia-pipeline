# 🎬 Vid IA Pipeline PRO — Vidéo avec Audio Intégré

Pipeline GitHub Actions de création et publication de vidéos verticales en français. **Nouveau système PRO v2.0** : chaque scène est générée directement comme un clip vidéo MP4 contenant image + voix française synchronisée, sans étape TTS séparée.

## 🆕 Changement majeur v2.0

**Avant (v1) :**
```
script → images → audio TTS séparé → assemblage clips (image+audio) → final
```

**Maintenant (v2 PRO) :**
```
script → clips vidéo avec audio intégré (prompt unifié visuel + parole) → assemblage final → YouTube
```

- Suppression des étapes `step3` / `step3b` (génération audio séparée)
- Chaque clip est généré avec le prompt : `visuel + "The spoken narration in French must be audible: <audio_texte>"`
- Si l'API vidéo supporte audio, elle renvoie directement un MP4 avec voix. Sinon fallback local : image + TTS assemblés en clip pro avec Ken Burns.
- Assemblage final par concat pro avec crossfade (xfade + acrossfade)

Avantage : si la scène est bien écrite avec les paroles, la vidéo générée possède directement l'audio — plus besoin de TTS externe.

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

## Pipeline PRO

```text
Sélection format (Europe/Paris) → scénario dynamique (16 / 24 / 48 scènes)
  → clips vidéo avec audio intégré par batch (prompt unifié visuel+parole)
  → vérif clips manquants (copie voisin / placeholder)
  → montage final concat pro + crossfade
  → titre / hashtags → YouTube
```

## Lancement manuel

Dans **Actions → Vid IA Pipeline PRO → Run workflow**, choisir `dessin_anime`, `manga`, `actualites`, `horreur` ou `auto`.

En local :

```bash
npm install
PIPELINE_THEME=dessin_anime CARTOON_SEGMENTS=24 npm run step1
npm run step2        # génère clips vidéo avec audio intégré (PRO)
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
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | Publication YouTube |
| `PIPELINE_THEME` | Force `dessin_anime`, `actualites`, `horreur`, `manga` ou `auto` |
| `MANGA_SEGMENTS` | 24–120, défaut 48 |
| `CARTOON_SEGMENTS` | 16–48, défaut 24 |
| `MANGA_SERIES_START_DATE` | Date début série manga (YYYY-MM-DD) |
| `CARTOON_SERIES_START_DATE` | Date début série dessin animé |

Ne committez jamais `.env`.

## Professionnalisation

- **Prompt unifié** : `visual_style + prompt_visuel + "spoken narration French must be audible: audio_texte" + 9:16 + no watermark`
- **Fallback robuste** : si API vidéo down, génère image placeholder + TTS local + Ken Burns (zoompan) avec fade
- **Concat pro** : tente `xfade` + `acrossfade` (0.5s), fallback concat demuxer `-c copy` puis ré-encodage
- **FFmpeg** : système Ubuntu + `@ffmpeg-installer` + `@ffprobe-installer`
- **Compat** : anciens `images_info.json` / `audio_info.json` toujours générés factices pour compatibilité, mais plus utilisés
