#!/bin/bash
#====================================================================
#  🚀 RUN PIPELINE v3 — Orchestrateur complet
#  Usage : bash scripts/run_pipeline.sh [mode] [theme]
#
#  Modes :
#    full     → Pipeline complet avec YouTube (défaut)
#    test     → Mode test (3 segments, pas de YouTube)
#    glam     → Pipeline avec GLAM img2video
#
#  Thèmes (optionnel) :
#    auto, dessin_anime, manga, actualites, horreur
#
#  Exemples :
#    bash scripts/run_pipeline.sh test dessin_anime
#    bash scripts/run_pipeline.sh full auto
#====================================================================

set -e

# ── Couleurs ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# ── Configuration ──
MODE="${1:-full}"
THEME="${2:-auto}"
START_TIME=$(date +%s)

# ── Fonctions ──
log()   { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"; }
warn()  { echo -e "${YELLOW}[⚠️ ]${NC} $1"; }
error() { echo -e "${RED}[❌]${NC} $1"; }
header() {
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
  echo -e "${PURPLE}  $1${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
}

check_step() {
  if [ $? -ne 0 ]; then
    error "Étape échouée !"
    exit 1
  fi
}

# ── Démarrage ──
clear 2>/dev/null || true
echo ""
echo -e "${WHITE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${WHITE}║${NC}  ${RED}🔥🔥🔥  PIPELINE VIDÉO VIRAL v3  🔥🔥🔥${NC}            ${WHITE}║${NC}"
echo -e "${WHITE}║${NC}  ${CYAN}Script → Images → Vidéos → Montage → YouTube${NC}     ${WHITE}║${NC}"
echo -e "${WHITE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
log "Mode: ${BLUE}$MODE${NC} | Thème: ${BLUE}$THEME${NC}"
log "Début: $(date)"

# ── Vérifications ──
header "🔍 VÉRIFICATIONS"
if ! command -v ffmpeg &> /dev/null; then
  warn "FFmpeg non trouvé dans PATH, utilisation du package npm..."
  if [ -f "node_modules/@ffmpeg-installer/linux-x64/ffmpeg" ]; then
    ln -sf "$(pwd)/node_modules/@ffmpeg-installer/linux-x64/ffmpeg" /usr/local/bin/ffmpeg 2>/dev/null || true
    ln -sf "$(pwd)/node_modules/@ffprobe-installer/linux-x64/ffprobe" /usr/local/bin/ffprobe 2>/dev/null || true
    log "✅ FFmpeg lié depuis node_modules"
  fi
fi

if [ ! -d "node_modules" ]; then
  log "📦 Installation des dépendances..."
  npm install --silent 2>&1 | tail -1
fi

log "✅ FFmpeg: $(ffmpeg -version 2>&1 | head -1)"
log "✅ Node: $(node -v)"
log "✅ NPM: $(npm -v)"

# ── Nettoyage ──
if [ "$MODE" = "test" ]; then
  header "🧹 NETTOYAGE (mode test)"
  rm -rf tmp_data
  log "✅ Dossier tmp_data nettoyé"
fi

export PIPELINE_THEME="$THEME"

# ── ÉTAPE 1 : Script Viral ──
header "📝 ÉTAPE 1 — GÉNÉRATION DU SCRIPT VIRAL"
if [ "$MODE" = "test" ]; then
  # Mode test : génération minimale
  log "🧪 Mode test : génération de 3 segments"
  node -e "
    const fs = require('fs');
    const { THEMES } = require('./scripts/pipeline_config');
    const themeId = '${THEME}' !== 'auto' && '${THEME}' !== '' ? '${THEME}' : 'actualites';
    const theme = THEMES[themeId];
    fs.mkdirSync('./tmp_data', { recursive: true });
    fs.writeFileSync('./tmp_data/script_data.json', JSON.stringify({
      theme: themeId,
      theme_label: theme.label,
      visual_mode: theme.visualMode,
      visual_style: theme.visualStyle,
      segment_count: 3,
      viral_score: 85,
      script: [
        {id:1, audio_texte:'Tu crois tout savoir ? Voici le chiffre que 99% des gens ignorent.', prompt_visuel:'wide shot cinematic, dramatic lighting, no text, no watermark'},
        {id:2, audio_texte:'Mais soudain une révélation choquante change tout ce qu on croyait.', prompt_visuel:'close-up reveal, shocked expression, tense atmosphere, no text'},
        {id:3, audio_texte:'Et toi qu en penses dis en commentaire abonne toi pour la suite !', prompt_visuel:'final shot looking at camera, cliffhanger, no text'},
      ],
      generated_at: new Date().toISOString(),
    }, null, 2));
    console.log('✅ Script test généré (3 segments, thème: ' + themeId + ')');
  "
else
  # Mode full : utilisation du générateur v3
  log "🎯 Lancement du générateur viral v3..."
  node scripts/step1_generate_script_v3.js 2>&1 || {
    warn "Étape 1 v3 échouée, fallback v1..."
    node scripts/step1_generate_script.js 2>&1 || {
      error "Impossible de générer le script"
      exit 1
    }
  }
fi
check_step
log "✅ Script généré avec succès"

# ── ÉTAPE 2 : Génération des clips vidéo ──
header "🎬 ÉTAPE 2 — GÉNÉRATION DES CLIPS VIDÉO"
if [ "$MODE" = "glam" ]; then
  log "🔷 Mode GLAM img2video (vrai mouvement IA)..."
  node scripts/step2_generate_videos_glam.js 2>&1 || {
    warn "GLAM échoué, fallback standard..."
    node scripts/step2_generate_videos.js 2>&1 || {
      error "Impossible de générer les clips"
      exit 1
    }
  }
else
  log "⬜ Mode standard (image+audio+Ken Burns)..."
  node scripts/step2_generate_videos.js 2>&1 || {
    warn "Méthode standard échouée, tentative GLAM..."
    node scripts/step2_generate_videos_glam.js 2>&1 || {
      error "Impossible de générer les clips"
      exit 1
    }
  }
fi
check_step
log "✅ Clips générés"

# ── ÉTAPE 2b : Vérification ──
header "🔍 ÉTAPE 2b — VÉRIFICATION DES CLIPS"
node scripts/step2b_verify_images.js 2>&1 || warn "⚠️ Certains clips manquants (continuation quand même)"
log "✅ Vérification terminée"

# ── ÉTAPE 4 : Assemblage final ──
header "🎞️  ÉTAPE 4 — ASSEMBLAGE FINAL"
node scripts/step4_assemble_video.js 2>&1 || {
  error "Assemblage échoué"
  exit 1
}
check_step
log "✅ Vidéo finale assemblée"

# ── ÉTAPE 5 : Titre et hashtags ──
header "🏷️  ÉTAPE 5 — TITRE VIRAL & HASHTAGS"
node scripts/step5_generate_filename.js 2>&1 || warn "⚠️ Génération du titre échouée (continuation)"
log "✅ Métadonnées prêtes"

# ── Résumé ──
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}  🎉✅  PIPELINE TERMINÉ AVEC SUCCÈS !                ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${WHITE}Durée totale :${NC} $(($DURATION / 60))min $(($DURATION % 60))s"
echo -e "  ${WHITE}Thème        :${NC} $THEME"
echo -e "  ${WHITE}Mode         :${NC} $MODE"
echo ""

if [ -f "tmp_data/video_finale.mp4" ]; then
  SIZE=$(du -h "tmp_data/video_finale.mp4" | cut -f1)
  echo -e "  ${WHITE}📁 Vidéo finale :${NC} tmp_data/video_finale.mp4 (${SIZE})"
fi

if [ -f "tmp_data/metadata.json" ]; then
  TITLE=$(node -e "console.log(JSON.parse(require('fs').readFileSync('tmp_data/metadata.json','utf-8')).title || 'N/A')" 2>/dev/null || echo "N/A")
  echo -e "  ${WHITE}🏷️  Titre         :${NC} ${TITLE}"
fi

echo ""
echo -e "${YELLOW}━━━ PROCHAINES ÉTAPES ━━━${NC}"
echo -e "  ${CYAN}📤 Publier sur YouTube :${NC} npm run upload-youtube"
echo -e "  ${CYAN}📊 Rapport viral       :${NC} npm run viral:report"
echo -e "  ${CYAN}🎬 Animer une image    :${NC} npm run glam:animate -- <image> \"<prompt>\""
echo ""
