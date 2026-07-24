/**
 * ÉTAPE 3b — Vérification et Correction des Audios Manquants - Version robuste
 * - Vérifie que tous les fichiers audio MP3 existent et ne sont pas vides
 * - Régénère uniquement les audios manquants via Google TTS + fallback silence FFmpeg
 * - Met à jour ./tmp_data/audio_info.json
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
          Referer: "https://translate.google.com/",
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
    console.error("❌ Fichier script_data.json introuvable.");
    process.exit(1);
  }

  const scriptData = JSON.parse(fs.readFileSync("./tmp_data/script_data.json", "utf-8"));
  const segments = scriptData.script;

  const audioFolder = path.join("./tmp_data", "audio");
  fs.mkdirSync(audioFolder, { recursive: true });
  const ffmpegBin = detectFFmpeg();

  console.log(`🔍 [BLOC VÉRIFICATION AUDIO] Analyse des fichiers du dossier...`);

  let manquants = [];

  for (let i = 0; i < segments.length; i++) {
    const indexStr = String(i + 1).padStart(3, "0");
    const pathAudio = path.join(audioFolder, `audio_${indexStr}.mp3`);
    if (!fs.existsSync(pathAudio) || fs.statSync(pathAudio).size === 0) {
      manquants.push({ indexStr, seg: segments[i] });
    }
  }

  if (manquants.length > 0) {
    console.log(`⚠️  Alerte : ${manquants.length} audio(s) manquant(s). Lancement de la récupération...`);

    for (const item of manquants) {
      const pathAudio = path.join(audioFolder, `audio_${item.indexStr}.mp3`);
      console.log(`🔄 Génération de secours pour l'audio ${item.indexStr}...`);

      const ok = await generateTTSWithRetry(item.seg.audio_texte, pathAudio, 3);
      if (ok) {
        console.log(`🎯 Audio ${item.indexStr} corrigé avec succès !`);
      } else {
        console.warn(`🚨 Échec TTS ${item.indexStr}, génération silence fallback...`);
        const wordCount = item.seg.audio_texte.split(/\s+/).length;
        const estDuration = Math.max(2.5, Math.min(6, wordCount / 2.2));
        if (generateSilentAudio(pathAudio, estDuration, ffmpegBin)) {
          console.log(`🟡 Silence généré pour ${item.indexStr} (${estDuration.toFixed(1)}s)`);
        } else {
          console.error(`🚨 Impossible de générer même silence pour ${item.indexStr}`);
        }
      }
      await attendre(1500);
    }
  } else {
    console.log("🎉 Parfait ! Tous les fichiers audios sont au complet et valides.");
  }

  const files = fs.readdirSync(audioFolder);
  const audiosFinaux = files
    .filter((f) => f.startsWith("audio_") && f.endsWith(".mp3"))
    .map((f) => path.join(audioFolder, f))
    .filter((p) => fs.existsSync(p) && fs.statSync(p).size > 0)
    .sort();

  console.log(`\n✅ Vérification terminée : ${audiosFinaux.length}/${segments.length} fichiers audio collectés.`);

  const audioInfo = {
    folder: audioFolder,
    totalAudios: audiosFinaux.length,
    audiosList: audiosFinaux,
  };
  fs.writeFileSync("./tmp_data/audio_info.json", JSON.stringify(audioInfo, null, 2), "utf-8");

  // Si encore manquant, tente de copier voisin ou générer silence pour bloquer le moins possible
  if (audiosFinaux.length < segments.length) {
    console.warn(`⚠️ Seulement ${audiosFinaux.length}/${segments.length} audios disponibles, tentative de comblement...`);
    for (let i = 0; i < segments.length; i++) {
      const indexStr = String(i + 1).padStart(3, "0");
      const pathAudio = path.join(audioFolder, `audio_${indexStr}.mp3`);
      if (!fs.existsSync(pathAudio) || fs.statSync(pathAudio).size === 0) {
        // Cherche voisin
        const neighbor = [
          path.join(audioFolder, `audio_${String(i).padStart(3, "0")}.mp3`),
          path.join(audioFolder, `audio_${String(i + 2).padStart(3, "0")}.mp3`),
        ].find((c) => fs.existsSync(c) && fs.statSync(c).size > 0);
        if (neighbor) {
          fs.copyFileSync(neighbor, pathAudio);
          console.log(`🔁 Copie voisin ${path.basename(neighbor)} → ${path.basename(pathAudio)}`);
        } else {
          generateSilentAudio(pathAudio, 3, ffmpegBin);
        }
      }
    }
    const finalCheck = fs
      .readdirSync(audioFolder)
      .filter((f) => f.startsWith("audio_") && f.endsWith(".mp3"))
      .map((f) => path.join(audioFolder, f))
      .filter((p) => fs.statSync(p).size > 0).length;
    if (finalCheck < segments.length) {
      console.error(`❌ Impossible de continuer : seulement ${finalCheck}/${segments.length} audios disponibles après toutes tentatives.`);
      process.exit(1);
    }
    // Met à jour la liste finale
    const finalList = fs
      .readdirSync(audioFolder)
      .filter((f) => f.startsWith("audio_") && f.endsWith(".mp3"))
      .map((f) => path.join(audioFolder, f))
      .filter((p) => fs.statSync(p).size > 0)
      .sort();
    fs.writeFileSync("./tmp_data/audio_info.json", JSON.stringify({ folder: audioFolder, totalAudios: finalList.length, audiosList: finalList }, null, 2), "utf-8");
  }
}

main().catch((err) => {
  console.error("❌ Erreur fatale :", err.message);
  process.exit(1);
});
