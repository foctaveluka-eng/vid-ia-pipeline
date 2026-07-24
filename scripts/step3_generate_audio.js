/**
 * ÉTAPE 3 — Génération des Audios TTS (Google Translate)
 * Adapté depuis CODE 3 de Pipedream
 *
 * - Lit le script depuis ./tmp_data/script_data.json
 * - Génère les 16 audios MP3 en parallèle par packs de 5
 * - Sauvegarde dans ./tmp_data/audio/
 */

"use strict";

const axios = require("axios");
const fs = require("fs");
const path = require("path");

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
  const theme = scriptData.theme;

  // 2. Création du dossier audio
  const audioFolder = path.join("./tmp_data", "audio");
  fs.mkdirSync(audioFolder, { recursive: true });

  console.log(`🚀 [GOOGLE TTS VAGUE 1] Génération parallèle pour le thème : ${theme}`);

  const taillePack = 5;

  for (let i = 0; i < segments.length; i += taillePack) {
    const pack = segments.slice(i, i + taillePack);

    const promessesPack = pack.map(async (seg, indexDansPack) => {
      const indexGlobal = i + indexDansPack;
      const indexStr = String(indexGlobal + 1).padStart(3, "0");
      const pathAudio = path.join(audioFolder, `audio_${indexStr}.mp3`);

      // Si le fichier audio existe déjà et n'est pas vide, on passe
      if (fs.existsSync(pathAudio) && fs.statSync(pathAudio).size > 0) {
        console.log(`⏭️  Audio ${indexStr} déjà présent, passage suivant.`);
        return;
      }

      try {
        // Utilisation de l'API de synthèse vocale officielle et gratuite de Google
        const urlTTS = `https://translate.google.com/translate_tts?ie=UTF-8&tl=fr&client=tw-ob&q=${encodeURIComponent(seg.audio_texte)}`;

        const response = await axios.get(urlTTS, {
          responseType: "arraybuffer",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          timeout: 30000,
        });

        fs.writeFileSync(pathAudio, response.data);
        console.log(`✅ Audio ${indexStr} généré.`);
      } catch (err) {
        console.error(`❌ Échec initial Audio ${indexStr}:`, err.message);
      }
    });

    await Promise.all(promessesPack);
    if (i + taillePack < segments.length) {
      console.log("⏱️  Pause de 1 seconde avant le prochain groupe...");
      await attendre(1000);
    }
  }

  // 3. Collecte des audios générés
  const files = fs.readdirSync(audioFolder);
  const audiosGeneres = files
    .filter((f) => f.startsWith("audio_") && f.endsWith(".mp3"))
    .map((f) => path.join(audioFolder, f))
    .filter((p) => fs.statSync(p).size > 0)
    .sort();

  console.log(`\n🎉 Génération TTS terminée ! ${audiosGeneres.length}/${segments.length} audios créés.`);

  // 4. Sauvegarde des informations audio
  const audioInfo = {
    folder: audioFolder,
    totalAudios: audiosGeneres.length,
    audiosList: audiosGeneres,
  };
  fs.writeFileSync(
    "./tmp_data/audio_info.json",
    JSON.stringify(audioInfo, null, 2),
    "utf-8"
  );
}

main().catch((err) => {
  console.error("❌ Erreur fatale :", err.message);
  process.exit(1);
});
