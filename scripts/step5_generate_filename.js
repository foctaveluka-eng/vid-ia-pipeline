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

// Hashtags par thème (fidèle à l'original)
const themeHashtags = {
  ia: ["#AI", "#ArtificialIntelligence", "#MachineLearning", "#Tech", "#Innovation"],
  monde: ["#WorldNews", "#GlobalNews", "#News", "#International", "#CurrentEvents"],
  horreur: ["#Horror", "#Scary", "#CreepyStories", "#Thriller", "#DarkTales"],
};

// Prompts pour la génération de titre par thème
const themePrompts = {
  ia: "Génère un titre de vidéo accrocheur et professionnel en français sur l'intelligence artificielle, la technologie ou l'innovation. Le titre doit être engageant et adapté à YouTube/Facebook. Renvoie UNIQUEMENT le texte du titre, rien d'autre.",
  monde:
    "Génère un titre de vidéo accrocheur et professionnel en français sur l'actualité mondiale ou les événements internationaux récents. Le titre doit être engageant et adapté à YouTube/Facebook. Renvoie UNIQUEMENT le texte du titre, rien d'autre.",
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

  console.log(`🎨 Génération du titre pour le thème : ${theme.toUpperCase()}`);

  let generatedTitle = "";

  try {
    // 2. Appel à l'API Delfa pour générer un titre
    const prompt = themePrompts[theme] || themePrompts.ia;
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
      ia: `Intelligence Artificielle : La Révolution Continue`,
      monde: `Actualité Mondiale : Ce Qui Se Passe En Ce Moment`,
      horreur: `Histoire d'Horreur : La Nuit La Plus Longue`,
    };
    generatedTitle = titresSecours[theme] || titresSecours.ia;
    console.log(`🔄 Titre de secours utilisé : "${generatedTitle}"`);
  }

  // 3. Génération du nom de fichier propre (sans accents ni caractères spéciaux)
  const cleanFilename = generatedTitle
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .substring(0, 100);

  const hashtags = themeHashtags[theme] || themeHashtags.ia;
  const hashtagString = hashtags.join(" ");

  const timestamp = Date.now();
  const filename = `${cleanFilename}_${timestamp}`;

  console.log(`📁 Nom de fichier : ${filename}`);
  console.log(`#️⃣  Hashtags : ${hashtagString}`);

  // 4. Sauvegarde des métadonnées
  const metadata = {
    title: generatedTitle,
    filename: filename,
    hashtags: hashtagString,
    theme: theme,
    created_at: new Date().toISOString(),
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
