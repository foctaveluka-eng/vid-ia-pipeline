/** ÉTAPE 2 — Génération des planches illustrées, par packs de 5. */
"use strict";
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const IMAGE_API_URL = process.env.IMAGE_API_URL || "https://gem-tw6a.onrender.com/generate";
const attendre = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function visualPrompt(scriptData, segment) {
  const movement = scriptData.visual_mode === "manga_motion"
    ? "Compose for camera movement: clear foreground, middle ground and background; leave no speech bubbles."
    : "Compose for subtle cinematic camera movement with clear foreground and background.";
  return `${scriptData.visual_style || "cinematic animated illustration"}. Scene: ${segment.prompt_visuel}. ${movement}`;
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
  console.log(`🖼️ Génération de ${segments.length} illustrations pour ${scriptData.theme_label || scriptData.theme}.`);

  for (let i = 0; i < segments.length; i += batchSize) {
    const batch = segments.slice(i, i + batchSize);
    await Promise.all(batch.map(async (segment, offset) => {
      const position = i + offset;
      const number = String(position + 1).padStart(3, "0");
      const imagePath = path.join(imagesFolder, `img_${number}.jpg`);
      if (fs.existsSync(imagePath) && fs.statSync(imagePath).size > 0) { outputImages.push(imagePath); return; }
      try {
        const response = await axios.post(IMAGE_API_URL, { prompt: visualPrompt(scriptData, segment), ratio: "9:16", format: "jpg" }, { responseType: "arraybuffer", timeout: 90000 });
        if (!response.data?.byteLength) throw new Error("réponse image vide");
        fs.writeFileSync(imagePath, response.data);
        outputImages.push(imagePath);
        console.log(`✅ Illustration ${number} générée.`);
      } catch (error) { console.error(`❌ Illustration ${number}: ${error.message}`); }
    }));
    if (i + batchSize < segments.length) await attendre(1000);
  }
  outputImages.sort();
  fs.writeFileSync("./tmp_data/images_info.json", JSON.stringify({ folder: imagesFolder, totalFiles: outputImages.length, imagesList: outputImages }, null, 2));
  console.log(`🎉 ${outputImages.length}/${segments.length} illustrations générées.`);
}
main().catch((error) => { console.error("❌ Erreur fatale:", error.message); process.exit(1); });
module.exports = { visualPrompt };
