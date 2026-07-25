/**
 * ÉTAPE 5 — VIRAL : Génération de titre qui buzz + hashtags trending
 * Utilise viral_engine pour templates qui performent + API Delfa avec fallback
 */

"use strict";

const axios = require("axios");
const fs = require("fs");
const { getViralTitleTemplates, getHashtagPacks } = require("./viral_engine");

const DELFA_API_URL = process.env.DELFA_API_URL || "https://delfaapiai.vercel.app/ai/copilot";

const themePrompts = {
  dessin_anime:
    "Génère un titre ULTRA VIRAL de dessin animé pour enfants qui fait cliquer. Utilise curiosity gap, emoji, numéro d'épisode, et promesse de révélation. Exemple: '🍎 SECRET : Pomme a menti et tout explose ! Épisode 12'. Renvoie UNIQUEMENT le titre, max 70 caractères, en français.",
  manga:
    "Génère un titre VIRAL choc pour manga original qui buzz sur TikTok. Utilise verbe fort, trahison, révélation, numéro chapitre. Exemple: 'Chapitre 12 : Mika vient de TRAHIR tout le monde — et c'était prévu'. Renvoie UNIQUEMENT titre.",
  actualites:
    "Génère un titre VIRAL actu qui perce sur YouTube Shorts : commence par 🚨 ou chiffre choc, curiosity gap, promesse de 3 faits cachés. Max 70 caractères. Renvoie UNIQUEMENT titre.",
  horreur:
    "Génère un titre VIRAL horreur qui fait arrêter le scroll : première personne, heure précise (3h12), promesse d'enregistrement. Exemple: 'Je n'aurais JAMAIS dû ouvrir cette porte à 3h12'. Renvoie UNIQUEMENT titre.",
};

function extractTitle(raw) {
  if (!raw) return "";
  let text = typeof raw === "object" ? (raw.answer || raw.result || JSON.stringify(raw)) : String(raw);
  return text.replace(/```json|```/g, "").replace(/^["']|["']$/g, "").replace(/^Titre\s*:\s*/i, "").trim().split("\n")[0].trim().slice(0, 110);
}

async function callTitleAPI(prompt, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      try {
        const res = await axios.get(DELFA_API_URL, { params: { model: "default", message: prompt }, timeout: 45000, validateStatus: (s) => s < 500 });
        if (res.status < 400) {
          const t = extractTitle(res.data);
          if (t.length >= 8) return t;
        }
      } catch {}
      const res2 = await axios.post(DELFA_API_URL, { model: "default", message: prompt }, { timeout: 45000, headers: { "Content-Type": "application/json" }, validateStatus: (s) => s < 500 });
      if (res2.status < 400) {
        const t = extractTitle(res2.data);
        if (t.length >= 8) return t;
      }
      throw new Error("vide");
    } catch (e) {
      console.warn(`⚠️ titre tentative ${i}/${attempts}: ${e.message}`);
      if (i < attempts) await new Promise((r) => setTimeout(r, i * 1000));
    }
  }
  throw new Error("titre impossible");
}

function applyTemplate(template, vars) {
  let t = template;
  for (const [k, v] of Object.entries(vars)) {
    t = t.replaceAll(`{${k}}`, String(v));
  }
  return t;
}

function generateViralHashtags(themeId, episodeMeta, scriptData) {
  const packs = getHashtagPacks(themeId);
  const viralScore = scriptData.viral_score || 0;
  const core = packs.core;
  const viral = packs.viral;
  const niche = packs.niche;

  // Mix pro pour buzz : 3 core + 3 viral trending + 2 niche + 1 générique FYP
  const selected = [
    ...core.slice(0, 3),
    ...viral.slice(0, 4),
    ...niche.slice(0, 2),
    "#Viral",
  ];

  // Ajoute hashtags dynamiques selon thème
  if (themeId === "dessin_anime" && episodeMeta?.arc) {
    selected.push(`#${episodeMeta.arc.replace(/\s+/g, "")}`);
  }
  if (themeId === "manga") {
    selected.push(`#Chapitre${episodeMeta?.number || ""}`);
  }
  if (themeId === "actualites" && scriptData.script?.[0]) {
    selected.push("#Explication", "#PourComprendre");
  }
  if (viralScore >= 80) selected.push("#BuzzDuJour");

  // Unique + limite 500 chars pour YouTube
  const unique = [...new Set(selected)].slice(0, 12);
  return unique.join(" ");
}

async function main() {
  if (!fs.existsSync("./tmp_data/script_data.json")) {
    console.error("❌ script_data.json manquant");
    process.exit(1);
  }
  const scriptData = JSON.parse(fs.readFileSync("./tmp_data/script_data.json", "utf-8"));
  const themeId = scriptData.theme;
  const mangaEp = scriptData.manga_episode;
  const cartoonEp = scriptData.cartoon_episode;
  const episodeMeta = mangaEp || cartoonEp || {};

  console.log(`🎨 Titre VIRAL pour ${themeId.toUpperCase()} — score viral script: ${scriptData.viral_score || "N/A"}`);

  let title = "";
  const templates = getViralTitleTemplates(themeId);

  try {
    let prompt = themePrompts[themeId] || themePrompts.actualites;
    if (mangaEp) {
      prompt = `${prompt} Chapitre ${mangaEp.number}, série ${mangaEp.series_title}, arc ${mangaEp.arc}. Inclus Chapitre ${mangaEp.number}. Exemples templates qui buzzent: ${templates.slice(0, 2).join(" | ")}`;
    } else if (cartoonEp) {
      prompt = `${prompt} Épisode ${cartoonEp.number}, série ${cartoonEp.series_title}, arc ${cartoonEp.arc}. Inclus Épisode ${cartoonEp.number}. Templates: ${templates.slice(0, 2).join(" | ")}`;
    } else {
      prompt = `${prompt} Contexte: premier segment script: "${scriptData.script?.[0]?.audio_texte || ""}". Templates viraux: ${templates.slice(0, 3).join(" | ")}`;
    }
    title = await callTitleAPI(prompt, 3);
    console.log(`✅ Titre viral API: "${title}"`);
  } catch (e) {
    console.warn(`⚠️ API titre échouée ${e.message}, fallback template viral local`);
    // Fallback template viral
    const tpl = templates[Math.floor(Math.random() * templates.length)];
    const vars = {
      number: episodeMeta.number || Math.floor(Math.random() * 20) + 1,
      next: (episodeMeta.number || 1) + 1,
      character: ["Pomme", "Banane", "Fraise", "Orange"][Math.floor(Math.random() * 4)],
      arc: episodeMeta.arc || episodeMeta.series_title || "Verger",
      sujet: "ce qui vient de se passer",
      lieu: "ici",
      objet: "boîte interdite",
      n: Math.floor(Math.random() * 10) + 2,
      evenement: "tout vient de basculer",
      chiffre: "78%",
      twist: "personne ne l'avait vu venir",
    };
    title = applyTemplate(tpl, vars);
    // Ajoute emoji si pas présent
    if (!/[🍎😱🚨💀]/u.test(title)) {
      const emojis = { dessin_anime: "🍎", manga: "🔥", actualites: "🚨", horreur: "💀" };
      title = `${emojis[themeId] || "🔥"} ${title}`;
    }
    console.log(`🔄 Template fallback viral: "${title}"`);
  }

  // Force inclusion numéro épisode/chapitre si manquant
  if (mangaEp && !new RegExp(`chapitre\\s*${mangaEp.number}`, "i").test(title)) {
    title = `Chapitre ${mangaEp.number} : ${title}`;
  }
  if (cartoonEp && !new RegExp(`[ée]pisode\\s*${cartoonEp.number}`, "i").test(title)) {
    title = `Épisode ${cartoonEp.number} : ${title}`;
  }

  // Nettoie et limite longueur YouTube (100 chars max recommandé pour Shorts)
  if (title.length > 95) title = title.slice(0, 92) + "...";

  const cleanFilename = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .substring(0, 80);

  const hashtags = generateViralHashtags(themeId, episodeMeta, scriptData);
  const filename = `${cleanFilename}_${Date.now()}`;

  console.log(`📁 Fichier: ${filename}`);
  console.log(`#️⃣  Hashtags VIRAL: ${hashtags}`);
  console.log(`🔥 Templates utilisés: ${templates.slice(0,2).join(" | ")}`);

  const metadata = {
    title,
    filename,
    hashtags,
    theme: themeId,
    theme_label: scriptData.theme_label,
    segment_count: scriptData.segment_count,
    viral_score: scriptData.viral_score,
    viral_reasons: scriptData.viral_reasons,
    manga_episode: mangaEp || undefined,
    cartoon_episode: cartoonEp || undefined,
    title_templates_used: templates.slice(0, 3),
    created_at: new Date().toISOString(),
    buzz_optimized: true,
  };

  fs.writeFileSync("./tmp_data/metadata.json", JSON.stringify(metadata, null, 2), "utf-8");
  console.log("✅ Metadata viral sauvegardée");
}

main().catch((err) => {
  console.error("❌ Erreur fatale titre viral:", err.message);
  process.exit(1);
});
