#!/usr/bin/env node

/**
 * 🎬 Création vidéo texte 1 minute — Version simplifiée et robuste
 * Chaque slide est généré séparément puis concaténé
 */

"use strict";

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
const TMP = "/tmp/vid_slides";
const OUTPUT = "/home/user/vid-ia-pipeline/tmp_data/video_texte_1min.mp4";

const SLIDES = [
  ["LE SECRET DU VIRAL", "Strategie YouTube Shorts 2026", 5, "FFD700", "#1a1a2e"],
  ["HOOK #1: Curiosity Gap", "Personne ne sait ce que Pomme cache...", 5, "00BFFF", "#16213e"],
  ["HOOK #2: Chiffre Choc", "78% des gens ignorent cette verite", 5, "FF6347", "#0f3460"],
  ["HOOK #3: La Question", "Tu ferais quoi a ma place ?", 5, "7B68EE", "#1a1a2e"],
  ["HOOK #4: Histoire Perso", "J ai decouvert un truc cette nuit...", 5, "FF69B4", "#2d1b3d"],
  ["Pattern Interrupt", "Toutes les 3 secondes, casse le rythme", 5, "00CED1", "#1a1a2e"],
  ["TWIST A 70%", "Le moment le plus partageable !", 5, "FF4500", "#3d1b1b"],
  ["CTA VIRAL", "Et toi, qu en penses-tu ? Dis en commentaire !", 5, "32CD32", "#1a3d1b"],
  ["EMOTION #1: Curiosite", "Le moteur #1 du scroll stop", 4, "FFD700", "#1b2d3d"],
  ["EMOTION #2: Surprise", "Plot twist qui fait partager", 4, "FF6347", "#3d2d1b"],
  ["EMOTION #3: Indignation", "Ils nous cachent tout !", 4, "DC143C", "#2d1b2d"],
  ["EMOTION #4: Peur Controlee", "Tension sans traumatisme", 4, "9400D3", "#1b3d2d"],
  ["PUBLIE AU BON MOMENT", "Horreur 22h30 | Manga 22h | Actu 12h15", 4, "00BFFF", "#16213e"],
];

fs.mkdirSync(TMP, { recursive: true });
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });

console.log("============================================");
console.log("  CREATION VIDEO TEXTE 1 MINUTE");
console.log("============================================\n");

const W = 1080, H = 1920, FPS = 30;
const totalSec = SLIDES.reduce((s, sld) => s + sld[2], 0);
console.log(`Resolution: ${W}x${H} | Duree: ${totalSec}s | Slides: ${SLIDES.length}\n`);

let concatFile = "";

for (let i = 0; i < SLIDES.length; i++) {
  const [mainText, subText, dur, color, bg] = SLIDES[i];
  const out = `${TMP}/slide_${String(i).padStart(2, "0")}.mp4`;
  
  // On crée d'abord le fond coloré
  const bgCmd = `"${execSync('which ffmpeg').toString().trim()}" -y -f lavfi -i "color=c=${bg}:s=${W}x${H}:d=${dur}:r=${FPS}" -c:v libx264 -preset ultrafast -pix_fmt yuv420p "${TMP}/bg_${i}.mp4"`;
  execSync(bgCmd, { stdio: "ignore", timeout: 30000 });

  // On ajoute le texte principal (gros)
  const fontSize = mainText.length > 20 ? 70 : 90;
  const txt1 = `${TMP}/txt1_${i}.mp4`;
  const t1Cmd = `"${execSync('which ffmpeg').toString().trim()}" -y -i "${TMP}/bg_${i}.mp4" -vf "drawtext=fontfile=${FONT}:text='${mainText}':fontcolor=${color}:fontsize=${fontSize}:x=(w-text_w)/2:y=(h-text_h)/2-80:shadowcolor=black:shadowx=4:shadowy=4" -c:v libx264 -preset ultrafast -pix_fmt yuv420p "${txt1}"`;
  execSync(t1Cmd, { stdio: "ignore", timeout: 30000 });

  // On ajoute le sous-titre (petit)
  const txt2 = `${TMP}/txt2_${i}.mp4`;
  const t2Cmd = `"${execSync('which ffmpeg').toString().trim()}" -y -i "${txt1}" -vf "drawtext=fontfile=${FONT}:text='${subText}':fontcolor=white:fontsize=34:x=(w-text_w)/2:y=(h-text_h)/2+80:shadowcolor=black:shadowx=3:shadowy=3" -c:v libx264 -preset ultrafast -pix_fmt yuv420p "${out}"`;
  execSync(t2Cmd, { stdio: "ignore", timeout: 30000 });

  concatFile += `file '${out}'\n`;
  
  // Nettoyage des fichiers temporaires
  try { fs.unlinkSync(`${TMP}/bg_${i}.mp4`); } catch {}
  try { fs.unlinkSync(`${TMP}/txt1_${i}.mp4`); } catch {}

  const pct = Math.round(((i + 1) / SLIDES.length) * 100);
  console.log(`  Slide ${i + 1}/${SLIDES.length} [${pct}%] : ${mainText.slice(0, 30)}`);
}

// Fichier de concat
fs.writeFileSync(`${TMP}/concat.txt`, concatFile);

// Concaténation finale
console.log("\nAssemblage final...");
const concatCmd = `"${execSync('which ffmpeg').toString().trim()}" -y -f concat -safe 0 -i "${TMP}/concat.txt" -f lavfi -i anullsrc=r=44100:cl=mono -shortest -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 128k "${OUTPUT}"`;
execSync(concatCmd, { stdio: "pipe", timeout: 120000 });

// Ajout des fades
const fadeCmd = `"${execSync('which ffmpeg').toString().trim()}" -y -i "${OUTPUT}" -i "${OUTPUT}" -filter_complex "[0:v]fade=t=in:st=0:d=0.5,fade=t=out:st=${totalSec - 1}:d=0.5[vout]" -map "[vout]" -map 1:a -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 128k "${OUTPUT}.tmp.mp4" && mv "${OUTPUT}.tmp.mp4" "${OUTPUT}"`;
try { execSync(fadeCmd, { stdio: "ignore", timeout: 120000 }); } catch {}

// Nettoyage
try { execSync(`rm -rf ${TMP}`, { stdio: "ignore" }); } catch {}

const stats = fs.statSync(OUTPUT);
const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

console.log("\n============================================");
console.log("  ✅ VIDEO CREE AVEC SUCCES !");
console.log("============================================");
console.log(`  Fichier : ${OUTPUT}`);
console.log(`  Taille   : ${sizeMB} Mo`);
console.log(`  Duree    : ${totalSec}s (1min)`);
console.log(`  Format   : ${W}x${H} vertical 9:16`);
console.log(`  Slides   : ${SLIDES.length}`);
console.log("============================================");
console.log("\n📥 Telecharge ici :");
console.log(`  ${OUTPUT}`);
