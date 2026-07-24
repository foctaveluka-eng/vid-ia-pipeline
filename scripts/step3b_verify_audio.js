/**
 * ÉTAPE 3b — Vérification et Correction des Audios Manquants
 * Adapté depuis CODE 4 de Pipedream
 *
 * - Vérifie que tous les fichiers audio MP3 existent et ne sont pas vides
 * - Régénère uniquement les audios manquants via Google TTS
 * - Met à jour ./tmp_data/audio_info.json
 */

"use strict";

const axios = require("axios");
const fs = require("fs");
const path = require("path");

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

  const audioFolder = path.join("./tmp_data", "audio");
  fs.mkdirSync(audioFolder, { recursive: true });

  console.log(`🔍 [BLOC VÉRIFICATION AUDIO] Analyse des fichiers du dossier...`);

  let manquants = [];

  // 2. Scan des 16 fichiers audio attendus
  for (let i = 0; i < segments.length; i++) {
    const indexStr = String(i + 1).padStart(3, "0");
    const pathAudio = path.join(audioFolder, `audio_${indexStr}.mp3`);

    if (!fs.existsSync(pathAudio) || fs.statSync(pathAudio).size === 0) {
      manquants.push({ indexStr, seg: segments[i] });
    }
  }

  // 3. Regénération des audios manquants
  if (manquants.length > 0) {
    console.log(
      `⚠️  Alerte : ${manquants.length} audio(s) manquant(s). Lancement de la récupération...`
    );

    for (const item of manquants) {
      const pathAudio = path.join(audioFolder, `audio_${item.indexStr}.mp3`);
      console.log(`🔄 Génération de secours pour l'audio ${item.indexStr}...`);

      try {
        const urlTTS = `https://translate.google.com/translate_tts?ie=UTF-8&tl=fr&client=tw-ob&q=${encodeURIComponent(item.seg.audio_texte)}`;

        const response = await axios.get(urlTTS, {
          responseType: "arraybuffer",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          timeout: 30000,
        });

        fs.writeFileSync(pathAudio, response.data);
        console.log(`🎯 Audio ${item.indexStr} corrigé avec succès !`);
      } catch (err) {
        console.error(
          `🚨 Échec critique sur l'audio ${item.indexStr}:`,
          err.message
        );
      }

      await attendre(1500);
    }
  } else {
    console.log("🎉 Parfait ! Tous les fichiers audios sont au complet et valides.");
  }

  // 4. Collecte finale de tous les audios valides
  const files = fs.readdirSync(audioFolder);
  const audiosFinaux = files
    .filter((f) => f.startsWith("audio_") && f.endsWith(".mp3"))
    .map((f) => path.join(audioFolder, f))
    .filter((p) => fs.existsSync(p) && fs.statSync(p).size > 0)
    .sort();

  console.log(`\n✅ Vérification terminée : ${audiosFinaux.length}/${segments.length} fichiers audio collectés.`);

  // 5. Mise à jour du fichier d'information
  const audioInfo = {
    folder: audioFolder,
    totalAudios: audiosFinaux.length,
    audiosList: audiosFinaux,
  };
  fs.writeFileSync(
    "./tmp_data/audio_info.json",
    JSON.stringify(audioInfo, null, 2),
    "utf-8"
  );

  if (audiosFinaux.length < segments.length) {
    console.error(
      `❌ Impossible de continuer : seulement ${audiosFinaux.length}/${segments.length} audios disponibles.`
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Erreur fatale :", err.message);
  process.exit(1);
});
