/**
 * TESTS UNITAIRES — pipeline_config.js
 * Vérifie la configuration des 4 formats, la continuité des épisodes et les métadonnées.
 *
 * Usage : node scripts/test_unit.js
 */

"use strict";

const fs = require("fs");
const path = require("path");

const {
  THEMES,
  getThemeFromEnvironment,
  getSegmentCount,
  getMangaEpisode,
  getCartoonEpisode,
} = require("./pipeline_config");
const { getCharacterBible, enrichSegmentsWithCharacters } = require("./character_engine");
const { enrichSegmentsWithContinuity, validateContinuity } = require("./continuity_engine");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.error(`  ❌ ${message}`);
  }
}

function assertThrows(fn, message) {
  try {
    fn();
    failed++;
    console.error(`  ❌ ${message} (pas d'exception levée)`);
  } catch {
    passed++;
    console.log(`  ✅ ${message}`);
  }
}

// ─── 1. Formats ───────────────────────────────────────────────────────────────
console.log("\n📋 TEST 1 : Les 4 formats sont définis");

const expectedThemes = ["dessin_anime", "manga", "actualites", "horreur"];
assert(Object.keys(THEMES).length === 4, "Exactement 4 formats dans THEMES");

for (const id of expectedThemes) {
  assert(THEMES[id] !== undefined, `Format "${id}" existe`);
  assert(typeof THEMES[id].label === "string" && THEMES[id].label.length > 0, `"${id}" a un label`);
  assert(typeof THEMES[id].subject === "string" && THEMES[id].subject.length > 0, `"${id}" a un subject`);
  assert(typeof THEMES[id].style === "string" && THEMES[id].style.length > 0, `"${id}" a un style`);
  assert(typeof THEMES[id].visualStyle === "string" && THEMES[id].visualStyle.length > 0, `"${id}" a un visualStyle`);
  assert(["animated_story", "manga_motion"].includes(THEMES[id].visualMode), `"${id}" a un visualMode valide`);
}

// ─── 2. Anciens formats supprimés ─────────────────────────────────────────────
console.log("\n📋 TEST 2 : Les anciens formats sont supprimés");

assert(THEMES.ia === undefined, 'Format "ia" supprimé');
assert(THEMES.reportage === undefined, 'Format "reportage" supprimé');

// ─── 3. Continuité manga ──────────────────────────────────────────────────────
console.log("\n📋 TEST 3 : Continuité des épisodes manga");

const mangaEpisode = getMangaEpisode();
assert(typeof mangaEpisode.number === "number" && mangaEpisode.number >= 1, `Numéro d'épisode manga valide (${mangaEpisode.number})`);
assert(typeof mangaEpisode.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(mangaEpisode.date), `Date manga valide (${mangaEpisode.date})`);
assert(typeof mangaEpisode.title === "string" && mangaEpisode.title.length > 0, `Titre série manga présent`);
assert(typeof mangaEpisode.arc === "object" && mangaEpisode.arc.name, `Arc manga trouvé (${mangaEpisode.arc.name})`);
assert(typeof mangaEpisode.arc.goal === "string" && mangaEpisode.arc.goal.length > 0, `Objectif arc manga présent`);
assert(typeof mangaEpisode.visualBible === "string" && mangaEpisode.visualBible.length > 0, `Bible visuelle manga présente`);
assert(typeof mangaEpisode.series === "object", `Métadonnées série manga présentes`);

// ─── 4. Continuité dessin animé ───────────────────────────────────────────────
console.log("\n📋 TEST 4 : Continuité des épisodes dessin animé");

const cartoonEpisode = getCartoonEpisode();
assert(typeof cartoonEpisode.number === "number" && cartoonEpisode.number >= 1, `Numéro d'épisode cartoon valide (${cartoonEpisode.number})`);
assert(typeof cartoonEpisode.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(cartoonEpisode.date), `Date cartoon valide (${cartoonEpisode.date})`);
assert(typeof cartoonEpisode.title === "string" && cartoonEpisode.title.length > 0, `Titre série cartoon présent (${cartoonEpisode.title})`);
assert(typeof cartoonEpisode.arc === "object" && cartoonEpisode.arc.name, `Arc cartoon trouvé (${cartoonEpisode.arc.name})`);
assert(Array.isArray(cartoonEpisode.arc.themes) && cartoonEpisode.arc.themes.length > 0, `Thèmes arc cartoon présents (${cartoonEpisode.arc.themes.join(", ")})`);
assert(typeof cartoonEpisode.episodeStructure === "object", `Structure d'épisode cartoon présente`);
assert(typeof cartoonEpisode.series.characters === "object" && cartoonEpisode.series.characters.length >= 3, `Au moins 3 personnages cartoon (${cartoonEpisode.series.characters.length})`);

// ─── 5. Nombre de segments ───────────────────────────────────────────────────
console.log("\n📋 TEST 5 : Nombre de segments");

assert(getSegmentCount("actualites") === 16, "actualites → 16 segments");
assert(getSegmentCount("horreur") === 16, "horreur → 16 segments");

// Manga par défaut
assert(getSegmentCount("manga") === 48, "manga → 48 segments par défaut");

// Dessin animé par défaut
assert(getSegmentCount("dessin_anime") === 24, "dessin_anime → 24 segments par défaut");

// ─── 6. Sélection du thème par PIPELINE_THEME ────────────────────────────────
console.log("\n📋 TEST 6 : Sélection du thème via PIPELINE_THEME");

for (const id of expectedThemes) {
  process.env.PIPELINE_THEME = id;
  assert(getThemeFromEnvironment() === id, `PIPELINE_THEME=${id} → "${id}"`);
}

// Thème invalide
process.env.PIPELINE_THEME = "invalide";
assertThrows(() => getThemeFromEnvironment(), "PIPELINE_THEME invalide → erreur");

// Thème ancien supprimé
process.env.PIPELINE_THEME = "ia";
assertThrows(() => getThemeFromEnvironment(), "PIPELINE_THEME=ia (supprimé) → erreur");

process.env.PIPELINE_THEME = "reportage";
assertThrows(() => getThemeFromEnvironment(), "PIPELINE_THEME=reportage (supprimé) → erreur");

delete process.env.PIPELINE_THEME;

// ─── 7. Fichiers JSON des séries ─────────────────────────────────────────────
console.log("\n📋 TEST 7 : Fichiers JSON des séries");

const mangaJson = JSON.parse(fs.readFileSync(path.join(__dirname, "manga_series.json"), "utf8"));
assert(mangaJson.title && mangaJson.arcs && mangaJson.arcs.length > 0, "manga_series.json valide");
assert(mangaJson.visual_bible.length > 50, "Bible visuelle manga détaillée");

const cartoonJson = JSON.parse(fs.readFileSync(path.join(__dirname, "cartoon_series.json"), "utf8"));
assert(cartoonJson.title && cartoonJson.arcs && cartoonJson.arcs.length > 0, "cartoon_series.json valide");
assert(cartoonJson.characters && cartoonJson.characters.length >= 3, "Au moins 3 personnages cartoon");
assert(cartoonJson.episode_structure && cartoonJson.episode_structure.resolution, "Structure d'épisode avec résolution positive");
assert(cartoonJson.visual_bible.length > 50, "Bible visuelle cartoon détaillée");

// ─── 8. Verrous personnages et continuité ───────────────────────────────────
console.log("\n📋 TEST 8 : Continuité clips et personnages");
const demoSegments = enrichSegmentsWithContinuity(enrichSegmentsWithCharacters([
  { id: 1, audio_texte: "Pomme trouve un secret", prompt_visuel: "Pomme in orchard" },
  { id: 2, audio_texte: "Orange arrive", prompt_visuel: "Orange joins Pomme" },
], getCharacterBible("dessin_anime")));
const continuityCheck = validateContinuity(demoSegments);
assert(continuityCheck.valid, "Plan de continuité 5–10 secondes valide");
assert(demoSegments[0].character_ids.includes("pomme"), "Pomme reçoit un verrou de personnage");
assert(demoSegments[1].continuity.reference_image === "images/reference_001.jpg", "Scène suivante référence l'image précédente");

// ─── 8. Cohérence des créneaux horaires ──────────────────────────────────────
console.log("\n📋 TEST 9 : Sélection automatique du thème par l'heure");

// Sauvegarder PIPELINE_THEME et le supprimer pour tester la sélection horaire
delete process.env.PIPELINE_THEME;
const autoTheme = getThemeFromEnvironment();
assert(expectedThemes.includes(autoTheme), `Thème auto "${autoTheme}" parmi les 4 formats valides`);

// ─── Résultat final ──────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(60));
console.log(`🏁 Résultat : ${passed} réussi(s), ${failed} échoué(s) sur ${passed + failed} tests`);
console.log("=".repeat(60));

if (failed > 0) {
  process.exit(1);
} else {
  console.log("🎉 Tous les tests passent !");
  process.exit(0);
}
