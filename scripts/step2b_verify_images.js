/** ÉTAPE 2b — Répare les illustrations manquantes sans figer le nombre de scènes. Version robuste avec copie voisin + placeholder FFmpeg. */
"use strict";
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const IMAGE_API_URL = process.env.IMAGE_API_URL || "https://gem-tw6a.onrender.com/generate";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const imageName = (index) => `img_${String(index + 1).padStart(3, "0")}.jpg`;

function promptFor(data, segment) {
  const move = data.visual_mode === "manga_motion" ? "Original manga panel, clear foreground and background for camera movement, no speech bubbles." : "Cinematic animated illustration, clear foreground and background for camera movement.";
  return `${data.visual_style || move}. Scene: ${segment.prompt_visuel}. ${move}`;
}

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

function placeholderIfNeeded(file, theme, ffmpegBin) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return true;
  if (!ffmpegBin) return false;
  try {
    const colors = { dessin_anime: "0xFFEB9C", manga: "0x222222", actualites: "0x1E3A8A", horreur: "0x111111", default: "0x333333" };
    const color = colors[theme] || colors.default;
    const cmd = `"${ffmpegBin}" -y -f lavfi -i "color=c=${color}:s=1080x1920:d=0.1" -frames:v 1 "${file}"`;
    execSync(cmd, { stdio: "ignore", timeout: 15000 });
    return fs.existsSync(file) && fs.statSync(file).size > 0;
  } catch {
    return false;
  }
}

async function generate(prompt, file) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await axios.post(IMAGE_API_URL, { prompt, ratio: "9:16", format: "jpg" }, { responseType: "arraybuffer", timeout: 120000, validateStatus: (s) => s < 500 });
      if (response.status >= 400) throw new Error(`API ${response.status}`);
      if (!response.data?.byteLength) throw new Error("réponse vide");
      fs.writeFileSync(file, response.data);
      return true;
    } catch (error) {
      console.warn(`⚠️ Essai ${attempt}/3: ${error.message}`);
      if (attempt < 3) await wait(attempt * 2500);
    }
  }
  return false;
}

async function main() {
  if (!fs.existsSync("./tmp_data/script_data.json")) throw new Error("script_data.json introuvable.");
  const data = JSON.parse(fs.readFileSync("./tmp_data/script_data.json", "utf8"));
  const folder = path.join("./tmp_data", "images");
  fs.mkdirSync(folder, { recursive: true });
  const ffmpegBin = detectFFmpeg();

  for (let i = 0; i < data.script.length; i++) {
    const file = path.join(folder, imageName(i));
    if (fs.existsSync(file) && fs.statSync(file).size > 0) continue;
    console.log(`🔄 Réparation illustration ${i + 1}/${data.script.length}`);
    if (!(await generate(promptFor(data, data.script[i]), file))) {
      // Dernier recours: une planche voisine conserve le montage animé exploitable.
      const neighbor = [i - 1, i + 1].map((n) => path.join(folder, imageName(n))).find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).size > 0);
      if (neighbor) {
        fs.copyFileSync(neighbor, file);
        console.log(`🔁 Copie voisin ${path.basename(neighbor)} → ${path.basename(file)}`);
      } else {
        placeholderIfNeeded(file, data.theme, ffmpegBin);
      }
    }
  }
  const images = data.script.map((_, i) => path.join(folder, imageName(i))).filter((file) => fs.existsSync(file) && fs.statSync(file).size > 0);
  // Tente placeholder pour ceux encore manquants
  for (let i = 0; i < data.script.length; i++) {
    const file = path.join(folder, imageName(i));
    if (!fs.existsSync(file) || fs.statSync(file).size === 0) {
      placeholderIfNeeded(file, data.theme, ffmpegBin);
    }
  }
  const finalImages = data.script.map((_, i) => path.join(folder, imageName(i))).filter((file) => fs.existsSync(file) && fs.statSync(file).size > 0);
  fs.writeFileSync("./tmp_data/images_info.json", JSON.stringify({ folder, totalFiles: finalImages.length, imagesList: finalImages }, null, 2));
  if (finalImages.length !== data.script.length) {
    console.warn(`⚠️ ${finalImages.length}/${data.script.length} illustrations disponibles après réparation.`);
    // On ne bloque plus le pipeline si au moins 1 image, la copie voisin a déjà tenté.
    if (finalImages.length === 0) throw new Error(`${finalImages.length}/${data.script.length} illustrations disponibles.`);
  }
  console.log(`✅ ${finalImages.length}/${data.script.length} illustrations prêtes.`);
}

main().catch((error) => {
  console.error("❌ Erreur fatale:", error.message);
  process.exit(1);
});
