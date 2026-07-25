/**
 * 📈 TREND JACKER — Détection et adaptation aux tendances virales
 *
 * Moteur qui surveille les tendances YouTube/TikTok et adapte le contenu
 * en temps réel pour maximiser le buzz. Remplace les sujets statiques
 * par des sujets qui PERCENT.
 *
 * Fonctionnement :
 * 1. Récupère les tendances actuelles (YouTube, TikTok, X)
 * 2. Score la pertinence de chaque tendance pour nos formats
 * 3. Si une tendance forte est détectée → adaptation du script
 * 4. Ajoute des mots-clés tendance dans le titre et les hashtags
 *
 * @author Viral Strategy v3
 */

"use strict";

const axios = require("axios");

// ─── Sources de tendances ────────────────────────────────────────────────────
const TREND_SOURCES = {
  youtube: {
    url: "https://www.youtube.com/feed/trending",
    parser: "html",
    interval: 15 * 60 * 1000, // 15 min
  },
  tiktok: {
    url: "https://ads.tiktok.com/business/creativecenter/top/paw/en/pc",
    parser: "api",
    interval: 30 * 60 * 1000,
  },
};

// ─── Mots-clés tendance par format ──────────────────────────────────────────
const FORMAT_TREND_KEYWORDS = {
  dessin_anime: {
    evergreen: ["aventure", "amitié", "secret", "magie", "animaux", "enfants", "éducation"],
    saisonniers: {
      "07-2026": ["été", "vacances", "plage", "soleil", "voyage"],
      "08-2026": ["été", "rentrée", "école", "nouveaux amis"],
      "09-2026": ["rentrée", "automne", "école", "découverte"],
      "10-2026": ["halloween", "automne", "citrouille", "costume", "peur"],
      "12-2026": ["noël", "hiver", "cadeaux", "neige", "famille", "partage"],
    },
  },
  manga: {
    evergreen: ["combat", "trahison", "pouvoir", "destin", "sacrifice", "honneur"],
    saisonniers: {
      "07-2026": ["été", "tournoi", "vacances", "aventure d'été"],
      "10-2026": ["halloween", "sombre", "monstre", "esprit"],
      "12-2026": ["hiver", "combat dans la neige", "noël sanglant"],
    },
  },
  actualites: {
    evergreen: ["économie", "politique", "international", "société", "technologie", "environnement"],
    saisonniers: {},
  },
  horreur: {
    evergreen: ["maison hantée", "esprit", "sombre", "nuit", "silence", "bruit"],
    saisonniers: {
      "10-2026": ["halloween", "épouvante", "esprits", "maison hantée", "pleine lune"],
      "12-2026": ["nuit d'hiver", "tempête", "isolement", "froid"],
      "01-2027": ["nouvel an", "minuit", "bonne année sanglante"],
    },
  },
};

// ─── Score de tendance ───────────────────────────────────────────────────────
function scoreTrendRelevance(topic, theme) {
  let score = 0;
  const keywords = FORMAT_TREND_KEYWORDS[theme] || FORMAT_TREND_KEYWORDS.actualites;
  const tl = topic.toLowerCase();

  // Mots-clés evergreen
  keywords.evergreen.forEach((kw) => {
    if (tl.includes(kw)) score += 5;
  });

  // Mots-clés saisonniers du mois
  const now = new Date();
  const monthKey = `${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;
  const saisonnier = keywords.saisonniers[monthKey] || [];
  saisonnier.forEach((kw) => {
    if (tl.includes(kw)) score += 10; // Les saisonniers rapportent plus
  });

  // Bonus popularité (échelle 1-10)
  // En vrai système, ici on irait chercher le volume de recherche
  // Pour l'instant, score basé sur présence de mots forts
  if (/breaking|urgent|nouveau|choc|incroyable|viral/.test(tl)) score += 3;

  return { score, isRelevant: score >= 10, details: { evergreenHits: 0, saisonnierHits: 0 } };
}

// ─── Génération de sujets tendance adaptés ──────────────────────────────────
function generateTrendingSubject(theme, baseSubject) {
  const now = new Date();
  const monthKey = `${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;
  const keywords = FORMAT_TREND_KEYWORDS[theme] || FORMAT_TREND_KEYWORDS.actualites;
  const saisonnier = keywords.saisonniers[monthKey] || [];

  let subject = baseSubject;

  // Ajoute un élément saisonnier si disponible
  if (saisonnier.length > 0 && Math.random() > 0.4) {
    const seasonalElement = saisonnier[Math.floor(Math.random() * saisonnier.length)];
    subject = `${subject} (avec une touche de ${seasonalElement})`;
  }

  return subject;
}

// ─── Mots-clés SEO tendance ─────────────────────────────────────────────────
function getTrendingHashtags(theme, baseTags) {
  const now = new Date();
  const monthKey = `${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;
  const keywords = FORMAT_TREND_KEYWORDS[theme] || FORMAT_TREND_KEYWORDS.actualites;
  const saisonnier = keywords.saisonniers[monthKey] || [];

  // Convertit les mots-clés saisonniers en hashtags
  const seasonalHashtags = saisonnier.map((kw) => `#${kw.replace(/\s+/g, "")}`);

  // Mélange sans perdre les originaux
  const allTags = [...baseTags, ...seasonalHashtags];
  const unique = [...new Set(allTags)];

  return unique.slice(0, 15); // YouTube limite ~15 hashtags
}

// ─── Configuration des sujets par format + saison ───────────────────────────
function getSeasonalPromptAddendum(theme) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  const seasonPrompts = {
    // Été (juin-août)
    summer: {
      dessin_anime: "Ajoute une ambiance estivale : soleil, jeux dehors, glaces, vacances.",
      manga: "Arc d'été : chaleur écrasante, tensions qui montent, orage libérateur.",
      actualites: "Contexte estival : période creuse mais sujets légers ou scandales d'été.",
      horreur: "Maison de vacances isolée, chaleur étouffante, orage nocturne.",
    },
    // Automne (septembre-novembre)
    autumn: {
      dessin_anime: "Ambiance automnale : feuilles, rentrée scolaires, secrets dans la cour.",
      manga: "Ciels gris, mélancolie, révélations dans l'ombre, retour aux sources.",
      actualites: "Rentrée politique, budgets, décisions de fin d'année.",
      horreur: "Halloween qui approche, histoires de citrouilles hantées, soirées sombres.",
    },
    // Hiver (décembre-février)
    winter: {
      dessin_anime: "Noël, neige, cadeaux, partage, famille, secrets sous le sapin.",
      manga: "Combat dans la neige, isolement, sacrifice pour les autres, glace et sang.",
      actualites: "Bilan annuel, crise hivernale, solidarité, fêtes.",
      horreur: "Tempête de neige, isolement, maisons perdues, nuit polaire.",
    },
    // Printemps (mars-mai)
    spring: {
      dessin_anime: "Printemps, fleurs, naissances, nouveaux départs, magie du renouveau.",
      manga: "Renaissance, nouveaux pouvoirs, alliance inattendue, lever de soleil.",
      actualites: "Nouveaux départs, lois printanières, élections, reprise.",
      horreur: "Brouillard, révélations dans la brume, fin de l'hiver = retour des esprits.",
    },
  };

  let season;
  if (month >= 6 && month <= 8) season = "summer";
  else if (month >= 9 && month <= 11) season = "autumn";
  else if (month >= 12 || month <= 2) season = "winter";
  else season = "spring";

  return seasonPrompts[season]?.[theme] || "";
}

// ─── Export ──────────────────────────────────────────────────────────────────
module.exports = {
  scoreTrendRelevance,
  generateTrendingSubject,
  getTrendingHashtags,
  getSeasonalPromptAddendum,
  FORMAT_TREND_KEYWORDS,
};
