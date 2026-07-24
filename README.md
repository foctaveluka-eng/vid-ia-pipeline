# 🎬 Vid IA Pipeline

Pipeline GitHub Actions de création et publication de vidéos verticales en français. Il produit désormais des **séquences illustrées animées** : chaque plan reçoit un travelling/zoom cinématique (Ken Burns) et des fondus, au lieu d'afficher une image immobile.

## Les 4 formats

| Format | Créneau automatique (Europe/Paris) | Contenu |
|---|---:|---|
| `dessin_anime` | matin, 06h–12h | Dessin animé quotidien pour enfants avec des fruits qui parlent — épisodes continus, secrets, rumeurs, trahisons et manipulations légères résolues positivement |
| `actualites` | midi/après-midi, 12h–18h | Actualités du monde réelles et vérifiables, avec sources et contexte |
| `horreur` | soir, 18h–00h | Moment d'horreur immersif |
| `manga` | nuit, 00h–06h | Manga original long, avec une histoire complète |

### 🍎 Dessin animé — Les Aventures du Verger Magique

Série quotidienne pour enfants (6-12 ans) avec des fruits animés : Pomme la curieuse, Banane le sage, Fraise la téméraire et Orange l'espiègle. Chaque épisode compte **24 scènes par défaut** (configurable de 16 à 48 avec `CARTOON_SEGMENTS`) et suit une structure narrative complète :

1. **Rappel** organique de l'épisode précédent
2. **Situation** du jour avec un petit problème ou mystère
3. **Conflit** léger : malentendu, rumeur, ou petite manipulation
4. **Résolution** positive par la communication et l'amitié
5. **Leçon** de vie simple et positive
6. **Aperçu** de l'aventure du lendemain

Les arcs narratifs couvrent des thèmes comme l'amitié, l'honnêteté, le courage et la communication. Un numéro d'épisode est calculé depuis `CARTOON_SERIES_START_DATE`, tandis qu'une bible de personnages maintient la continuité visuelle.

### 📰 Actualités du monde

Bulletin d'information factuel sur un fait international récent et vérifiable. Chaque segment cite des sources, distingue les faits établis des informations en développement, et termine par le contexte ou les implications.

### 🌙 Manga — Les Veilleurs d'Obsidienne

Série manga publiée à raison d'**un chapitre par jour**. Chaque chapitre compte **48 scènes par défaut** (configurable de 24 à 120 avec `MANGA_SEGMENTS`) et appartient à la série originale *Les Veilleurs d'Obsidienne*. Un numéro d'épisode est calculé depuis `MANGA_SERIES_START_DATE`, tandis qu'une bible de personnages et des arcs narratifs maintiennent la continuité quotidienne. Les prompts demandent des planches noir et blanc sans texte ni bulles et excluent les franchises, personnages et designs existants.

### 👻 Horreur

Histoire d'horreur à la première personne, montée de tension progressive, détails sensoriels.

## Continuité des épisodes

Les formats `dessin_anime` et `manga` utilisent un système de continuité quotidienne :

- **Numérotation automatique** : le numéro d'épisode est calculé à partir de la date de début de la série
- **Bible de personnages** : apparence, vêtements et personnalité cohérents à chaque épisode
- **Arcs narratifs** : progression sur plusieurs épisodes avec objectifs clairs
- **Métadonnées enrichies** : chaque vidéo inclut le numéro d'épisode, l'arc en cours, la date et les thèmes

## Pipeline

```text
Sélection du format → scénario dynamique (16 scènes / 24 dessin animé / 48 manga)
  → illustrations ou planches manga par lots
  → réparation des médias manquants
  → voix française TTS
  → montage vertical animé (travelling + fondus)
  → titre / hashtags → publication YouTube
```

Les quatre exécutions quotidiennes GitHub Actions déclenchent le pipeline. Le script utilise le fuseau `Europe/Paris`, donc l'heure d'été est correctement prise en compte.

## Lancement manuel

Dans **Actions → Vid IA Pipeline → Run workflow**, choisir l'un des formats : `dessin_anime`, `manga`, `actualites` ou `horreur`. Choisir `auto` laisse le script sélectionner le format à partir de l'heure de Paris.

Pour un manga plus long, définir par exemple `manga_segments` à `72`. Pour un dessin animé plus court, définir `cartoon_segments` à `16`.

En local :

```bash
npm install
PIPELINE_THEME=dessin_anime CARTOON_SEGMENTS=24 npm run step1
npm run step2 && npm run step2b
npm run step3 && npm run step3b
npm run step4 && npm run step5
```

## Tests

```bash
# Tests unitaires (configuration, formats, continuité)
node scripts/test_unit.js

# Test d'intégration (pipeline complet, 3 segments)
node scripts/test_pipeline.js
```

Les tests unitaires vérifient :
- Les 4 formats sont correctement définis
- Les anciens formats (`ia`, `reportage`) sont supprimés
- La continuité des épisodes manga et dessin animé
- Le nombre de segments par format
- La sélection automatique du thème
- La cohérence des fichiers JSON de séries

## Configuration

Copier `.env.example` vers `.env` en local, puis renseigner les variables. Dans GitHub, les mêmes valeurs doivent être ajoutées dans **Settings → Secrets and variables → Actions**.

| Secret / variable | Rôle |
|---|---|
| `DELFA_API_URL` | Génération des scripts et titres |
| `IMAGE_API_URL` | Génération des illustrations/planches manga |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | Publication YouTube |
| `PIPELINE_THEME` | Optionnel : force `dessin_anime`, `actualites`, `horreur` ou `manga` |
| `MANGA_SEGMENTS` | Optionnel : 24–120, défaut 48 |
| `CARTOON_SEGMENTS` | Optionnel : 16–48, défaut 24 |
| `MANGA_SERIES_START_DATE` | Optionnel : date de début de la série manga (YYYY-MM-DD) |
| `CARTOON_SERIES_START_DATE` | Optionnel : date de début de la série dessin animé (YYYY-MM-DD) |

Ne commitez jamais un fichier `.env` ni des secrets.
