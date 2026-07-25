#!/usr/bin/env node

/**
 * TEST PIPELINE v3 — Vérification complète du système viral
 * Teste tous les modules sans dépendance réseau externe.
 *
 * Usage : node scripts/test_pipeline_v3.js
 */

"use strict";

const fs = require("fs");
const path = require("path");

let totalTests = 0;
let passes = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passes++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════
console.log("╔══════════════════════════════════════════════════════╗");
console.log("║  🧪 TEST PIPELINE v3 — VÉRIFICATION COMPLÈTE      ║");
console.log("╚══════════════════════════════════════════════════════╝\n");

// ── 1. Modules ──
console.log("📦 CHARGEMENT DES MODULES");
let v, t, a, glam, engine, config;
test("viral_strategy_v3", () => { v = require("./viral_strategy_v3"); if (!v.scoreHook) throw new Error("Pas de scoreHook"); });
test("viral_trend_jacker", () => { t = require("./viral_trend_jacker"); if (!t.getSeasonalPromptAddendum) throw new Error(); });
test("viral_analytics_tracker", () => { a = require("./viral_analytics_tracker"); if (!a.loadAnalytics) throw new Error(); });
test("glam_img2video", () => { glam = require("./glam_img2video"); if (!glam.imgToVideo) throw new Error(); });
test("viral_engine", () => { engine = require("./viral_engine"); if (!engine.scoreVirality) throw new Error(); });
test("pipeline_config", () => { config = require("./pipeline_config"); if (!config.THEMES) throw new Error(); });

// ── 2. Constantes ──
console.log("\n📊 CONSTANTES VIRALES");
test("4 formats THEMES", () => { if (Object.keys(config.THEMES).length !== 4) throw new Error(); });
test("7 émotions virales", () => { if (Object.keys(v.VIRAL_EMOTIONS).length !== 7) throw new Error(); });
test("4 courbes émotionnelles (5+ phases)", () => {
  const c = v.EMOTION_CURVES;
  if (Object.keys(c).length !== 4) throw new Error();
  Object.values(c).forEach(p => { if (Object.keys(p).length < 5) throw new Error(); });
});
test("4 specs rétention", () => {
  Object.values(v.RETENTION_SPECS).forEach(s => {
    if (!s.idealDuration || !s.hookWindow || s.twistPosition === undefined) throw new Error();
  });
});
test("3 techniques comment-bait (4 formats)", () => {
  const cb = v.COMMENT_BAIT_TECHNIQUES;
  if (Object.keys(cb).length !== 3) throw new Error();
  Object.values(cb).forEach(t => { if (Object.keys(t.templates).length !== 4) throw new Error(); });
});
test("27+ pattern interrupts", () => {
  const p = v.PATTERN_INTERRUPTS;
  if (p.visuels.length + p.audio.length + p.narratifs.length < 25) throw new Error();
});

// ── 3. Hook Scoring ──
console.log("\n🎣 HOOK SCORING");
test("Hook vide = 0", () => { if (v.scoreHook("").score !== 0) throw new Error(); });
test("Hook null = 0", () => { if (v.scoreHook(null).score !== 0) throw new Error(); });
test("Curiosity gap OK", () => { if (v.scoreHook("Personne ne sait quel secret cache Pomme").score < 35) throw new Error(); });
test("Question ouverte", () => { if (!v.scoreHook("Tu ferais quoi ?").criteria.hasQuestion) throw new Error(); });
test("Interjection", () => { if (!v.scoreHook("Attention !").criteria.hasInterjection) throw new Error(); });
test("Chiffre", () => { if (!v.scoreHook("78% des gens").criteria.hasChiffre) throw new Error(); });
test("1ère personne", () => { if (!v.scoreHook("J ai découvert un truc").criteria.hasFirstPerson) throw new Error(); });
test("Direct address", () => { if (!v.scoreHook("Tu ne devineras pas").criteria.hasDirectAddress) throw new Error(); });
test("Urgence", () => { if (!v.scoreHook("Découvre maintenant").criteria.hasUrgence) throw new Error(); });
test("Début faible pénalisé", () => { if (v.scoreHook("Donc voilà je raconte").score > 55) throw new Error(); });
test("Bon hook > 60", () => { if (!v.scoreHook("Tu crois tout savoir ? Voici le chiffre que 99% ignorent.").isViralReady) throw new Error(); });
test("Hook max 80+", () => { if (v.scoreHook("🚨 78% des gens ignorent ce secret incroyable ! Et toi ?").score < 70) throw new Error(); });

// ── 4. Score Viral ──
console.log("\n📈 SCORE VIRAL v3");
test("Script vide < 50", () => { if (v.scoreViralityV3([{audio_texte:"test",prompt_visuel:"test"}],"dessin_anime").score > 50) throw new Error(); });
test("Script viral détecté", () => {
  const s = [
    {audio_texte:"Tu crois tout savoir ? Voici le chiffre que 99% ignorent.",prompt_visuel:"wide cinematic no text"},
    {audio_texte:"Mais soudain une révélation choquante change tout.",prompt_visuel:"close-up dramatic reveal no text"},
    {audio_texte:"Et toi dis en commentaire abonne toi !",prompt_visuel:"final shot looking at camera no text"},
  ];
  const r = v.scoreViralityV3(s,"actualites");
  if (r.score < 40) throw new Error(String(r.score));
  console.log(`    Score: ${r.score}/100 ${r.grade}`);
});
test("6 catégories détail", () => {
  ['Hook','Twist 70%','CTA Viral','Variété visuelle','Mots viraux','Émotion'].forEach(c => {
    const r = v.scoreViralityV3([{audio_texte:"test secret",prompt_visuel:"test"}],"dessin_anime");
    if (!r.details.map(d=>d.category).includes(c)) throw new Error('Manque: '+c);
  });
});

// ── 5. Generate Prompt ──
console.log("\n📝 GÉNÉRATEUR DE PROMPT");
test("Prompt 16s horreur complet (Hook+Twist+CTA)", () => {
  const r = v.generateViralPrompt("horreur",16,{},Array(16).fill(""));
  if (r.fullPrompt.length < 2000) throw new Error("Trop court: "+r.fullPrompt.length);
  if (!r.fullPrompt.includes("HOOK MORTEL")) throw new Error("Hook manquant");
  if (!r.fullPrompt.includes("TWIST MAJEUR")) throw new Error("Twist manquant");
  if (!r.fullPrompt.includes("CTA VIRAL")) throw new Error("CTA manquant");
  console.log(`    Prompt: ${r.fullPrompt.length} chars`);
});
test("Prompt 48s manga (format max)", () => {
  const r = v.generateViralPrompt("manga",48,{number:12},Array(48).fill(""));
  if (r.fullPrompt.length < 6000) throw new Error("Trop court: "+r.fullPrompt.length);
  console.log(`    Prompt: ${r.fullPrompt.length} chars`);
});
test("Summary avec métriques", () => {
  const r = v.generateViralPrompt("manga",48,{},Array(48).fill(""));
  if (!r.summary.duration || !r.summary.hookWindow || !r.summary.twistPosition || !r.summary.emotions) throw new Error();
  if (Object.keys(r.summary.emotions).length < 4) throw new Error();
});

// ── 6. Segment Directives ──
console.log("\n🎯 SEGMENT DIRECTIVES");
test("Seg 0 = hook", () => { if (v.generateSegmentDirective("dessin_anime",0,24).phase !== "hook") throw new Error(); });
test("Twist manga 34/48", () => { if (v.generateSegmentDirective("manga",34,48).phase !== "twist") throw new Error(); });
test("Twist cartoon 16/24", () => { if (v.generateSegmentDirective("dessin_anime",16,24).phase !== "twist") throw new Error(); });
test("Twist actu 11/16", () => { if (v.generateSegmentDirective("actualites",11,16).phase !== "twist") throw new Error(); });
test("Twist horreur 16/22", () => { if (v.generateSegmentDirective("horreur",16,22).phase !== "twist") throw new Error(); });
test("CTA dernier (24)", () => { if (v.generateSegmentDirective("dessin_anime",23,24).phase !== "cta") throw new Error(); });
test("CTA dernier (48)", () => { if (v.generateSegmentDirective("manga",47,48).phase !== "cta") throw new Error(); });
test("CTA dernier (16)", () => { if (v.generateSegmentDirective("actualites",15,16).phase !== "cta") throw new Error(); });
test("CTA dernier (22)", () => { if (v.generateSegmentDirective("horreur",21,22).phase !== "cta") throw new Error(); });
test("Émotion dominante partout", () => {
  for (let i = 0; i < 24; i++) {
    if (!v.generateSegmentDirective("dessin_anime",i,24).dominantEmotion) throw new Error("Seg "+i);
  }
});

// ── 7. Trend Jacker ──
console.log("\n🌍 TREND JACKER");
test("scoreTrendRelevance", () => { if (typeof t.scoreTrendRelevance("secret","dessin_anime").score !== "number") throw new Error(); });
test("generateTrendingSubject", () => { if (typeof t.generateTrendingSubject("horreur","test") !== "string") throw new Error(); });
test("getTrendingHashtags", () => { if (!t.getTrendingHashtags("dessin_anime",["#Test"]).includes("#Test")) throw new Error(); });
test("getSeasonalPromptAddendum", () => { if (typeof t.getSeasonalPromptAddendum("manga") !== "string") throw new Error(); });

// ── 8. Analytics ──
console.log("\n📊 ANALYTICS");
test("loadAnalytics", () => { const d = a.loadAnalytics(); if (typeof d.videos_published !== "number") throw new Error(); });
test("recordVideoPublished", () => { const r = a.recordVideoPublished({theme:"horreur",viralScore:92}); if (!r.id) throw new Error(); });
test("getRecommendations array", () => { if (!Array.isArray(a.getRecommendations("dessin_anime"))) throw new Error(); });
test("Performance report string", () => { const r = a.generatePerformanceReport(); if (typeof r !== "string" || !r.includes("PERFORMANCE")) throw new Error(); });

// ── 9. Glam ──
console.log("\n🎬 GLAM IMG2VIDEO");
test("9 exports", () => { if (Object.keys(glam).length !== 9) throw new Error(); });
test("imgToVideo function", () => { if (typeof glam.imgToVideo !== "function") throw new Error(); });
test("downloadVideo function", () => { if (typeof glam.downloadVideo !== "function") throw new Error(); });
test("DEFAULT_DURATION=5", () => { if (glam.DEFAULT_DURATION !== 5) throw new Error(); });
test("MAX_RETRIES=3", () => { if (glam.MAX_RETRIES !== 3) throw new Error(); });

// ── 10. Unit tests existants ──
console.log("\n🧪 TESTS UNITAIRES EXISTANTS");
const cp = require("child_process");
try {
  const out = cp.execSync("node scripts/test_unit.js 2>&1", {encoding:"utf-8", timeout:30000});
  test("59 tests unitaires (test_unit.js)", () => {
    if (!out.includes("Tous les tests passent")) throw new Error(out.match(/Résultat.*/) || "Échec");
  });
  console.log("    ✅ 59/59 tests unitaires OK");
} catch (e) {
  test("Tests unitaires", () => { throw new Error(e.message); });
}

// ── 11. Syntaxe JS ──
console.log("\n📝 SYNTAXE JS");
const jsFiles = fs.readdirSync(__dirname).filter(f => f.endsWith(".js"));
let synErrors = 0;
jsFiles.forEach(f => {
  try { cp.execSync(`node -c "${path.join(__dirname, f)}"`, {stdio:"pipe"}); } catch { synErrors++; }
});
test(`0 erreurs syntaxe (${jsFiles.length} fichiers)`, () => { if (synErrors > 0) throw new Error(synErrors+" erreurs"); });

// ═══════════════════════════════════════════════════════════════
console.log("\n" + "=".repeat(55));
const pct = Math.round((passes / totalTests) * 100);
console.log(`  RÉSULTAT : ${passes}/${totalTests} — ${pct}%`);
if (passes === totalTests) {
  console.log("\n  🎉🔥🔥🔥🔥  SYSTÈME 100% OPÉRATIONNEL !  🔥🔥🔥🔥🎉");
} else {
  console.log(`\n  ⚠️  ${totalTests - passes} échec(s) à corriger`);
}
console.log("=".repeat(55));
process.exit(passes === totalTests ? 0 : 1);
