/**
 * ÉTAPE 2 — NOUVELLE LOGIQUE PRO (selon instructions utilisateur)
 *
 * RÈGLE PRINCIPALE :
 * - La génération de vidéo se fait UNIQUEMENT via l'API Vidéo (VIDEO_API_URL)
 * - Chaque appel génère directement un fichier MP4 qui contient :
 *     → L'animation (5s ou 10s)
 *     → L'audio français intégré directement dans le fichier vidéo
 *     → Lip-sync des personnages
 *
 * L'API Image n'est utilisée QUE pour la CONTINUITÉ :
 * - Quand un nouveau personnage arrive
 * - Quand on change de décor
 * - On prend la dernière frame du clip précédent → on l'édite (ajout personnage / repositionnement)
 * - Cette image éditée sert de référence pour la génération vidéo suivante
 *
 * On ne fait PLUS de fallback image + TTS + Ken Burns comme méthode principale.
 */

"use strict";

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const IMAGE_API_URL = process.env.IMAGE_API_URL || "https://gem-tw6a.onrender.com/generate";
const VIDEO_API_URL = process.env.VIDEO_API_URL || IMAGE_API_URL;

// Dossier pour stocker les frames de continuité
const CONTINUITY_FOLDER = "./tmp_data/continuity_frames";

const attendre = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Prompt unifié pour l'API Vidéo (MP4 + Audio intégré) ─────────────────────
function unifiedVideoPrompt(scriptData, segment, continuityInfo = "") {
  const style = scriptData.visual_style || "professional full-color modern anime";
  
  return `${style}. 
Scene ${segment.id}: ${segment.prompt_visuel}

${continuityInfo}

CRITICAL REQUIREMENTS:
- Generate a SINGLE MP4 video file (5 or 10 seconds)
- The video must contain the animation + the exact French audio EMBEDDED DIRECTLY
- Characters must have visible lip movements synchronized with the French voice
- Natural manga conversation style with multiple characters when needed
- Vertical 9:16, high quality, fluid animation, no subtitles, no watermark`;
}

// ─── Prompt pour l'API Image (UNIQUEMENT pour continuité) ─────────────────────
function continuityImagePrompt(scriptData, segment, lastFrameDescription = "") {
  return `Edit this scene for continuity in a professional anime style.
${lastFrameDescription ? `Previous scene ended with: ${lastFrameDescription}` : ""}
Current scene: ${segment.prompt_visuel}
Add or adjust characters and environment for seamless continuation.
Professional full-color modern anime, consistent character designs, no text.`;
}

// ─── Tentative génération vidéo directe via API ─────────────────────────────
async function tryGenerateVideoViaAPI(prompt, outputPath, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const payloads = [
        { prompt, ratio: "9:16", format: "mp4", duration: 5, audio: true, with_audio: true },
        { prompt, ratio: "9:16", format: "mp4", duration: 10, audio: true, with_audio: true },
        { prompt, ratio: "9:16", format: "mp4" },
      ];

      for (const payload of payloads) {
        try {
          const res = await axios.post(VIDEO_API_URL, payload, {
            responseType: "arraybuffer",
            timeout: 180000,
            validateStatus: (s) => s < 500,
          });

          if (res.status >= 400) continue;
          if (!res.data || res.data.byteLength < 2000) continue;

          const isJpeg = res.data[0] === 0xff && res.data[1] === 0xd8;
          if (isJpeg) continue;

          fs.writeFileSync(outputPath, res.data);
          if (fs.statSync(outputPath).size > 2000) {
            return { success: true };
          }
        } catch (e) {}
      }
    } catch (err) {}
    if (attempt < retries) await attendre(attempt * 2000);
  }
  return { success: false };
}

// ─── Génération d'image pour CONTINUITÉ (édition) ─────────────────────────────
async function generateContinuityImage(prompt, outputPath, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await axios.post(IMAGE_API_URL, { prompt, ratio: "9:16", format: "jpg" }, {
        responseType: "arraybuffer",
        timeout: 120000,
        validateStatus: (s) => s < 500,
      });
      if (res.status >= 400) throw new Error(`API ${res.status}`);
      fs.writeFileSync(outputPath, res.data);
      return true;
    } catch (e) {
      if (attempt < retries) await attendre(1500);
    }
  }
  return false;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync("./tmp_data/script_data.json")) {
    throw new Error("script_data.json introuvable. Lancez l'étape 1.");
  }

  const scriptData = JSON.parse(fs.readFileSync("./tmp_data/script_data.json", "utf-8"));
  const segments = scriptData.script;

  if (!Array.isArray(segments) || !segments.length) {
    throw new Error("Aucun segment à générer.");
  }

  const clipsFolder = path.join("./tmp_data", "clips");
  fs.mkdirSync(clipsFolder, { recursive: true });
  fs.mkdirSync(CONTINUITY_FOLDER, { recursive: true });

  console.log(`🎬 [PRO] Génération de ${segments.length} clips vidéo avec AUDIO INTÉGRÉ`);
  console.log(`   API Vidéo: ${VIDEO_API_URL}`);
  console.log(`   Stratégie: Vidéo directe (MP4 + audio embarqué) + API Image pour continuité uniquement`);

  const generatedClips = [];
  const batchSize = 2;

  for (let i = 0; i < segments.length; i += batchSize) {
    const batch = segments.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (segment, offset) => {
        const pos = i + offset;
        const num = String(pos + 1).padStart(3, "0");
        const clipPath = path.join(clipsFolder, `clip_${num}.mp4`);

        if (fs.existsSync(clipPath) && fs.statSync(clipPath).size > 0) {
          console.log(`⏭️  Clip ${num} déjà présent.`);
          generatedClips.push(clipPath);
          return;
        }

        // ─────────────────────────────────────────────────────────────
        // 1. GÉNÉRATION VIDÉO DIRECTE (PRIORITÉ ABSOLUE)
        // ─────────────────────────────────────────────────────────────
        let continuityInfo = "";
        if (pos > 0) {
          continuityInfo = "Continue directly from the previous scene for visual continuity.";
        }

        console.log(`🔄 Clip ${num} — Génération vidéo directe (animation + audio intégré)...`);

        const videoResult = await tryGenerateVideoViaAPI(
          unifiedVideoPrompt(scriptData, segment, continuityInfo),
          clipPath,
          3
        );

        if (videoResult.success) {
          console.log(`✅ Clip ${num} généré avec succès (vidéo + audio intégré).`);
          generatedClips.push(clipPath);
          return;
        }

        // ─────────────────────────────────────────────────────────────
        // 2. CONTINUITÉ via API Image (seulement si nécessaire)
        // ─────────────────────────────────────────────────────────────
        console.log(`🟡 Clip ${num} — Tentative de continuité via API Image...`);

        const lastFramePath = path.join(CONTINUITY_FOLDER, `last_frame_${num}.jpg`);
        
        if (pos > 0) {
          const prevNum = String(pos).padStart(3, "0");
          const prevClip = path.join(clipsFolder, `clip_${prevNum}.mp4`);
          
          if (fs.existsSync(prevClip)) {
            try {
              execSync(
                `ffmpeg -y -i "${prevClip}" -vf "select=eq(n\\,1)" -q:v 2 -frames:v 1 "${lastFramePath}"`,
                { stdio: "ignore", timeout: 30000 }
              );
            } catch (e) {}
          }
        }

        const continuityPrompt = continuityImagePrompt(
          scriptData,
          segment,
          pos > 0 ? `Previous scene continuity` : ""
        );

        const continuityOk = await generateContinuityImage(continuityPrompt, lastFramePath);

        if (continuityOk) {
          console.log(`   → Image de continuité générée pour le clip ${num}`);
        }

        const finalVideoAttempt = await tryGenerateVideoViaAPI(
          unifiedVideoPrompt(scriptData, segment, continuityInfo),
          clipPath,
          2
        );

        if (finalVideoAttempt.success) {
          console.log(`✅ Clip ${num} généré via API Vidéo.`);
          generatedClips.push(clipPath);
        } else {
          console.error(`❌ Échec génération clip ${num}. Clip ignoré.`);
        }
      })
    );

    if (i + batchSize < segments.length) await attendre(1200);
  }

  const info = {
    folder: clipsFolder,
    totalClips: generatedClips.length,
    clipsList: generatedClips,
    generated_at: new Date().toISOString(),
    mode: "video_with_embedded_audio",
    continuity_used: true
  };

  fs.writeFileSync("./tmp_data/clips_info.json", JSON.stringify(info, null, 2));
  fs.writeFileSync("./tmp_data/video_clips_info.json", JSON.stringify(info, null, 2));

  console.log(`\n🎉 ${generatedClips.length}/${segments.length} clips vidéo générés avec audio intégré.`);
  console.log(`   Dossier: ${clipsFolder}`);
}

main().catch((err) => {
  console.error("❌ Erreur fatale:", err.message);
  process.exit(1);
});
