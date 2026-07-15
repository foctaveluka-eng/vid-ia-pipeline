/**
 * ÉTAPE 2 — Génération des Images (par packs de 5)
 * Adapté depuis CODE 1 de Pipedream
 *
 * - Lit le script depuis ./tmp_data/script_data.json
 * - Génère les 16 images en parallèle par packs de 5
 * - Sauvegarde dans ./tmp_data/images/
 */

"use strict";

const axios = require("axios");
const fs = require("fs");
const path = require("path");

const IMAGE_API_URL =
  process.env.IMAGE_API_URL || "https://gem-tw6a.onrender.com/generate";

// Fonction utilitaire pour créer une pause
const attendre = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  // 1. Lecture des données du script
  if (!fs.existsSync("./tmp_data/script_data.json")) {
    console.error("❌ Fichier script_data.json introuvable. Lancez d'abord l'étape 1.");
    process.exit(1);
  }

  const scriptData = JSON.parse(
    fs.readFileSync("./tmp_data/script_data.json", "utf-8")
  );
  const segments = scriptData.script;
  const characterDriveUrl = scriptData.character_ref_image;
  const theme = scriptData.theme;

  // 2. Création du dossier d'images
  const imagesFolder = path.join("./tmp_data", "images");
  fs.mkdirSync(imagesFolder, { recursive: true });

  const outputImages = [];
  console.log(`🚀 Génération parallèle (par packs de 5) pour le thème : ${theme}`);

  // 3. Découpage des 16 segments en paquets de 5
  const taillePack = 5;

  for (let i = 0; i < segments.length; i += taillePack) {
    const pack = segments.slice(i, i + taillePack);
    console.log(
      `📦 Traitement du pack d'images de l'index ${i} à ${i + pack.length - 1}...`
    );

    // Création des promesses pour le pack actuel
    const promessesPack = pack.map(async (seg, indexDansPack) => {
      const indexGlobal = i + indexDansPack;
      const indexStr = String(indexGlobal + 1).padStart(2, "0");
      const promptFinal = `Character reference: ${characterDriveUrl}. Action: ${seg.prompt_visuel}.`;
      const pathImage = path.join(imagesFolder, `img_${indexStr}.jpg`);

      // Si l'image existe déjà et n'est pas vide, on la saute
      if (fs.existsSync(pathImage) && fs.statSync(pathImage).size > 0) {
        console.log(`⏭️  Image ${indexStr} déjà présente, passage suivant.`);
        outputImages.push(pathImage);
        return;
      }

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
        outputImages.push(pathImage);
        console.log(`✅ Image ${indexStr} générée.`);
      } catch (err) {
        console.error(`❌ Échec Image ${indexStr}:`, err.message);
      }
    });

    // Lancement du pack en simultané
    await Promise.all(promessesPack);

    // Pause d'une seconde avant le prochain pack (sauf si c'est le dernier)
    if (i + taillePack < segments.length) {
      console.log("⏱️  Pause de 1 seconde avant le prochain groupe...");
      await attendre(1000);
    }
  }

  console.log(`\n🎉 Génération parallèle terminée ! ${outputImages.length}/16 images créées.`);
  console.log(`📁 Dossier : ${imagesFolder}`);

  // 4. Sauvegarde de la liste d'images pour les étapes suivantes
  const imagesInfo = {
    folder: imagesFolder,
    totalFiles: outputImages.length,
    imagesList: outputImages.sort(),
  };
  fs.writeFileSync(
    "./tmp_data/images_info.json",
    JSON.stringify(imagesInfo, null, 2),
    "utf-8"
  );
}

main().catch((err) => {
  console.error("❌ Erreur fatale :", err.message);
  process.exit(1);
});
