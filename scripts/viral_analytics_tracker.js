/**
 * 📊 VIRAL ANALYTICS TRACKER — Apprentissage et optimisation continue
 *
 * Ce module enregistre chaque vidéo publiée, ses métriques, et tire des
 * leçons pour améliorer les prochaines. Il crée une boucle d'apprentissage
 * qui rend le système PLUS INTELLIGENT à chaque publication.
 *
 * Fonctionnalités :
 * 1. Sauvegarde de chaque vidéo : titre, score viral, timing, performance
 * 2. Analyse des tendances de performance par format/heure/hook type
 * 3. Recommandations pour la prochaine vidéo basées sur les data passées
 * 4. Mise à jour des templates de hooks selon ce qui a performé
 *
 * @author Viral Strategy v3
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ANALYTICS_FILE = "./tmp_data/viral_analytics.json";

// ─── Structure de base ──────────────────────────────────────────────────────
const DEFAULT_ANALYTICS = {
  videos_published: 0,
  last_updated: null,
  total_views: 0,
  total_likes: 0,
  total_comments: 0,
  total_shares: 0,

  // Performance par format
  format_performance: {
    dessin_anime: { published: 0, avgScore: 0, bestScore: 0, bestHook: "", bestTitle: "" },
    manga: { published: 0, avgScore: 0, bestScore: 0, bestHook: "", bestTitle: "" },
    actualites: { published: 0, avgScore: 0, bestScore: 0, bestHook: "", bestTitle: "" },
    horreur: { published: 0, avgScore: 0, bestScore: 0, bestHook: "", bestTitle: "" },
  },

  // Historique des hooks
  hook_performance: [],

  // Performance par créneau horaire
  time_slot_performance: {},
};

// ─── Chargement des analytics ───────────────────────────────────────────────
function loadAnalytics() {
  try {
    if (fs.existsSync(ANALYTICS_FILE)) {
      return JSON.parse(fs.readFileSync(ANALYTICS_FILE, "utf-8"));
    }
  } catch (e) {
    console.warn(`⚠️ Impossible de charger ${ANALYTICS_FILE}: ${e.message}`);
  }
  return JSON.parse(JSON.stringify(DEFAULT_ANALYTICS));
}

function saveAnalytics(analytics) {
  const dir = path.dirname(ANALYTICS_FILE);
  fs.mkdirSync(dir, { recursive: true });
  analytics.last_updated = new Date().toISOString();
  fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(analytics, null, 2), "utf-8");
}

// ─── Enregistrement d'une publication ───────────────────────────────────────
function recordVideoPublished({ theme, viralScore, hook, title, segmentCount, postingHour, postingDay }) {
  const analytics = loadAnalytics();

  analytics.videos_published++;
  const videoRecord = {
    id: analytics.videos_published,
    date: new Date().toISOString(),
    theme,
    viralScore: viralScore || 0,
    hook: hook || "",
    title: title || "",
    segments: segmentCount || 0,
    postingHour: postingHour || new Date().getHours(),
    postingDay: postingDay || new Date().getDay(),
    // Ces champs seront mis à jour manuellement ou via API plus tard
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    completionRate: 0,
    swipeAwayRate: 0,
  };

  // Ajoute à l'historique
  if (!analytics.history) analytics.history = [];
  analytics.history.unshift(videoRecord); // le plus récent en premier
  analytics.history = analytics.history.slice(0, 500); // garde 500 max

  // Met à jour les stats du format
  const perf = analytics.format_performance[theme] || { published: 0, avgScore: 0, bestScore: 0, bestHook: "", bestTitle: "" };
  perf.published++;
  perf.avgScore = ((perf.avgScore * (perf.published - 1)) + viralScore) / perf.published;
  if (viralScore > perf.bestScore) {
    perf.bestScore = viralScore;
    perf.bestHook = hook;
    perf.bestTitle = title;
  }
  analytics.format_performance[theme] = perf;

  // Met à jour les stats du créneau horaire
  const slotKey = `${postingHour || new Date().getHours()}h`;
  if (!analytics.time_slot_performance[slotKey]) {
    analytics.time_slot_performance[slotKey] = { count: 0, totalScore: 0, avgScore: 0 };
  }
  const slot = analytics.time_slot_performance[slotKey];
  slot.count++;
  slot.totalScore += viralScore || 0;
  slot.avgScore = slot.totalScore / slot.count;

  // Enregistre le hook
  if (hook) {
    analytics.hook_performance.push({
      hook,
      theme,
      score: viralScore || 0,
      date: new Date().toISOString(),
    });
    analytics.hook_performance = analytics.hook_performance.slice(-200); // garde 200 hooks
  }

  saveAnalytics(analytics);
  return videoRecord;
}

// ─── Mise à jour des métriques réelles ──────────────────────────────────────
function updateVideoMetrics(videoId, metrics) {
  const analytics = loadAnalytics();
  if (!analytics.history) return;

  const video = analytics.history.find((v) => v.id === videoId);
  if (!video) return;

  if (metrics.views !== undefined) video.views = metrics.views;
  if (metrics.likes !== undefined) video.likes = metrics.likes;
  if (metrics.comments !== undefined) video.comments = metrics.comments;
  if (metrics.shares !== undefined) video.shares = metrics.shares;
  if (metrics.completionRate !== undefined) video.completionRate = metrics.completionRate;
  if (metrics.swipeAwayRate !== undefined) video.swipeAwayRate = metrics.swipeAwayRate;

  // Met à jour les totaux
  analytics.total_views = analytics.history.reduce((s, v) => s + (v.views || 0), 0);
  analytics.total_likes = analytics.history.reduce((s, v) => s + (v.likes || 0), 0);
  analytics.total_comments = analytics.history.reduce((s, v) => s + (v.comments || 0), 0);
  analytics.total_shares = analytics.history.reduce((s, v) => s + (v.shares || 0), 0);

  saveAnalytics(analytics);
}

// ─── Recommandations pour la prochaine vidéo ────────────────────────────────
function getRecommendations(theme) {
  const analytics = loadAnalytics();
  const recs = [];

  // Recommandation basée sur le créneau horaire
  const slots = Object.entries(analytics.time_slot_performance)
    .map(([slot, data]) => ({ slot, ...data }))
    .filter((s) => s.count >= 2)
    .sort((a, b) => b.avgScore - a.avgScore);

  if (slots.length > 0) {
    const best = slots[0];
    recs.push({
      type: "time_slot",
      recommendation: `Meilleur créneau pour toi : ${best.slot} (score moyen ${Math.round(best.avgScore)} sur ${best.count} vidéos)`,
      confidence: Math.min(90, best.count * 10),
    });
  }

  // Recommandation basée sur les hooks qui ont performé
  const hooks = analytics.hook_performance
    .filter((h) => h.theme === theme)
    .sort((a, b) => b.score - a.score);

  if (hooks.length >= 3) {
    const bestHook = hooks[0];
    recs.push({
      type: "hook_style",
      recommendation: `Ton meilleur hook pour ${theme} : "${bestHook.hook.slice(0, 80)}..." (score ${bestHook.score})`,
      confidence: 75,
    });
  }

  // Recommandation de fréquence
  const perf = analytics.format_performance[theme];
  if (perf && perf.published > 0) {
    recs.push({
      type: "frequency",
      recommendation: `${perf.published} vidéos publiées en ${theme}. Score moyen : ${Math.round(perf.avgScore)}`,
      confidence: 60,
    });
  }

  return recs;
}

// ─── Rapport de performance ─────────────────────────────────────────────────
function generatePerformanceReport() {
  const analytics = loadAnalytics();

  if (analytics.videos_published === 0) {
    return "📊 Aucune vidéo publiée encore. Lance le pipeline !";
  }

  const lines = [
    "╔══════════════════════════════════════════════╗",
    "║  📊 RAPPORT DE PERFORMANCE VIRALE            ║",
    "╚══════════════════════════════════════════════╝",
    "",
    `📹 Vidéos publiées : ${analytics.videos_published}`,
    `👁️ Vues totales : ${analytics.total_views}`,
    `❤️ Likes : ${analytics.total_likes}`,
    `💬 Commentaires : ${analytics.total_comments}`,
    `↗️ Partages : ${analytics.total_shares}`,
    "",
    "━━━ PERFORMANCE PAR FORMAT ━━━",
  ];

  for (const [format, perf] of Object.entries(analytics.format_performance)) {
    if (perf.published > 0) {
      lines.push(`  ${format.toUpperCase()} : ${perf.published} vidéos | Score moyen: ${Math.round(perf.avgScore)} | Best: ${perf.bestScore}`);
    }
  }

  lines.push("");
  lines.push("━━━ RECOMMANDATIONS ━━━");
  const theme = Object.keys(analytics.format_performance).find((f) => analytics.format_performance[f].published > 0) || "actualites";
  const recs = getRecommendations(theme);
  recs.forEach((r) => {
    lines.push(`  💡 [${r.type}] ${r.recommendation} (confiance: ${r.confidence}%)`);
  });

  return lines.join("\n");
}

// ─── Export ─────────────────────────────────────────────────────────────────
module.exports = {
  loadAnalytics,
  saveAnalytics,
  recordVideoPublished,
  updateVideoMetrics,
  getRecommendations,
  generatePerformanceReport,
};
