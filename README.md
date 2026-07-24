# 🎬 Vid IA Pipeline

Pipeline GitHub Actions de création et publication de vidéos verticales en français. Il produit désormais des **séquences illustrées animées** : chaque plan reçoit un travelling/zoom cinématique (Ken Burns) et des fondus, au lieu d'afficher une image immobile.

## Les 4 formats

| Format | Créneau automatique (Europe/Paris) | Contenu |
|---|---:|---|
| `ia` | matin, 06h–11h | Histoire IA animée, racontée comme un thriller technologique |
| `reportage` | midi/après-midi, 12h–17h | Vrai mini-reportage sur un fait récent et vérifiable |
| `horreur` | soir, 18h–23h | Moment d'horreur immersif |
| `manga` | nuit, 00h–05h | Manga original long, avec une histoire complète |

Le manga est publié à raison d'**un chapitre par jour**. Chaque chapitre compte **48 scènes par défaut** (configurable de 24 à 120 avec `MANGA_SEGMENTS`) et appartient à la série originale *Les Veilleurs d'Obsidienne*. Un numéro d'épisode est calculé depuis `MANGA_SERIES_START_DATE`, tandis qu'une bible de personnages et des arcs narratifs maintiennent la continuité quotidienne. Les prompts demandent des planches noir et blanc sans texte ni bulles et excluent les franchises, personnages et designs existants : le projet ne reprend pas JJK, Solo Leveling ou leurs images.

## Pipeline

```text
Sélection du format → scénario dynamique (16 scènes / 48 manga)
  → illustrations ou planches manga par lots
  → réparation des médias manquants
  → voix française TTS
  → montage vertical animé (travelling + fondus)
  → titre / hashtags → publication YouTube
```

Les quatre exécutions quotidiennes GitHub Actions déclenchent le pipeline. Le script utilise le fuseau `Europe/Paris`, donc l'heure d'été est correctement prise en compte.

## Lancement manuel

Dans **Actions → Vid IA Pipeline → Run workflow**, choisir l'un des formats : `ia`, `reportage`, `horreur` ou `manga`. Choisir `auto` laisse le script sélectionner le format à partir de l'heure de Paris.

Pour un manga plus long, définir par exemple `manga_segments` à `72`. Les limites acceptées sont 24 à 120.

En local :

```bash
npm install
PIPELINE_THEME=manga MANGA_SEGMENTS=48 npm run step1
npm run step2 && npm run step2b
npm run step3 && npm run step3b
npm run step4 && npm run step5
```

## Configuration

Copier `.env.example` vers `.env` en local, puis renseigner les variables. Dans GitHub, les mêmes valeurs doivent être ajoutées dans **Settings → Secrets and variables → Actions**.

| Secret / variable | Rôle |
|---|---|
| `DELFA_API_URL` | Génération des scripts et titres |
| `IMAGE_API_URL` | Génération des illustrations/planches manga |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | Publication YouTube |
| `PIPELINE_THEME` | Optionnel : force `ia`, `reportage`, `horreur` ou `manga` |
| `MANGA_SEGMENTS` | Optionnel : 24–120, défaut 48 |

Ne commitez jamais un fichier `.env` ni des secrets.
