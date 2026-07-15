/**
 * ÉTAPE 2b — Vérification et Correction des Images Manquantes
 * Adapté depuis CODE 2 de Pipedream
 *
 * - Scanne le dossier ./tmp_data/images/ pour détecter les images manquantes ou vides
 * - Régénère uniquement les images manquantes
 * - Met à jour ./tmp_data/images_info.json
 */

"use strict";

const axios = require("axios");
const fs = require("fs");
const path = require("path");

const IMAGE_API_URL =
  process.env.IMAGE_API_URL || "https://gem-tw6a.onrender.com/generate";

const attendre = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  // 1. Lecture des données du script
  if (!fs.existsSync("./tmp_data/script_data.json")) {
    console.error("❌ Fichier script_data.json introuvable.");
    process.exit(1);
  }

  const scriptData = JSON.parse(
    fs.readFileSync("./tmp_data/script_data.json", "utf-8")
  );
  const segments = scriptData.script;
  const characterDriveUrl = scriptData.character_ref_image;
  const theme = scriptData.theme;

  const imagesFolder = path.join("./tmp_data", "images");
  fs.mkdirSync(imagesFolder, { recursive: true });

  console.log(`🔍 [BLOC VÉRIFICATION] Analyse du dossier pour le thème : ${theme}`);

  let imagesFinales = [];
  let manquants = [];

  // 2. Scanner le dossier pour voir quels index (de 01 à 16) manquent à l'appel
  for (let i = 0; i < segments.length; i++) {
    const indexStr = String(i + 1).padStart(2, "0");
    const pathImage = path.join(imagesFolder, `img_${indexStr}.jpg`);

    if (!fs.existsSync(pathImage) || fs.statSync(pathImage).size === 0) {
      manquants.push({ indexStr, seg: segments[i] });
    } else {
      imagesFinales.push(pathImage);
    }
  }

  // 3. Génération ciblée des images manquantes ou corrompues
  if (manquants.length > 0) {
    console.log(
      `⚠️  Alerte : ${manquants.length} image(s) manquante(s) détectée(s). Lancement de la génération de secours...`
    );

    for (const item of manquants) {
      const promptFinal = `Character reference: ${characterDriveUrl}. Action: ${item.seg.prompt_visuel}.`;
      const pathImage = path.join(imagesFolder, `img_${item.indexStr}.jpg`);

      console.log(`🔄 Génération de secours pour l'image ${item.indexStr}...`);
      try {
        const response = await axios.post(
          IMAGE_API_URL,
          {
            prompt: promptFinal,
            ratio: "9:16",
            format: "jpg",
          },
          {
            responseType: "arraybuffer",
            timeout: 90000,
          }
        );

        fs.writeFileSync(pathImage, response.data);
        imagesFinales.push(pathImage);
        console.log(`🎯 Image ${item.indexStr} corrigée et enregistrée !`);
      } catch (err) {
        console.error(
          `🚨 Échec persistant sur l'image ${item.indexStr}:`,
          err.message
        );
      }

      // Pause de sécurité pour ne pas surcharger l'API
      await attendre(1500);
    }
  } else {
    console.log(
      "🎉 Parfait ! Les 16 images sont bien présentes et complètes dans le dossier."
    );
  }

  // Réorganisation de la liste par ordre alphabétique strict (img_01, img_02...)
  imagesFinales.sort();

  console.log(`\n✅ Vérification terminée : ${imagesFinales.length}/16 images valides.`);

  // 4. Mise à jour du fichier d'information
  const imagesInfo = {
    folder: imagesFolder,
    totalFiles: imagesFinales.length,
    imagesList: imagesFinales,
  };
  fs.writeFileSync(
    "./tmp_data/images_info.json",
    JSON.stringify(imagesInfo, null, 2),
    "utf-8"
  );

  if (imagesFinales.length < 16) {
    console.error(
      `❌ Impossible de continuer : seulement ${imagesFinales.length}/16 images disponibles.`
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Erreur fatale :", err.message);
  process.exit(1);
});
