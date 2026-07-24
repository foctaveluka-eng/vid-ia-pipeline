"use strict";

const fs = require("fs");
const path = require("path");

/** Paramètres partagés du pipeline éditorial. */
const THEMES = {
  dessin_anime: {
    label: "Dessin animé — Les Aventures du Verger Magique",
    segments: null,
    visualMode: "animated_story",
    subject: "un épisode de dessin animé pour enfants avec des fruits qui parlent, vivant des aventures quotidiennes avec des secrets, rumeurs et petites manipulations toujours résolues positivement",
    style: "Crée un épisode pour enfants (6-12 ans) avec des fruits animés. L'histoire doit être engageante, avec des rebondissements légers (secrets, rumeurs, petites trahisons) mais toujours résolus de manière positive. Chaque épisode a son propre mini-conflit tout en faisant avancer l'arc narratif. Les dialogues sont racontés par le narrateur. Ton bienveillant, éducatif et amusant.",
    visualStyle: "colorful 3D cartoon style, cute anthropomorphic fruits with expressive faces, bright pastel colors, magical orchard setting, child-friendly, no text, no watermark, soft lighting",
  },
  manga: {
    label: "Manga — histoire complète",
    segments: null,
    visualMode: "manga_motion",
    subject: "un manga original racontant une histoire complète, avec début, développement, climax et conclusion",
    style: "Construis une histoire longue mais complète, pas un simple résumé. Crée une bible de personnages cohérente (apparence, tenue, âge adulte ou adolescent non ambigu, relations, objectif) et respecte-la à chaque scène. Structure le récit en actes: mise en place, incident déclencheur, obstacles, révélation, climax, résolution. N'utilise aucun personnage, univers, nom, costume ou franchise protégés existants. Les dialogues doivent être racontés par le narrateur, sans bulles de texte.",
    visualStyle: "original high-contrast black-and-white manga artwork, consistent character design and clothing, dynamic action, screentones, ink lines, cinematic panel composition, no speech bubbles, no written text, no watermark",
  },
  actualites: {
    label: "Actualités du monde vérifiables",
    segments: 16,
    visualMode: "animated_story",
    subject: "un fait d'actualité international récent et vérifiable, avec sources et contexte",
    style: "Réalise un vrai bulletin d'information: ne jamais inventer de faits, dates, citations, statistiques ou témoins. Cite les sources quand c'est possible. Distingue clairement les faits établis de ce qui reste incertain ou en développement. Garde un ton factuel, clair et accessible. Termine par le contexte ou les implications.",
    visualStyle: "documentary editorial illustration, realistic locations and people, news reportage framing, professional and clear, no text overlays, no logos, no watermark",
  },
  horreur: {
    label: "Moment d'horreur",
    segments: 16,
    visualMode: "animated_story",
    subject: "une histoire d'horreur originale, sombre et parfaitement linéaire",
    style: "Écris à la première personne du singulier. Fais ressentir l'angoisse par des détails sensoriels et une montée de tension; chaque segment doit mener naturellement au suivant.",
    visualStyle: "dark cinematic horror illustration, coherent protagonist, atmospheric shadows, dramatic composition, no gore, no text, no watermark",
  },
};

function boundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function getThemeFromEnvironment() {
  const forced = (process.env.PIPELINE_THEME || "").trim().toLowerCase();
  if (forced) {
    if (!THEMES[forced]) {
      throw new Error(`PIPELINE_THEME invalide: "${forced}". Valeurs autorisées: ${Object.keys(THEMES).join(", ")}.`);
    }
    return forced;
  }

  // Europe/Paris gère automatiquement l'heure d'été, contrairement à UTC+2 fixe.
  const hour = Number(new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(new Date()));

  // Quatre rendez-vous de six heures: dessin animé le matin, actualités à midi, horreur le soir, manga la nuit.
  if (hour >= 6 && hour < 12) return "dessin_anime";
  if (hour >= 12 && hour < 18) return "actualites";
  if (hour >= 18) return "horreur";
  return "manga";
}

function getSegmentCount(theme) {
  if (theme === "manga") {
    // 48 scènes donnent un chapitre de plusieurs minutes; configurable jusqu'à 120 scènes.
    return boundedInteger(process.env.MANGA_SEGMENTS, 48, 24, 120);
  }
  if (theme === "dessin_anime") {
    // 24 scènes pour un épisode de dessin animé quotidien; configurable de 16 à 48.
    return boundedInteger(process.env.CARTOON_SEGMENTS, 24, 16, 48);
  }
  return THEMES[theme].segments;
}

function parisDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function getMangaEpisode() {
  const series = JSON.parse(fs.readFileSync(path.join(__dirname, "manga_series.json"), "utf8"));
  const start = process.env.MANGA_SERIES_START_DATE || "2026-07-24";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new Error("MANGA_SERIES_START_DATE doit être au format YYYY-MM-DD.");
  const today = parisDate();
  const elapsedDays = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000);
  const number = Math.max(1, elapsedDays + 1);
  const arc = series.arcs.find((item) => number >= item.from && number <= item.to) || series.arcs[series.arcs.length - 1];
  return { number, date: today, title: series.title, logline: series.logline, visualBible: series.visual_bible, arc, series };
}

function getCartoonEpisode() {
  const series = JSON.parse(fs.readFileSync(path.join(__dirname, "cartoon_series.json"), "utf8"));
  const start = process.env.CARTOON_SERIES_START_DATE || "2026-07-24";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new Error("CARTOON_SERIES_START_DATE doit être au format YYYY-MM-DD.");
  const today = parisDate();
  const elapsedDays = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000);
  const number = Math.max(1, elapsedDays + 1);
  const arc = series.arcs.find((item) => number >= item.from && number <= item.to) || series.arcs[series.arcs.length - 1];
  return { number, date: today, title: series.title, logline: series.logline, visualBible: series.visual_bible, arc, series, episodeStructure: series.episode_structure };
}

module.exports = { THEMES, getThemeFromEnvironment, getSegmentCount, getMangaEpisode, getCartoonEpisode };
