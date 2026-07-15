# 🎬 Vid IA Pipeline — GitHub Actions

Workflow d'automatisation de génération vidéo IA — s'exécute **gratuitement toutes les 8 heures** sur GitHub Actions.

## 📋 Architecture du Pipeline

```
Heure → Thème (IA / Monde / Horreur)
  ↓
[Étape 1] Génération du script 16 segments (Delfa API)
  ↓
[Étape 2] Génération des 16 images (par packs de 5)
  ↓
[Étape 2b] Vérification & correction des images manquantes
  ↓
[Étape 3] Génération des 16 audios TTS (Google Translate)
  ↓
[Étape 3b] Vérification & correction des audios manquants
  ↓
[Étape 4] Assemblage de la vidéo finale (FFmpeg)
  ↓
[Étape 5] Génération du titre et du nom de fichier
  ↓
[Étape 6] Upload sur Google Drive
  ↓
[Étape 7] Publication sur YouTube
```

## ⚙️ Configuration des Secrets GitHub

Dans votre dépôt GitHub : **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Valeur |
|---|---|
| `GOOGLE_CLIENT_ID` | `773039062438-fti1unik531h7qj41kas7l7p5k76fdpj.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `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` |
| `GOOGLE_REFRESH_TOKEN` | `1//04V49EAzx0D8NCgYIARAAGAQSNwF-L9IrVDGA0QXjjRCDJCRlienCDPDXykHcHtN0dHjeyGUakyBhVOjBIcnIa1ARpLnFE_fHKHM` |
| `DRIVE_FOLDER_ID` | `1qQMktB0Ti_BkuSrSQoRyr9ohHZ4X8mYg` |
| `DELFA_API_URL` | `https://delfaapiai.vercel.app/ai/copilot` |
| `IMAGE_API_URL` | `https://gem-tw6a.onrender.com/generate` |

## 🚀 Déploiement sur GitHub

```bash
# 1. Initialiser le dépôt Git
git init
git add .
git commit -m "🚀 Initial commit — Vid IA Pipeline"

# 2. Créer un nouveau dépôt sur GitHub (github.com/new)
# 3. Lier et pousser
git remote add origin https://github.com/VOTRE_USERNAME/vid-ia-pipeline.git
git branch -M main
git push -u origin main
```

## ⏰ Déclenchement

Le workflow se lance automatiquement :
- **04h00** (Paris) → Thème **IA** 🤖
- **12h00** (Paris) → Thème **Monde** 🌍
- **20h00** (Paris) → Thème **Horreur** 👻

Ou **manuellement** depuis GitHub → Actions → Vid IA Pipeline → Run workflow.
