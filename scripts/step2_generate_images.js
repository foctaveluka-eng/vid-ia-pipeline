/** ÉTAPE 2 — Génération des planches illustrées, par packs de 5. Version robuste avec fallback local. */
"use strict";
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const IMAGE_API_URL = process.env.IMAGE_API_URL || "https://gem-tw6a.onrender.com/generate";
const attendre = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function visualPrompt(scriptData, segment) {
  const movement = scriptData.visual_mode === "manga_motion"
    ? "Compose for camera movement: clear foreground, middle ground and background; leave no speech bubbles."
    : "Compose for subtle cinematic camera movement with clear foreground and background.";
  return `${scriptData.visual_style || "cinematic animated illustration"}. Scene: ${segment.prompt_visuel}. ${movement}`;
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

// Génère une image placeholder avec FFmpeg si l'API est down
function generatePlaceholderImage(imagePath, index, theme, ffmpegBin) {
  try {
    if (!ffmpegBin) throw new Error("FFmpeg introuvable");
    // Couleur selon le thème
    const colors = {
      dessin_anime: "0xFFEB9C",
      manga: "0x222222",
      actualites: "0x1E3A8A",
      horreur: "0x111111",
      default: "0x333333",
    };
    const color = colors[theme] || colors.default;
    // 1080x1920 solid color
    const cmd = `"${ffmpegBin}" -y -f lavfi -i "color=c=${color}:s=1080x1920:d=0.1" -frames:v 1 "${imagePath}"`;
    execSync(cmd, { stdio: "ignore", timeout: 15000 });
    if (fs.existsSync(imagePath) && fs.statSync(imagePath).size > 0) {
      console.log(`🟡 Placeholder généré pour ${path.basename(imagePath)} (API indisponible)`);
      return true;
    }
  } catch (e) {
    console.warn(`⚠️ Impossible de générer placeholder ${path.basename(imagePath)}: ${e.message}`);
  }
  return false;
}

async function tryGenerateImage(prompt, file, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.post(
        IMAGE_API_URL,
        { prompt, ratio: "9:16", format: "jpg" },
        { responseType: "arraybuffer", timeout: 120000, validateStatus: (s) => s < 500 }
      );
      if (response.status >= 400) throw new Error(`API ${response.status}: ${Buffer.from(response.data).toString().slice(0, 300)}`);
      if (!response.data?.byteLength) throw new Error("réponse image vide");
      fs.writeFileSync(file, response.data);
      return true;
    } catch (error) {
      console.warn(`⚠️ Illustration ${path.basename(file)} essai ${attempt}/${retries}: ${error.message}`);
      if (attempt < retries) await attendre(attempt * 2000 + Math.random() * 500);
    }
  }
  return false;
}

async function main() {
  if (!fs.existsSync("./tmp_data/script_data.json")) throw new Error("script_data.json introuvable. Lancez l'étape 1.");
  const scriptData = JSON.parse(fs.readFileSync("./tmp_data/script_data.json", "utf-8"));
  const segments = scriptData.script;
  if (!Array.isArray(segments) || !segments.length) throw new Error("Aucun segment à illustrer.");

  const imagesFolder = path.join("./tmp_data", "images");
  fs.mkdirSync(imagesFolder, { recursive: true });
  const outputImages = [];
  const batchSize = 5;
  const ffmpegBin = detectFFmpeg();
  console.log(`🖼️ Génération de ${segments.length} illustrations pour ${scriptData.theme_label || scriptData.theme}. API: ${IMAGE_API_URL}`);

  for (let i = 0; i < segments.length; i += batchSize) {
    const batch = segments.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (segment, offset) => {
        const position = i + offset;
        const number = String(position + 1).padStart(3, "0");
        const imagePath = path.join(imagesFolder, `img_${number}.jpg`);
        if (fs.existsSync(imagePath) && fs.statSync(imagePath).size > 0) {
          outputImages.push(imagePath);
          return;
        }
        const ok = await tryGenerateImage(visualPrompt(scriptData, segment), imagePath, 3);
        if (ok) {
          outputImages.push(imagePath);
          console.log(`✅ Illustration ${number} générée.`);
        } else {
          console.error(`❌ Illustration ${number} échouée après retries, tentative placeholder...`);
          if (generatePlaceholderImage(imagePath, position, scriptData.theme, ffmpegBin)) {
            outputImages.push(imagePath);
          } else {
            console.error(`❌ Impossible de créer ${number}, même en placeholder.`);
          }
        }
      })
    );
    if (i + batchSize < segments.length) await attendre(1500);
  }
  outputImages.sort();
  fs.writeFileSync(
    "./tmp_data/images_info.json",
    JSON.stringify({ folder: imagesFolder, totalFiles: outputImages.length, imagesList: outputImages }, null, 2)
  );
  console.log(`🎉 ${outputImages.length}/${segments.length} illustrations prêtes (${outputImages.length === segments.length ? "complet" : "partiel"}).`);
  if (outputImages.length === 0) throw new Error("Aucune illustration générée, même avec placeholders.");
}

main().catch((error) => {
  console.error("❌ Erreur fatale:", error.message);
  process.exit(1);
});
module.exports = { visualPrompt };
