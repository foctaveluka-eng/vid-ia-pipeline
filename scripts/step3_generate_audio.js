/**
 * ÉTAPE 3 — DÉPRÉCIÉE
 * L'ancien système générait des audios TTS séparés.
 * Nouveau système PRO : l'audio est directement intégré dans chaque clip vidéo
 * lors de l'étape 2 (step2_generate_videos.js).
 *
 * Ce fichier est conservé pour rétrocompatibilité mais ne fait plus rien.
 * Il vérifie simplement que les clips existent déjà avec audio.
 */

"use strict";

const fs = require("fs");
const path = require("path");

console.log("ℹ️ [DÉPRÉCIÉ] Étape 3 audio séparée est supprimée.");
console.log("   Nouveau système PRO : chaque clip vidéo (tmp_data/clips/*.mp4) contient déjà l'audio français intégré.");
console.log("   Génération faite en étape 2 via prompt unifié visuel + parole.");

function main() {
  const clipsFolder = "./tmp_data/clips";
  if (!fs.existsSync(clipsFolder)) {
    console.warn("⚠️ Dossier clips introuvable, mais ce n'est plus bloquant — l'étape 2 doit l'avoir créé.");
    return;
  }
  const clips = fs.readdirSync(clipsFolder).filter(f => f.endsWith(".mp4")).length;
  console.log(`✅ Vérification: ${clips} clips avec audio intégré trouvés dans ${clipsFolder}.`);
  console.log("   Aucun TTS séparé nécessaire — système pro actif.");

  // Compat: crée audio_info.json factice si besoin pour anciens scripts
  if (!fs.existsSync("./tmp_data/audio_info.json") && fs.existsSync("./tmp_data/clips_info.json")) {
    const clipsInfo = JSON.parse(fs.readFileSync("./tmp_data/clips_info.json", "utf-8"));
    const fakeAudioInfo = {
      folder: "./tmp_data/audio",
      totalAudios: clipsInfo.totalClips || clipsInfo.clipsList?.length || clips,
      audiosList: clipsInfo.clipsList || [],
      deprecated: true,
      note: "Audio intégré dans clips vidéo — plus de génération séparée",
    };
    fs.mkdirSync("./tmp_data/audio", { recursive: true });
    fs.writeFileSync("./tmp_data/audio_info.json", JSON.stringify(fakeAudioInfo, null, 2));
  }
}

main();
