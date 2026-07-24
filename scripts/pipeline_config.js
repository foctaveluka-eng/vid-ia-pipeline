"use strict";

const fs = require("fs");
const path = require("path");

/** Paramètres partagés du pipeline éditorial. */
const THEMES = {
  ia: {
    label: "Histoire IA animée",
    segments: 16,
    visualMode: "animated_story",
    subject: "une histoire originale autour de l'intelligence artificielle, de la technologie et de ses conséquences humaines",
    style: "Raconte un thriller technologique vivant, avec un personnage, un enjeu clair et une progression dramatique. Ce n'est pas un bulletin d'actualité.",
    visualStyle: "cinematic animated illustration, coherent recurring characters, expressive action, dramatic lighting, no text, no watermark",
  },
  reportage: {
    label: "Vrai reportage",
    segments: 16,
    visualMode: "animated_story",
    subject: "un fait réel, récent et vérifiable de l'actualité internationale",
    style: "Réalise un vrai mini-reportage: ne jamais inventer de faits, dates, citations, statistiques ou témoins. Distingue clairement les faits établis de ce qui reste incertain. Garde un ton factuel, humain et accessible.",
    visualStyle: "documentary editorial illustration, realistic locations and people, cinematic reportage framing, no text, no logos, no watermark",
  },
  horreur: {
    label: "Moment d'horreur",
    segments: 16,
    visualMode: "animated_story",
    subject: "une histoire d'horreur originale, sombre et parfaitement linéaire",
    style: "Écris à la première personne du singulier. Fais ressentir l'angoisse par des détails sensoriels et une montée de tension; chaque segment doit mener naturellement au suivant.",
    visualStyle: "dark cinematic horror illustration, coherent protagonist, atmospheric shadows, dramatic composition, no gore, no text, no watermark",
  },
  manga: {
    label: "Manga — histoire complète",
    segments: null,
    visualMode: "manga_motion",
    subject: "un manga original racontant une histoire complète, avec début, développement, climax et conclusion",
    style: "Construis une histoire longue mais complète, pas un simple résumé. Crée une bible de personnages cohérente (apparence, tenue, âge adulte ou adolescent non ambigu, relations, objectif) et respecte-la à chaque scène. Structure le récit en actes: mise en place, incident déclencheur, obstacles, révélation, climax, résolution. N'utilise aucun personnage, univers, nom, costume ou franchise protégés existants. Les dialogues doivent être racontés par le narrateur, sans bulles de texte.",
    visualStyle: "original high-contrast black-and-white manga artwork, consistent character design and clothing, dynamic action, screentones, ink lines, cinematic panel composition, no speech bubbles, no written text, no watermark",
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

  // Quatre rendez-vous de six heures: manga à minuit, IA le matin, reportage à midi, horreur le soir.
  if (hour >= 6 && hour < 12) return "ia";
  if (hour >= 12 && hour < 18) return "reportage";
  if (hour >= 18) return "horreur";
  return "manga";
}

function getSegmentCount(theme) {
  if (theme === "manga") {
    // 48 scènes donnent un chapitre de plusieurs minutes; configurable jusqu'à 120 scènes.
    return boundedInteger(process.env.MANGA_SEGMENTS, 48, 24, 120);
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
  return { number, date: today, title: series.title, logline: series.logline, visualBible: series.visual_bible, arc };
}

module.exports = { THEMES, getThemeFromEnvironment, getSegmentCount, getMangaEpisode };
