#!/usr/bin/env node

/**
 * CLI GLAM IMG2VIDEO — Générez de vraies vidéos animées depuis une image + prompt
 *
 * Utilisation :
 *   node scripts/glam_cli.js animate <image_path> "<prompt>" [durée]
 *
 * Exemples :
 *   node scripts/glam_cli.js animate mon_image.jpg "le personnage court dans la forêt" 5
 *   node scripts/glam_cli.js animate https://exemple.com/image.jpg "transition fluide" 3
 */

"use strict";

const path = require("path");
const fs = require("fs");
const axios = require("axios");
const glam = require("./glam_img2video");

function usage() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║   🎬 GLAM IMG2VIDEO — Générateur de vidéos animées réelles  ║
╚══════════════════════════════════════════════════════════════╝

Utilisation :
  node scripts/glam_cli.js animate <image> "<prompt>" [durée]

Arguments :
  image    : Chemin local OU URL de l'image source
  prompt   : Description de l'animation désirée (entre guillemets)
  durée    : Durée en secondes (optionnel, défaut: 5)

Exemples :
  node scripts/glam_cli.js animate photo.jpg "zoom avant sur le personnage principal" 5
  node scripts/glam_cli.js animate https://exemple.com/img.png "transition panoramique" 3
`);
}

async function cmdAnimate(imageSrc, prompt, duration) {
  const dur = parseInt(duration) || 5;
  if (!prompt || prompt.length < 3) {
    console.error("❌ Prompt requis (min 3 caractères)");
    process.exit(1);
  }

  const tmpDir = path.join(process.cwd(), "tmp_data", "glam_output");
  fs.mkdirSync(tmpDir, { recursive: true });

  let imagePath = imageSrc;
  const isUrl = /^https?:\/\//i.test(imageSrc);

  if (isUrl) {
    console.log(`📥 Téléchargement de l'image depuis: ${imageSrc}`);
    const ext = (path.extname(new URL(imageSrc).pathname) || ".jpg").split("?")[0];
    imagePath = path.join(tmpDir, `source_${Date.now()}${ext || ".jpg"}`);
    const writer = fs.createWriteStream(imagePath);
    const res = await axios.get(imageSrc, { responseType: "stream", timeout: 30000 });
    res.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });
  }

  if (!fs.existsSync(imagePath)) {
    console.error(`❌ Image introuvable: ${imagePath}`);
    process.exit(1);
  }

  const stats = fs.statSync(imagePath);
  if (stats.size < 100) {
    console.error(`❌ Image trop petite ou corrompue: ${stats.size} octets`);
    process.exit(1);
  }

  console.log(`\n📸 Image: ${path.basename(imagePath)} (${(stats.size / 1024).toFixed(1)} Ko)`);
  console.log(`🎯 Prompt: "${prompt}"`);
  console.log(`⏱  Durée: ${dur}s`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  try {
    const result = await glam.imgToVideo(prompt, imagePath, dur, { retries: 3 });
    
    const videoUrl = result.video_url;
    console.log(`\n✅ VIDÉO GÉNÉRÉE AVEC SUCCÈS !`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔗 URL: ${videoUrl}`);

    const outputPath = path.join(tmpDir, `glam_video_${Date.now()}.mp4`);
    console.log(`📥 Téléchargement vers: ${outputPath}`);
    await glam.downloadVideo(videoUrl, outputPath);

    const vidStats = fs.statSync(outputPath);
    console.log(`💾 Taille: ${(vidStats.size / (1024 * 1024)).toFixed(2)} Mo`);
    console.log(`📁 Fichier: ${outputPath}`);
    console.log(`\n🎉 C'est une VRAIE vidéo animée, pas une image statique !\n`);
  } catch (err) {
    console.error(`\n❌ Erreur: ${err.message}`);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    usage();
    process.exit(0);
  }

  if (command === "animate") {
    if (!args[1]) { console.error("❌ Argument manquant: chemin de l'image"); usage(); process.exit(1); }
    if (!args[2]) { console.error("❌ Argument manquant: prompt d'animation"); usage(); process.exit(1); }
    await cmdAnimate(args[1], args[2], args[3]);
  } else {
    console.error(`❌ Commande inconnue: "${command}"`);
    usage();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Erreur:", err.message);
  process.exit(1);
});
