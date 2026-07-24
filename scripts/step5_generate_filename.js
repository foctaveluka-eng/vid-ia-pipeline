/**
 * ÉTAPE 5 — Génération du Titre, Nom de Fichier et Hashtags - Version robuste
 * - Lit le thème depuis ./tmp_data/script_data.json
 * - Génère un titre accrocheur via l'API Delfa avec retry GET/POST
 * - Sauvegarde dans ./tmp_data/metadata.json
 */

"use strict";

const axios = require("axios");
const fs = require("fs");

const DELFA_API_URL =
  process.env.DELFA_API_URL || "https://delfaapiai.vercel.app/ai/copilot";

// Hashtags par thème
const themeHashtags = {
  dessin_anime: ["#DessinAnime", "#Enfants", "#FruitsMagiques", "#VergerMagique", "#HistoiresPourEnfants", "#Animation"],
  manga: ["#Manga", "#MangaFr", "#OriginalStory", "#AnimeStyle", "#Storytelling"],
  actualites: ["#Actualites", "#Info", "#Monde", "#News", "#International", "#Journalisme"],
  horreur: ["#Horror", "#Scary", "#CreepyStories", "#Thriller", "#DarkTales"],
};

// Prompts pour la génération de titre par thème
const themePrompts = {
  dessin_anime:
    "Génère un titre de dessin animé accrocheur et amusant en français pour enfants. Le titre doit être joyeux, intrigant et adapté aux 6-12 ans. Inclus le numéro d'épisode. Renvoie UNIQUEMENT le texte du titre.",
  manga:
    "Génère un titre français mémorable pour un manga original racontant une histoire complète. Le titre est court, sans référence à une franchise existante. Renvoie UNIQUEMENT le texte du titre.",
  actualites:
    "Génère un titre de vidéo professionnel en français pour un bulletin d'actualité sur un fait international vérifiable. Le titre doit être précis, factuel et engageant. Renvoie UNIQUEMENT le texte du titre.",
  horreur:
    "Génère un titre de vidéo accrocheur et professionnel en français sur l'horreur, les histoires effrayantes ou le thriller. Le titre doit être engageant et adapté à YouTube/Facebook. Renvoie UNIQUEMENT le texte du titre, rien d'autre.",
};

function extractTitle(raw) {
  if (!raw) return "";
  let text = String(raw).trim();
  // Si c'est un objet avec answer
  if (typeof raw === "object") {
    if (raw.answer) text = String(raw.answer);
    else if (raw.result) text = String(raw.result);
    else text = JSON.stringify(raw);
  }
  return text
    .replace(/```json|```/g, "")
    .replace(/^["']|["']$/g, "")
    .replace(/^Titre\s*:\s*/i, "")
    .trim()
    .split("\n")[0]
    .trim()
    .slice(0, 120);
}

async function callTitleAPI(prompt, maxAttempts = 3) {
  const paramMessage = prompt;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Essai GET
      try {
        const res = await axios.get(DELFA_API_URL, {
          params: { model: "default", message: paramMessage },
          timeout: 45000,
          validateStatus: (s) => s < 500,
        });
        if (res.status < 400 && res.data) {
          const title = extractTitle(res.data);
          if (title && title.length >= 5) return title;
        }
      } catch {}

      // Fallback POST
      const res2 = await axios.post(
        DELFA_API_URL,
        { model: "default", message: paramMessage },
        { timeout: 45000, headers: { "Content-Type": "application/json" }, validateStatus: (s) => s < 500 }
      );
      if (res2.status < 400 && res2.data) {
        const title = extractTitle(res2.data);
        if (title && title.length >= 5) return title;
      }
      throw new Error("Titre vide");
    } catch (err) {
      console.warn(`⚠️ Tentative titre ${attempt}/${maxAttempts}: ${err.message}`);
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
  throw new Error("Impossible de générer le titre après retries");
}

async function main() {
  if (!fs.existsSync("./tmp_data/script_data.json")) {
    console.error("❌ Fichier script_data.json introuvable.");
    process.exit(1);
  }

  const scriptData = JSON.parse(fs.readFileSync("./tmp_data/script_data.json", "utf-8"));
  const theme = scriptData.theme;
  const mangaEpisode = scriptData.manga_episode;
  const cartoonEpisode = scriptData.cartoon_episode;

  console.log(`🎨 Génération du titre pour le thème : ${theme.toUpperCase()}`);

  let generatedTitle = "";

  try {
    let basePrompt = themePrompts[theme] || themePrompts.actualites;
    let prompt = basePrompt;

    if (mangaEpisode) {
      prompt = `${basePrompt} La vidéo est le chapitre ${mangaEpisode.number} de « ${mangaEpisode.series_title} », arc « ${mangaEpisode.arc} ». Inclus « Chapitre ${mangaEpisode.number} » dans le titre.`;
    } else if (cartoonEpisode) {
      prompt = `${basePrompt} La vidéo est l'épisode ${cartoonEpisode.number} de « ${cartoonEpisode.series_title} », arc « ${cartoonEpisode.arc} ». Inclus « Épisode ${cartoonEpisode.number} » dans le titre.`;
    }

    generatedTitle = await callTitleAPI(prompt, 3);
    console.log(`✅ Titre généré : "${generatedTitle}"`);
  } catch (err) {
    console.warn(`⚠️  Impossible de générer le titre via l'API : ${err.message}`);
    const titresSecours = {
      dessin_anime: `Les Aventures du Verger Magique — Épisode ${cartoonEpisode?.number || "Nouveau"} : Le Mystère du Verger`,
      manga: `Les Veilleurs d'Obsidienne — Chapitre ${mangaEpisode?.number || "Nouveau"} : L'Encre qui s'efface`,
      actualites: `Actualités du Monde : Ce Qui Se Passe En Ce Moment — ${new Date().toLocaleDateString("fr-FR")}`,
      horreur: `Histoire d'Horreur : La Nuit La Plus Longue`,
    };
    generatedTitle = titresSecours[theme] || titresSecours.actualites;
    console.log(`🔄 Titre de secours utilisé : "${generatedTitle}"`);
  }

  if (mangaEpisode && !new RegExp(`chapitre\\s*${mangaEpisode.number}`, "i").test(generatedTitle)) {
    generatedTitle = `Les Veilleurs d'Obsidienne — Chapitre ${mangaEpisode.number} : ${generatedTitle}`;
  }
  if (cartoonEpisode && !new RegExp(`[ée]pisode\\s*${cartoonEpisode.number}`, "i").test(generatedTitle)) {
    generatedTitle = `Les Aventures du Verger Magique — Épisode ${cartoonEpisode.number} : ${generatedTitle}`;
  }

  const cleanFilename = generatedTitle
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .substring(0, 100);

  const hashtags = themeHashtags[theme] || themeHashtags.actualites;
  const hashtagString = hashtags.join(" ");

  const timestamp = Date.now();
  const filename = `${cleanFilename}_${timestamp}`;

  console.log(`📁 Nom de fichier : ${filename}`);
  console.log(`#️⃣  Hashtags : ${hashtagString}`);

  const metadata = {
    title: generatedTitle,
    filename: filename,
    hashtags: hashtagString,
    theme: theme,
    theme_label: scriptData.theme_label,
    segment_count: scriptData.segment_count,
    manga_episode: mangaEpisode || undefined,
    cartoon_episode: cartoonEpisode || undefined,
    created_at: new Date().toISOString(),
    source_file: "script_data.json",
  };

  fs.writeFileSync("./tmp_data/metadata.json", JSON.stringify(metadata, null, 2), "utf-8");
  console.log("✅ Métadonnées sauvegardées dans ./tmp_data/metadata.json");
}

main().catch((err) => {
  console.error("❌ Erreur fatale :", err.message);
  process.exit(1);
});
