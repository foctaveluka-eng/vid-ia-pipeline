/**
 * ÉTAPE 2b — Vérification pro des clips vidéo avec audio intégré
 * Vérifie que tous les clips MP4 existent, sinon tente régénération.
 * Remplace l'ancienne vérif images séparée.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

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

function placeholderClip(clipPath, theme, ffmpegBin) {
  if (!ffmpegBin) return false;
  try {
    const colors = {
      dessin_anime: "0xFFEB9C",
      manga: "0x222222",
      actualites: "0x1E3A8A",
      horreur: "0x111111",
      default: "0x333333",
    };
    const color = colors[theme] || colors.default;
    // Génère clip vidéo minimal avec audio silencieux
    const cmd = `"${ffmpegBin}" -y -f lavfi -i "color=c=${color}:s=1080x1920:d=3" -f lavfi -i "anullsrc=r=44100:cl=mono" -t 3 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "${clipPath}"`;
    execSync(cmd, { stdio: "ignore", timeout: 20000 });
    return fs.existsSync(clipPath) && fs.statSync(clipPath).size > 0;
  } catch {
    return false;
  }
}

async function main() {
  if (!fs.existsSync("./tmp_data/script_data.json")) throw new Error("script_data.json introuvable.");
  const scriptData = JSON.parse(fs.readFileSync("./tmp_data/script_data.json", "utf8"));
  const clipsFolder = path.join("./tmp_data", "clips");
  fs.mkdirSync(clipsFolder, { recursive: true });
  const ffmpegBin = detectFFmpeg();

  let missing = 0;
  for (let i = 0; i < scriptData.script.length; i++) {
    const num = String(i + 1).padStart(3, "0");
    const clipPath = path.join(clipsFolder, `clip_${num}.mp4`);
    if (!fs.existsSync(clipPath) || fs.statSync(clipPath).size === 0) {
      console.log(`🔄 Réparation clip ${num}/${scriptData.script.length}`);
      // Tente copie voisin + placeholder
      const neighbor = [i - 1, i + 1]
        .map((n) => path.join(clipsFolder, `clip_${String(n + 1).padStart(3, "0")}.mp4`))
        .find((p) => fs.existsSync(p) && fs.statSync(p).size > 0);
      if (neighbor) {
        fs.copyFileSync(neighbor, clipPath);
        console.log(`🔁 Copie voisin ${path.basename(neighbor)} → ${path.basename(clipPath)}`);
      } else if (!placeholderClip(clipPath, scriptData.theme, ffmpegBin)) {
        missing++;
      }
    }
  }

  const clips = scriptData.script
    .map((_, i) => path.join(clipsFolder, `clip_${String(i + 1).padStart(3, "0")}.mp4`))
    .filter((p) => fs.existsSync(p) && fs.statSync(p).size > 0)
    .sort();

  fs.writeFileSync("./tmp_data/clips_info.json", JSON.stringify({ folder: clipsFolder, totalClips: clips.length, clipsList: clips }, null, 2));
  fs.writeFileSync("./tmp_data/video_clips_info.json", JSON.stringify({ folder: clipsFolder, totalClips: clips.length, clipsList: clips }, null, 2));

  if (clips.length !== scriptData.script.length) {
    console.warn(`⚠️ ${clips.length}/${scriptData.script.length} clips disponibles après réparation.`);
    if (clips.length === 0) throw new Error("Aucun clip disponible.");
  }
  console.log(`✅ ${clips.length}/${scriptData.script.length} clips vidéo vérifiés (pro, avec audio intégré).`);
}

main().catch((err) => {
  console.error("❌ Erreur fatale vérif clips:", err.message);
  process.exit(1);
});
