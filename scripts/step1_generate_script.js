/**
 * ÉTAPE 1 — Génération du Script IA (16 segments)
 * Adapté depuis le CODE initial de Pipedream
 *
 * - Détermine le thème selon l'heure (IA / Monde / Horreur)
 * - Appelle l'API Delfa pour générer le script
 * - Sauvegarde dans ./tmp_data/script_data.json
 */

"use strict";

const axios = require("axios");
const fs = require("fs");
const path = require("path");

const DELFA_API_URL =
  process.env.DELFA_API_URL || "https://delfaapiai.vercel.app/ai/copilot";

// ──────────────────────────────────────────────────────────
// 1. Récupérer l'heure actuelle en Europe (UTC+2)
// ──────────────────────────────────────────────────────────
const maintenant = new Date();
const heure = maintenant.getUTCHours() + 2;

let themeType = "";
let themePrompt = "";
let characterDriveUrl = "";
let styleConsignes = "";

// ──────────────────────────────────────────────────────────
// 2. Attribution du thème, du personnage ET des consignes de storytelling
// ──────────────────────────────────────────────────────────
if (heure >= 4 && heure < 12) {
  themeType = "ia";
  themePrompt =
    "les dernières actualités marquantes et insolites sur l'Intelligence Artificielle.";
  characterDriveUrl =
    "https://drive.google.com/file/d/1Xa9ZzRhqWgEFlJxGAf-vF2fGDG2_LEQU/view?usp=drivesdk";
  styleConsignes =
    "Règles absolues de storytelling Tech :\n1. Ne fais pas un rapport de presse. Raconte cela comme une révolution ou un thriller technologique en cours.\n2. Implique l'auditeur directement (en utilisant 'Tu' ou 'Imagine') ou raconte-le comme un témoin direct.\n3. Utilise un ton dynamique et mystérieux pour susciter la curiosité (ex: 'Ce que cette IA vient de faire va tout changer...', 'Personne n'était prêt pour ça'). Chaque segment doit donner envie de connaître la suite.";
} else if (heure >= 12 && heure < 20) {
  themeType = "monde";
  themePrompt =
    "un fait marquant, surprenant et réel de l'actualité mondiale d'aujourd'hui.";
  characterDriveUrl =
    "https://drive.google.com/file/d/1Ctkfr9FYAMg6bnrK_GwnGmzmSylvTQLt/view?usp=drivesdk";
  styleConsignes =
    "Règles absolues de storytelling Actu :\n1. Raconte l'événement comme un récit d'aventure, un mystère ou un drame en direct, pas comme un article de journal.\n2. Crée une tension narrative immédiate dès le premier segment.\n3. Mets en avant l'insolite, le choc et l'inattendu. Utilise des verbes d'action puissants et des cliffhangers à chaque phrase pour maintenir l'auditeur scotché.";
} else {
  themeType = "horreur";
  themePrompt =
    "une histoire d'horreur courte, terrifiante, sombre et parfaitement linéaire.";
  characterDriveUrl =
    "https://drive.google.com/file/d/1nDd0wnr59QHOTZKuA9ccovEt5psl5HQ_/view?usp=drivesdk";
  styleConsignes =
    "Règles absolues de storytelling d'horreur :\n1. Écris TOUJOURS à la première personne du singulier ('Je') pour une immersion totale.\n2. Ne liste pas des actions froides. Raconte ce que le personnage ressent face au danger, l'ambiance lourde et l'angoisse (vocabulaire sensoriel : frisson, glacé, tétanisé, oppressant).\n3. Tension maximale : Chaque phrase doit se terminer sur une menace ou un suspense insoutenable.";
}

// ──────────────────────────────────────────────────────────
// 3. Prompt global pour forcer la structure narrative en 16 morceaux
// ──────────────────────────────────────────────────────────
const systemInstructions = `Tu es un scénariste expert en vidéos courtes verticales (TikTok, Shorts). Ton but est de maximiser la rétention en créant un vrai récit captivant. 
Génère un script sur : ${themePrompt}.

${styleConsignes}

Consignes de format communes :
- Divise obligatoirement le récit en exactement 16 segments chronologiques.
- Chaque phrase d'audio ('audio_texte') doit être très courte (10 à 18 mots maximum), rythmée, fluide et taillée pour l'oral.
- Le 'prompt_visuel' doit décrire de manière précise l'action physique ou l'ambiance visuelle qui illustre la phrase à l'écran.

Renvoie UNIQUEMENT un objet JSON valide avec cette structure exacte, sans texte avant ou après :
{
  "segments": [
    {
      "id": 1,
      "audio_texte": "La phrase ultra-captivante de ce segment.",
      "prompt_visuel": "La description de la scène visuelle pour illustrer ce segment."
    }
  ]
}`;

// ──────────────────────────────────────────────────────────
// 4. Appel à l'API Delfa et sauvegarde du résultat
// ──────────────────────────────────────────────────────────
async function main() {
  console.log(`🤖 [${themeType.toUpperCase()}] Envoi à Delfa API... (heure: ${heure}h UTC+2)`);

  try {
    const response = await axios.get(DELFA_API_URL, {
      params: { model: "default", message: systemInstructions },
      timeout: 60000,
    });

    const cleanJsonText = response.data.answer
      .replace(/```json|```/g, "")
      .trim();
    const scriptDonnees = JSON.parse(cleanJsonText);

    if (!scriptDonnees.segments || scriptDonnees.segments.length !== 16) {
      throw new Error(
        `Le script ne contient pas exactement 16 segments (reçu: ${scriptDonnees.segments?.length ?? 0})`
      );
    }

    const output = {
      theme: themeType,
      character_ref_image: characterDriveUrl,
      script: scriptDonnees.segments,
      generated_at: new Date().toISOString(),
    };

    // Sauvegarde du résultat pour les étapes suivantes
    fs.mkdirSync("./tmp_data", { recursive: true });
    fs.writeFileSync(
      "./tmp_data/script_data.json",
      JSON.stringify(output, null, 2),
      "utf-8"
    );

    console.log(
      `✅ Script généré avec succès ! Thème: ${themeType}, Segments: ${scriptDonnees.segments.length}`
    );
    console.log("📄 Aperçu du premier segment :");
    console.log(
      `   Audio : "${scriptDonnees.segments[0].audio_texte}"`
    );
    console.log(
      `   Visuel: "${scriptDonnees.segments[0].prompt_visuel}"`
    );
  } catch (error) {
    console.error("❌ Erreur lors de la génération du script :", error.message);
    process.exit(1);
  }
}

main();
