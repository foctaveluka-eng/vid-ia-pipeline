/**
 * ÉTAPE 2 — PROFESSIONNELLE : Génération de clips vidéo avec audio intégré
 *
 * Nouveau système pro : chaque scène est générée directement comme une vidéo MP4
 * contenant image + voix française synchronisée, sans étape audio séparée.
 *
 * - Lit le script depuis ./tmp_data/script_data.json
 * - Pour chaque segment, construit un prompt unifié visuel + parole
 * - Tente génération vidéo directe via IMAGE_API_URL / VIDEO_API_URL
 * - Fallback pro local : génère image placeholder + TTS + assemblage clip avec Ken Burns
 * - Sortie : tmp_data/clips/clip_001.mp4 ... clip_XXX.mp4 (avec audio intégré)
 *
 * Remplace les anciennes étapes 2 (images) + 3 (audio) séparées.
 */

"use strict";

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const IMAGE_API_URL = process.env.IMAGE_API_URL || "https://gem-tw6a.onrender.com/generate";
const VIDEO_API_URL = process.env.VIDEO_API_URL || IMAGE_API_URL; // même endpoint peut gérer vidéo si format mp4
const attendre = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Détection FFmpeg ────────────────────────────────────────────────────────
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

function detectFFprobe(ffmpegBin) {
  try {
    execSync("ffprobe -version", { stdio: "ignore" });
    return "ffprobe";
  } catch {}
  try {
    const ffprobeInstaller = require("@ffprobe-installer/ffprobe");
    return ffprobeInstaller.path;
  } catch {}
  if (ffmpegBin && ffmpegBin !== "ffmpeg") {
    const cand = ffmpegBin.replace("ffmpeg", "ffprobe");
    try {
      execSync(`"${cand}" -version`, { stdio: "ignore" });
      return cand;
    } catch {}
  }
  return null;
}

// ─── Prompt unifié visuel + audio ───────────────────────────────────────────
function unifiedPrompt(scriptData, segment) {
  const style = scriptData.visual_style || "cinematic animated illustration";
  const movement =
    scriptData.visual_mode === "manga_motion"
      ? "Clear foreground, middle ground and background for camera movement, no speech bubbles, no text."
      : "Subtle cinematic camera movement with clear foreground and background, no text.";
  // Prompt pro : décrit l'image ET exige que la phrase soit audible dans la vidéo
  return `${style}. Scene ${segment.id}: ${segment.prompt_visuel}. ${movement} The spoken narration in French must be clearly audible and synchronized in the video: "${segment.audio_texte}". Vertical 9:16 animated video, French voiceover included, no subtitles, no watermark, high quality, smooth motion.`;
}

function imagePromptOnly(scriptData, segment) {
  const movement =
    scriptData.visual_mode === "manga_motion"
      ? "Compose for camera movement: clear foreground, middle ground and background; leave no speech bubbles."
      : "Compose for subtle cinematic camera movement with clear foreground and background.";
  return `${scriptData.visual_style || "cinematic animated illustration"}. Scene: ${segment.prompt_visuel}. ${movement}`;
}

// ─── Placeholder image ───────────────────────────────────────────────────────
function generatePlaceholderImage(imagePath, theme, ffmpegBin) {
  try {
    if (!ffmpegBin) throw new Error("FFmpeg introuvable");
    const colors = {
      dessin_anime: "0xFFEB9C",
      manga: "0x222222",
      actualites: "0x1E3A8A",
      horreur: "0x111111",
      default: "0x333333",
    };
    const color = colors[theme] || colors.default;
    const cmd = `"${ffmpegBin}" -y -f lavfi -i "color=c=${color}:s=1080x1920:d=0.1" -frames:v 1 "${imagePath}"`;
    execSync(cmd, { stdio: "ignore", timeout: 15000 });
    return fs.existsSync(imagePath) && fs.statSync(imagePath).size > 0;
  } catch (e) {
    console.warn(`⚠️ Placeholder image échoué ${path.basename(imagePath)}: ${e.message}`);
    return false;
  }
}

// ─── TTS local (fallback) ───────────────────────────────────────────────────
async function generateTTSAudio(text, audioPath, retries = 2) {
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
      fs.writeFileSync(audioPath, response.data);
      return true;
    } catch (err) {
      console.warn(`⚠️ TTS ${path.basename(audioPath)} essai ${attempt}/${retries}: ${err.message}`);
      if (attempt < retries) await attendre(attempt * 800);
    }
  }
  return false;
}

function generateSilentAudio(audioPath, durationSec, ffmpegBin) {
  try {
    if (!ffmpegBin) return false;
    const cmd = `"${ffmpegBin}" -y -f lavfi -i "anullsrc=r=44100:cl=mono" -t ${durationSec} -q:a 9 -acodec libmp3lame "${audioPath}"`;
    execSync(cmd, { stdio: "ignore", timeout: 15000 });
    return fs.existsSync(audioPath) && fs.statSync(audioPath).size > 0;
  } catch {
    return false;
  }
}

// ─── Création clip à partir d'image + audio (Ken Burns + fade) ──────────────
function generateClipFromImageAudio(ffmpegBin, imagePath, audioPath, clipPath, clipIndex) {
  // Durée audio via ffprobe si dispo, sinon estimation
  let duration = 3.0;
  try {
    const ffprobe = detectFFprobe(ffmpegBin);
    if (ffprobe) {
      const out = execSync(
        `"${ffprobe}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`,
        { encoding: "utf-8", timeout: 10000 }
      );
      const parsed = parseFloat(out.trim());
      if (!isNaN(parsed) && parsed > 0) duration = parsed;
    }
  } catch {}
  const clipDuration = duration + 0.3;
  const frames = Math.max(1, Math.ceil(clipDuration * 30));
  const move =
    clipIndex % 2 === 0
      ? `zoompan=z='min(zoom+0.0008,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30`
      : `zoompan=z='min(zoom+0.0008,1.12)':x='iw-iw/zoom':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30`;

  const audioFilter = `afade=t=in:ss=0:d=0.15,afade=t=out:st=${Math.max(0, duration - 0.95).toFixed(3)}:d=0.55`;

  const cmd = [
    `"${ffmpegBin}"`,
    `-y`,
    `-loop 1 -framerate 30 -i "${imagePath}"`,
    `-i "${audioPath}"`,
    `-filter_complex "[1:a]${audioFilter}[aout]"`,
    `-map 0:v`,
    `-map "[aout]"`,
    `-c:v libx264 -preset veryfast -pix_fmt yuv420p`,
    `-vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,${move},format=yuv420p"`,
    `-c:a aac -b:a 128k`,
    `-t ${clipDuration.toFixed(3)}`,
    `-shortest`,
    `"${clipPath}"`,
  ].join(" ");
  execSync(cmd, { timeout: 120000, stdio: ["ignore", "pipe", "pipe"] });
}

// ─── Tentative génération vidéo directe via API ─────────────────────────────
async function tryGenerateVideoViaAPI(prompt, outputPath, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Essai 1 : format mp4 avec audio
      const payloads = [
        { prompt, ratio: "9:16", format: "mp4", duration: 5, audio: true, with_audio: true },
        { prompt, ratio: "9:16", format: "mp4" },
        { prompt, ratio: "9:16", format: "mov" },
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
          // Vérifie si c'est une vidéo (pas une image jpeg)
          const header = Buffer.from(res.data).subarray(0, 12).toString("utf-8");
          const isJpeg = res.data[0] === 0xff && res.data[1] === 0xd8;
          if (isJpeg) {
            // L'API a renvoyé une image au lieu de vidéo → on la sauvegarde temporairement pour fallback local
            const tmpImg = outputPath.replace(/\.mp4$/, "_tmp.jpg");
            fs.writeFileSync(tmpImg, res.data);
            return { success: false, isImage: true, tmpImagePath: tmpImg };
          }
          // Supposons vidéo
          fs.writeFileSync(outputPath, res.data);
          if (fs.statSync(outputPath).size > 2000) {
            return { success: true, isImage: false };
          }
        } catch (e) {
          console.warn(`⚠️ Vidéo API payload ${payload.format} essai ${attempt}: ${e.message}`);
        }
      }
    } catch (err) {
      console.warn(`⚠️ Vidéo API essai ${attempt}/${retries}: ${err.message}`);
    }
    if (attempt < retries) await attendre(attempt * 2000);
  }
  return { success: false, isImage: false };
}

async function tryGenerateImageViaAPI(prompt, outputPath, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await axios.post(IMAGE_API_URL, { prompt, ratio: "9:16", format: "jpg" }, {
        responseType: "arraybuffer",
        timeout: 120000,
        validateStatus: (s) => s < 500,
      });
      if (res.status >= 400) throw new Error(`API ${res.status}`);
      if (!res.data?.byteLength) throw new Error("réponse vide");
      fs.writeFileSync(outputPath, res.data);
      return true;
    } catch (e) {
      console.warn(`⚠️ Image API essai ${attempt}/${retries}: ${e.message}`);
      if (attempt < retries) await attendre(attempt * 1500);
    }
  }
  return false;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync("./tmp_data/script_data.json")) throw new Error("script_data.json introuvable. Lancez l'étape 1.");
  const scriptData = JSON.parse(fs.readFileSync("./tmp_data/script_data.json", "utf-8"));
  const segments = scriptData.script;
  if (!Array.isArray(segments) || !segments.length) throw new Error("Aucun segment à générer.");

  const clipsFolder = path.join("./tmp_data", "clips");
  const imagesFolder = path.join("./tmp_data", "images");
  const audioFolder = path.join("./tmp_data", "audio");
  fs.mkdirSync(clipsFolder, { recursive: true });
  fs.mkdirSync(imagesFolder, { recursive: true });
  fs.mkdirSync(audioFolder, { recursive: true });

  const ffmpegBin = detectFFmpeg();
  if (!ffmpegBin) throw new Error("FFmpeg introuvable, nécessaire pour génération pro.");

  console.log(`🎬 [PRO] Génération de ${segments.length} clips vidéo avec audio intégré — ${scriptData.theme_label || scriptData.theme}`);
  console.log(`   API vidéo: ${VIDEO_API_URL}`);
  console.log(`   Stratégie: tentative vidéo directe avec audio, fallback image+TTS local → clip mp4`);

  const generatedClips = [];
  const batchSize = 3; // Limité pour ne pas surcharger API

  for (let i = 0; i < segments.length; i += batchSize) {
    const batch = segments.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (segment, offset) => {
        const pos = i + offset;
        const num = String(pos + 1).padStart(3, "0");
        const clipPath = path.join(clipsFolder, `clip_${num}.mp4`);
        const imgTmpPath = path.join(imagesFolder, `img_${num}.jpg`);
        const audioTmpPath = path.join(audioFolder, `audio_${num}.mp3`);

        if (fs.existsSync(clipPath) && fs.statSync(clipPath).size > 0) {
          console.log(`⏭️  Clip ${num} déjà présent.`);
          generatedClips.push(clipPath);
          return;
        }

        // 1. Tente génération vidéo directe avec audio intégré
        console.log(`🔄 Clip ${num} — prompt unifié avec parole...`);
        const videoAttempt = await tryGenerateVideoViaAPI(unifiedPrompt(scriptData, segment), clipPath, 2);

        if (videoAttempt.success) {
          console.log(`✅ Clip ${num} généré via API vidéo directe (avec audio).`);
          generatedClips.push(clipPath);
          return;
        }

        // 2. Fallback : l'API a renvoyé une image, ou a échoué → on génère image + audio + assemble localement
        let imagePath = null;
        if (videoAttempt.isImage && videoAttempt.tmpImagePath && fs.existsSync(videoAttempt.tmpImagePath)) {
          // Utilise l'image retournée par l'API vidéo
          fs.renameSync(videoAttempt.tmpImagePath, imgTmpPath);
          imagePath = imgTmpPath;
          console.log(`🟡 Clip ${num} — API a retourné image, passage assemblage local image+audio.`);
        } else {
          // Génère image via API image
          const okImg = await tryGenerateImageViaAPI(imagePromptOnly(scriptData, segment), imgTmpPath, 2);
          if (okImg) {
            imagePath = imgTmpPath;
          } else {
            // Placeholder
            if (generatePlaceholderImage(imgTmpPath, scriptData.theme, ffmpegBin)) {
              imagePath = imgTmpPath;
              console.log(`🟡 Placeholder image pour clip ${num}`);
            }
          }
        }

        if (!imagePath || !fs.existsSync(imagePath)) {
          console.error(`❌ Impossible d'obtenir image pour clip ${num}, clip ignoré.`);
          return;
        }

        // Génère audio TTS localement (intégré dans ce step, pas étape séparée)
        let audioPath = audioTmpPath;
        const ttsOk = await generateTTSAudio(segment.audio_texte, audioPath, 2);
        if (!ttsOk) {
          const words = segment.audio_texte.split(/\s+/).length;
          const estDur = Math.max(2.5, Math.min(6, words / 2.2));
          generateSilentAudio(audioPath, estDur, ffmpegBin);
        }

        // Assemble clip pro avec Ken Burns + fade
        try {
          generateClipFromImageAudio(ffmpegBin, imagePath, audioPath, clipPath, pos);
          console.log(`✅ Clip ${num} assemblé localement (image+audio intégré) — pro.`);
          generatedClips.push(clipPath);
        } catch (e) {
          console.error(`❌ Échec assemblage clip ${num}: ${e.message}`);
        }
      })
    );
    if (i + batchSize < segments.length) await attendre(1000);
  }

  generatedClips.sort();

  // Sauvegarde infos pour compat et pour étape 4
  const info = {
    folder: clipsFolder,
    totalClips: generatedClips.length,
    clipsList: generatedClips,
    generated_at: new Date().toISOString(),
    mode: "video_with_audio_integrated",
  };
  fs.writeFileSync("./tmp_data/clips_info.json", JSON.stringify(info, null, 2));
  // Compat : anciens fichiers attendus par step4 legacy
  fs.writeFileSync("./tmp_data/images_info.json", JSON.stringify({ folder: imagesFolder, totalFiles: generatedClips.length, imagesList: generatedClips.map(p => p.replace("clips", "images").replace(".mp4",".jpg")) }, null, 2));
  fs.writeFileSync("./tmp_data/audio_info.json", JSON.stringify({ folder: audioFolder, totalAudios: generatedClips.length, audiosList: generatedClips.map(p => p.replace("clips", "audio").replace(".mp4",".mp3")) }, null, 2));
  fs.writeFileSync("./tmp_data/video_clips_info.json", JSON.stringify(info, null, 2));

  console.log(`\n🎉 ${generatedClips.length}/${segments.length} clips vidéo avec audio intégrés prêts.`);
  console.log(`   Dossier: ${clipsFolder}`);
  if (generatedClips.length === 0) throw new Error("Aucun clip généré.");
}

main().catch((err) => {
  console.error("❌ Erreur fatale génération vidéo:", err.message);
  process.exit(1);
});
