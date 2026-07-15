/**
 * ÉTAPE 2b — Vérification et Correction des Images Manquantes
 * VERSION INCASSABLE (Anti-plantage)
 *
 * - Scanne le dossier ./tmp_data/images/ pour détecter les images manquantes ou vides
 * - Régénère uniquement les images manquantes avec un système de Retry (3 tentatives)
 * - Si l'API échoue de manière persistante (code 500, etc.), duplique l'image précédente
 *   ou suivante pour éviter de bloquer le pipeline vidéo.
 */

"use strict";

const axios = require("axios");
const fs = require("fs");
const path = require("path");

const IMAGE_API_URL =
  process.env.IMAGE_API_URL || "https://gem-tw6a.onrender.com/generate";

const attendre = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Fonction de génération d'image avec système de Retry (3 tentatives)
async function genererImageAvecRetry(promptFinal, pathImage, maxRetries = 3) {
  for (let essai = 1; essai <= maxRetries; essai++) {
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
      return true;
    } catch (err) {
      console.warn(
        `   ⚠️ [Essai ${essai}/${maxRetries}] Échec génération : ${err.message}`
      );
      if (essai < maxRetries) {
        // Pause plus longue à chaque échec (backoff)
        await attendre(essai * 3000);
      }
    }
  }
  return false;
}

async function main() {
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

  console.log(`🔍 [VÉRIFICATION IMAGES] Analyse du dossier pour le thème : ${theme}`);

  let manquants = [];

  // 1. Scanner pour trouver les images manquantes ou vides
  for (let i = 0; i < segments.length; i++) {
    const indexStr = String(i + 1).padStart(2, "0");
    const pathImage = path.join(imagesFolder, `img_${indexStr}.jpg`);

    if (!fs.existsSync(pathImage) || fs.statSync(pathImage).size === 0) {
      manquants.push({ indexGlobal: i, indexStr, seg: segments[i] });
    }
  }

  // 2. Tenter de régénérer les images manquantes
  if (manquants.length > 0) {
    console.log(
      `⚠️  Alerte : ${manquants.length} image(s) manquante(s) ou vide(s). Tentative de génération de secours...`
    );

    for (const item of manquants) {
      const promptFinal = `Character reference: ${characterDriveUrl}. Action: ${item.seg.prompt_visuel}.`;
      const pathImage = path.join(imagesFolder, `img_${item.indexStr}.jpg`);

      console.log(`🔄 Génération de secours pour l'image ${item.indexStr}...`);
      const succes = await genererImageAvecRetry(promptFinal, pathImage, 3);

      if (succes) {
        console.log(`🎯 Image ${item.indexStr} corrigée avec succès !`);
      } else {
        console.error(
          `🚨 Échec persistant de l'API sur l'image ${item.indexStr} après retries.`
        );

        // STRATÉGIE DE SAUVEGARDE : Dupliquer l'image voisine pour éviter d'arrêter le pipeline
        console.log(`💡 Application de la stratégie de secours : duplication de l'image voisine...`);
        let imageSource = null;

        // On cherche une image existante (de préférence la précédente)
        for (let offset = -1; offset <= segments.length; offset++) {
          const indexVoisin = item.indexGlobal + offset;
          if (indexVoisin >= 0 && indexVoisin < segments.length) {
            const voisinStr = String(indexVoisin + 1).padStart(2, "0");
            const pathVoisin = path.join(imagesFolder, `img_${voisinStr}.jpg`);
            if (fs.existsSync(pathVoisin) && fs.statSync(pathVoisin).size > 0 && voisinStr !== item.indexStr) {
              imageSource = pathVoisin;
              break;
            }
          }
        }

        if (imageSource) {
          try {
            fs.copyFileSync(imageSource, pathImage);
            console.log(
              `✅ Image ${item.indexStr} créée par duplication de "${path.basename(imageSource)}".`
            );
          } catch (copyErr) {
            console.error(`❌ Échec de la duplication : ${copyErr.message}`);
          }
        } else {
          console.error(`❌ Impossible de trouver une image existante pour la dupliquer.`);
        }
      }
      await attendre(1000);
    }
  } else {
    console.log("🎉 Parfait ! Toutes les images sont déjà présentes.");
  }

  // 3. Collecter la liste finale
  let imagesFinales = [];
  for (let i = 0; i < segments.length; i++) {
    const indexStr = String(i + 1).padStart(2, "0");
    const pathImage = path.join(imagesFolder, `img_${indexStr}.jpg`);
    if (fs.existsSync(pathImage) && fs.statSync(pathImage).size > 0) {
      imagesFinales.push(pathImage);
    }
  }

  imagesFinales.sort();

  console.log(`\n🏁 Résultat final : ${imagesFinales.length}/16 images prêtes pour le montage.`);

  // Sauvegarde des informations
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

  // Sécurité ultime : Si vraiment aucune image n'existe (par exemple API totalement coupée dès le départ)
  if (imagesFinales.length === 0) {
    console.error("❌ Erreur critique : Aucune image valide dans le dossier. Impossible de continuer.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Erreur fatale :", err.message);
  process.exit(1);
});
