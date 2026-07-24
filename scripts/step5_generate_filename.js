/**
 * ÉTAPE 5 — Génération du Titre, Nom de Fichier et Hashtags
 * Adapté depuis GENERATE FILE NAME de Pipedream
 *
 * - Lit le thème depuis ./tmp_data/script_data.json
 * - Génère un titre accrocheur via l'API Delfa (remplace GPT-4o)
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
  actualites: ["#Actualites", "#Info", "#Monde", "#News", "International", "#Journalisme"],
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

async function main() {
  // 1. Lecture du thème depuis le script généré
  if (!fs.existsSync("./tmp_data/script_data.json")) {
    console.error("❌ Fichier script_data.json introuvable.");
    process.exit(1);
  }

  const scriptData = JSON.parse(
    fs.readFileSync("./tmp_data/script_data.json", "utf-8")
  );
  const theme = scriptData.theme;
  const mangaEpisode = scriptData.manga_episode;
  const cartoonEpisode = scriptData.cartoon_episode;

  console.log(`🎨 Génération du titre pour le thème : ${theme.toUpperCase()}`);

  let generatedTitle = "";

  try {
    // 2. Appel à l'API Delfa pour générer un titre
    let basePrompt = themePrompts[theme] || themePrompts.actualites;
    let prompt = basePrompt;

    if (mangaEpisode) {
      prompt = `${basePrompt} La vidéo est le chapitre ${mangaEpisode.number} de « ${mangaEpisode.series_title} », arc « ${mangaEpisode.arc} ». Inclus « Chapitre ${mangaEpisode.number} » dans le titre.`;
    } else if (cartoonEpisode) {
      prompt = `${basePrompt} La vidéo est l'épisode ${cartoonEpisode.number} de « ${cartoonEpisode.series_title} », arc « ${cartoonEpisode.arc} ». Inclus « Épisode ${cartoonEpisode.number} » dans le titre.`;
    }

    const response = await axios.get(DELFA_API_URL, {
      params: { model: "default", message: prompt },
      timeout: 30000,
    });

    generatedTitle = response.data.answer
      .replace(/```json|```/g, "")
      .replace(/['"]/g, "")
      .trim();

    console.log(`✅ Titre généré : "${generatedTitle}"`);
  } catch (err) {
    console.warn(
      `⚠️  Impossible de générer le titre via l'API : ${err.message}`
    );
    // Titre de secours
    const titresSecours = {
      dessin_anime: `Les Aventures du Verger Magique — Nouvel Épisode`,
      manga: `Les Veilleurs d'Obsidienne — Le Dernier Chapitre`,
      actualites: `Actualités du Monde : Ce Qui Se Passe En Ce Moment`,
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

  // 3. Génération du nom de fichier propre (sans accents ni caractères spéciaux)
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

  // 4. Sauvegarde des métadonnées enrichies
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

  fs.writeFileSync(
    "./tmp_data/metadata.json",
    JSON.stringify(metadata, null, 2),
    "utf-8"
  );

  console.log("✅ Métadonnées sauvegardées dans ./tmp_data/metadata.json");
}

main().catch((err) => {
  console.error("❌ Erreur fatale :", err.message);
  process.exit(1);
});
