/**
 * ÉTAPE 3 — Génération des Audios TTS (Google Translate) - Version robuste
 * - Lit le script depuis ./tmp_data/script_data.json
 * - Génère les audios MP3 en parallèle par packs de 5 avec retry
 * - Si TTS échoue, génère un silence via FFmpeg pour ne pas bloquer la vidéo
 */
"use strict";

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const attendre = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function detectFFmpeg() {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    return "ffmpeg";
  } catch {
    try {
      return require("@ffmpeg-installer/ffmpeg").path;
    } catch {
      return null;
    }
  }
}

function generateSilentAudio(filePath, durationSec = 3, ffmpegBin) {
  try {
    if (!ffmpegBin) return false;
    // Génère un mp3 silencieux de durationSec secondes
    const cmd = `"${ffmpegBin}" -y -f lavfi -i "anullsrc=r=44100:cl=mono" -t ${durationSec} -q:a 9 -acodec libmp3lame "${filePath}"`;
    execSync(cmd, { stdio: "ignore", timeout: 15000 });
    return fs.existsSync(filePath) && fs.statSync(filePath).size > 0;
  } catch {
    return false;
  }
}

async function generateTTSWithRetry(text, filePath, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const urlTTS = `https://translate.google.com/translate_tts?ie=UTF-8&tl=fr&client=tw-ob&q=${encodeURIComponent(text)}`;
      const response = await axios.get(urlTTS, {
        responseType: "arraybuffer",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": "https://translate.google.com/",
        },
        timeout: 30000,
        validateStatus: (s) => s < 500,
      });
      if (response.status >= 400) throw new Error(`TTS HTTP ${response.status}`);
      if (!response.data || response.data.byteLength < 100) throw new Error("TTS réponse trop petite");
      fs.writeFileSync(filePath, response.data);
      return true;
    } catch (err) {
      console.warn(`⚠️ TTS essai ${attempt}/${retries} pour ${path.basename(filePath)}: ${err.message}`);
      if (attempt < retries) await attendre(attempt * 1000 + Math.random() * 500);
    }
  }
  return false;
}

async function main() {
  if (!fs.existsSync("./tmp_data/script_data.json")) {
    console.error("❌ Fichier script_data.json introuvable. Lancez d'abord l'étape 1.");
    process.exit(1);
  }

  const scriptData = JSON.parse(fs.readFileSync("./tmp_data/script_data.json", "utf-8"));
  const segments = scriptData.script;
  const theme = scriptData.theme;

  const audioFolder = path.join("./tmp_data", "audio");
  fs.mkdirSync(audioFolder, { recursive: true });
  const ffmpegBin = detectFFmpeg();

  console.log(`🚀 [GOOGLE TTS VAGUE 1] Génération parallèle pour le thème : ${theme} (${segments.length} segments)`);

  const taillePack = 3; // réduit à 3 pour éviter rate-limit Google

  for (let i = 0; i < segments.length; i += taillePack) {
    const pack = segments.slice(i, i + taillePack);

    const promessesPack = pack.map(async (seg, indexDansPack) => {
      const indexGlobal = i + indexDansPack;
      const indexStr = String(indexGlobal + 1).padStart(3, "0");
      const pathAudio = path.join(audioFolder, `audio_${indexStr}.mp3`);

      if (fs.existsSync(pathAudio) && fs.statSync(pathAudio).size > 0) {
        console.log(`⏭️  Audio ${indexStr} déjà présent, passage suivant.`);
        return;
      }

      const ok = await generateTTSWithRetry(seg.audio_texte, pathAudio, 3);
      if (ok) {
        console.log(`✅ Audio ${indexStr} généré.`);
      } else {
        console.error(`❌ Échec TTS Audio ${indexStr} après retries, génération silence fallback...`);
        // Durée approximative : 10-22 mots ~ 3-5s
        const wordCount = seg.audio_texte.split(/\s+/).length;
        const estDuration = Math.max(2.5, Math.min(6, wordCount / 2.2));
        if (generateSilentAudio(pathAudio, estDuration, ffmpegBin)) {
          console.log(`🟡 Silence généré pour ${indexStr} (${estDuration.toFixed(1)}s)`);
        } else {
          console.error(`❌ Impossible de générer même silence pour ${indexStr}`);
        }
      }
    });

    await Promise.all(promessesPack);
    if (i + taillePack < segments.length) {
      console.log("⏱️  Pause de 1.5s avant le prochain groupe...");
      await attendre(1500);
    }
  }

  const files = fs.readdirSync(audioFolder);
  const audiosGeneres = files
    .filter((f) => f.startsWith("audio_") && f.endsWith(".mp3"))
    .map((f) => path.join(audioFolder, f))
    .filter((p) => fs.statSync(p).size > 0)
    .sort();

  console.log(`\n🎉 Génération TTS terminée ! ${audiosGeneres.length}/${segments.length} audios créés.`);

  const audioInfo = {
    folder: audioFolder,
    totalAudios: audiosGeneres.length,
    audiosList: audiosGeneres,
  };
  fs.writeFileSync("./tmp_data/audio_info.json", JSON.stringify(audioInfo, null, 2), "utf-8");

  if (audiosGeneres.length === 0) {
    console.error("❌ Aucun audio généré, même avec fallback silence.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Erreur fatale :", err.message);
  process.exit(1);
});
