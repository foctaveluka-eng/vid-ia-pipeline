/**
 * ÉTAPE 2 — GLAM PRO : Génération de clips vidéo via l'API Glam img2video
 *
 * Cette version utilise l'API Android Glam (community_img2vid / chained_falai_img2video)
 * pour transformer chaque image en VRAIE vidéo animée avec mouvement.
 *
 * Processus :
 *   1. Génère l'image source via IMAGE_API_URL (ou placeholder)
 *   2. Anime l'image en vidéo via l'API Glam img2video
 *   3. Ajoute l'audio TTS français via Google Translate TTS
 *   4. Assemble le clip final (vidéo Glam + audio TTS)
 *
 * Si l'API Glam n'est pas disponible, fallback sur image+audio+Ken Burns.
 *
 * Utilisation : PIPELINE_THEME=dessin_anime node scripts/step2_generate_videos_glam.js
 */

"use strict";

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const IMAGE_API_URL = process.env.IMAGE_API_URL || "https://gem-tw6a.onrender.com/generate";

let glamApi = null;
try { glamApi = require("./glam_img2video"); } catch (e) {
  console.warn("⚠️ Module glam_img2video non trouvé, fallback image+audio local.");
}

const attendre = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── FFmpeg ─────────────────────────────────────────────────────────────────
function detectFFmpeg() {
  try { execSync("ffmpeg -version", { stdio: "ignore" }); return "ffmpeg"; }
  catch {
    try { return require("@ffmpeg-installer/ffmpeg").path; }
    catch { return null; }
  }
}

function detectFFprobe(ffmpegBin) {
  try { execSync("ffprobe -version", { stdio: "ignore" }); return "ffprobe"; } catch {}
  try { return require("@ffprobe-installer/ffprobe").path; } catch {}
  if (ffmpegBin && ffmpegBin !== "ffmpeg") {
    const cand = ffmpegBin.replace("ffmpeg", "ffprobe");
    try { execSync(`"${cand}" -version`, { stdio: "ignore" }); return cand; } catch {}
  }
  return null;
}

function getAudioDuration(ffmpegBin, audioPath) {
  try {
    const ffprobe = detectFFprobe(ffmpegBin);
    if (ffprobe) {
      const out = execSync(
        `"${ffprobe}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`,
        { encoding: "utf-8", timeout: 10000 }
      );
      const d = parseFloat(out.trim());
      if (!isNaN(d) && d > 0) return d;
    }
  } catch {}
  return 3.0;
}

// ─── Prompt visuel seulement (pour génération d'image) ─────────────────────
function imagePromptOnly(scriptData, segment) {
  const movement = scriptData.visual_mode === "manga_motion"
    ? "Compose for camera movement: clear foreground, middle ground and background; leave no speech bubbles."
    : "Compose for subtle cinematic camera movement with clear foreground and background.";
  return `${scriptData.visual_style || "cinematic animated illustration"}. Scene: ${segment.prompt_visuel}. ${movement}`;
}

// ─── Image ─────────────────────────────────────────────────────────────────
async function generateImage(imagePath, prompt, retries = 3) {
  for (let a = 1; a <= retries; a++) {
    try {
      const res = await axios.post(IMAGE_API_URL, { prompt, ratio: "9:16", format: "jpg" }, {
        responseType: "arraybuffer", timeout: 120000,
        validateStatus: (s) => s < 500,
      });
      if (res.status >= 400) throw new Error(`API ${res.status}`);
      if (!res.data || res.data.byteLength < 500) throw new Error("réponse trop petite");
      fs.writeFileSync(imagePath, res.data);
      console.log(`   ✅ Image générée (${(res.data.byteLength / 1024).toFixed(1)} Ko)`);
      return true;
    } catch (e) {
      console.warn(`   ⚠️ Image API essai ${a}/${retries}: ${e.message}`);
      if (a < retries) await attendre(a * 2000);
    }
  }
  return false;
}

function generatePlaceholderImage(imagePath, theme, ffmpegBin) {
  try {
    if (!ffmpegBin) return false;
    const colors = { dessin_anime: "0xFFEB9C", manga: "0x222222", actualites: "0x1E3A8A", horreur: "0x111111", default: "0x333333" };
    const cmd = `"${ffmpegBin}" -y -f lavfi -i "color=c=${colors[theme] || colors.default}:s=1080x1920:d=0.5" -frames:v 1 "${imagePath}"`;
    execSync(cmd, { stdio: "ignore", timeout: 15000 });
    return fs.existsSync(imagePath) && fs.statSync(imagePath).size > 100;
  } catch { return false; }
}

// ─── TTS ───────────────────────────────────────────────────────────────────
async function generateTTS(text, audioPath, retries = 3) {
  for (let a = 1; a <= retries; a++) {
    try {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=fr&client=tw-ob&q=${encodeURIComponent(text)}`;
      const res = await axios.get(url, {
        responseType: "arraybuffer", timeout: 30000,
        headers: { "User-Agent": "Mozilla/5.0", Referer: "https://translate.google.com/" },
        validateStatus: (s) => s < 500,
      });
      if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
      if (!res.data || res.data.byteLength < 100) throw new Error("trop petit");
      fs.writeFileSync(audioPath, res.data);
      console.log(`   ✅ TTS généré (${(res.data.byteLength / 1024).toFixed(1)} Ko)`);
      return true;
    } catch (e) {
      console.warn(`   ⚠️ TTS essai ${a}/${retries}: ${e.message}`);
      if (a < retries) await attendre(a * 1000);
    }
  }
  return false;
}

function generateSilentAudio(audioPath, durSec, ffmpegBin) {
  try {
    if (!ffmpegBin) return false;
    const d = Math.max(1, durSec);
    execSync(`"${ffmpegBin}" -y -f lavfi -i "anullsrc=r=44100:cl=mono" -t ${d} -q:a 9 "${audioPath}"`, { stdio: "ignore", timeout: 15000 });
    return fs.existsSync(audioPath) && fs.statSync(audioPath).size > 100;
  } catch { return false; }
}

// ─── Assemblage clip local (fallback : image + TTS + Ken Burns) ───────────
function assembleClipLocal(ffmpegBin, imagePath, audioPath, clipPath, clipIndex, expectedDur) {
  const dur = expectedDur || getAudioDuration(ffmpegBin, audioPath);
  const clipDuration = dur + 0.3;
  const frames = Math.max(1, Math.ceil(clipDuration * 30));
  const move = clipIndex % 2 === 0
    ? `zoompan=z='min(zoom+0.001,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30`
    : `zoompan=z='min(zoom+0.001,1.15)':x='iw-iw/zoom':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30`;

  const audioFilter = `afade=t=in:ss=0:d=0.15,afade=t=out:st=${Math.max(0, dur - 0.8).toFixed(3)}:d=0.5`;

  const cmd = [
    `"${ffmpegBin}" -y`,
    `-loop 1 -framerate 30 -i "${imagePath}"`,
    `-i "${audioPath}"`,
    `-filter_complex "[1:a]${audioFilter}[aout]"`,
    `-map 0:v -map "[aout]"`,
    `-c:v libx264 -preset veryfast -pix_fmt yuv420p`,
    `-vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,${move},format=yuv420p"`,
    `-c:a aac -b:a 128k`,
    `-t ${clipDuration.toFixed(3)} -shortest`,
    `"${clipPath}"`,
  ].join(" ");
  
  execSync(cmd, { timeout: 120000, stdio: ["ignore", "pipe", "pipe"] });
}

// ─── Assemblage clip avec vidéo Glam + audio TTS ──────────────────────────
function assembleClipWithAudio(ffmpegBin, glamVideoPath, audioPath, clipPath, clipIndex) {
  const dur = getAudioDuration(ffmpegBin, audioPath);
  const clipDuration = Math.max(dur + 0.3, 3.0);
  const audioFilter = `afade=t=in:ss=0:d=0.15,afade=t=out:st=${Math.max(0, dur - 0.8).toFixed(3)}:d=0.5`;

  const cmd = [
    `"${ffmpegBin}" -y`,
    `-i "${glamVideoPath}"`,
    `-i "${audioPath}"`,
    `-filter_complex "[1:a]${audioFilter}[aout]"`,
    `-map 0:v -map "[aout]"`,
    `-c:v libx264 -preset veryfast -pix_fmt yuv420p`,
    `-c:a aac -b:a 128k`,
    `-t ${clipDuration.toFixed(3)} -shortest`,
    `"${clipPath}"`,
  ].join(" ");

  execSync(cmd, { timeout: 120000, stdio: ["ignore", "pipe", "pipe"] });
  console.log(`   ✅ Clip final assemblé: ${path.basename(clipPath)}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  // 1. Chargement du script
  if (!fs.existsSync("./tmp_data/script_data.json")) {
    throw new Error("❌ script_data.json introuvable. Lancez l'étape 1 d'abord (npm run step1:v3 ou npm run step1)");
  }
  const scriptData = JSON.parse(fs.readFileSync("./tmp_data/script_data.json", "utf-8"));
  const segments = scriptData.script;
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error("❌ Aucun segment dans le script");
  }

  // 2. Dossiers
  const clipsFolder = path.join("./tmp_data", "clips");
  const imagesFolder = path.join("./tmp_data", "images");
  const audioFolder = path.join("./tmp_data", "audio");
  const glamFolder = path.join("./tmp_data", "glam_raw");
  fs.mkdirSync(clipsFolder, { recursive: true });
  fs.mkdirSync(imagesFolder, { recursive: true });
  fs.mkdirSync(audioFolder, { recursive: true });
  fs.mkdirSync(glamFolder, { recursive: true });

  // 3. FFmpeg
  const ffmpegBin = detectFFmpeg();
  if (!ffmpegBin) {
    console.warn("⚠️ FFmpeg introuvable, les clips seront générés sans montage vidéo avancé");
  }

  const useGlam = glamApi !== null;
  console.log(`\n🎬 [GLAM PRO] Génération de ${segments.length} clips vidéo`);
  console.log(`   Thème : ${scriptData.theme_label || scriptData.theme}`);
  console.log(`   Moteur vidéo : ${useGlam ? "🔷 GLAM img2video (vrai mouvement IA)" : "⬜ Fallback image+audio+Ken Burns"}`);
  console.log(`   API image : ${IMAGE_API_URL}`);
  console.log(`   FFmpeg : ${ffmpegBin || "NON DISPONIBLE"}\n`);

  const generatedClips = [];
  const BATCH = 2; // 2 à la fois pour éviter de surcharger

  for (let i = 0; i < segments.length; i += BATCH) {
    const batch = segments.slice(i, i + BATCH);
    
    await Promise.all(batch.map(async (segment, offset) => {
      const pos = i + offset;
      const num = String(pos + 1).padStart(3, "0");
      const clipPath = path.join(clipsFolder, `clip_${num}.mp4`);
      const imgPath = path.join(imagesFolder, `img_${num}.jpg`);
      const audioPath = path.join(audioFolder, `audio_${num}.mp3`);
      const glamRawPath = path.join(glamFolder, `glam_${num}.mp4`);

      // Skip si déjà généré
      if (fs.existsSync(clipPath) && fs.statSync(clipPath).size > 1000) {
        console.log(`⏭️  Clip ${num} déjà présent (${(fs.statSync(clipPath).size / 1024).toFixed(1)} Ko)`);
        generatedClips.push(clipPath);
        return;
      }

      console.log(`\n━━━ Clip ${num}/${segments.length} — ${segment.audio_texte?.slice(0, 50) || ""} ━━━`);

      // ── ÉTAPE A : Image source ──
      if (!fs.existsSync(imgPath) || fs.statSync(imgPath).size < 100) {
        console.log(`   📷 Génération image...`);
        const imgOk = await generateImage(imgPath, imagePromptOnly(scriptData, segment), 3);
        if (!imgOk) {
          console.log(`   🟡 Placeholder (API image indisponible)`);
          generatePlaceholderImage(imgPath, scriptData.theme, ffmpegBin);
        }
      } else {
        console.log(`   📷 Image déjà présente (${(fs.statSync(imgPath).size / 1024).toFixed(1)} Ko)`);
      }

      // ── ÉTAPE B : Audio TTS ──
      if (!fs.existsSync(audioPath) || fs.statSync(audioPath).size < 100) {
        console.log(`   🔊 Génération audio TTS...`);
        const ttsOk = await generateTTS(segment.audio_texte, audioPath, 3);
        if (!ttsOk) {
          const words = segment.audio_texte?.split(/\s+/).length || 10;
          const estDur = Math.max(3, Math.min(8, words / 2.5));
          console.log(`   🟡 Audio silencieux (TTS indisponible, ${estDur.toFixed(1)}s)`);
          generateSilentAudio(audioPath, estDur, ffmpegBin);
        }
      } else {
        console.log(`   🔊 Audio déjà présent (${(fs.statSync(audioPath).size / 1024).toFixed(1)} Ko)`);
      }

      // ── ÉTAPE C : Vidéo animée via Glam OU Fallback ──
      let glamSuccess = false;

      if (useGlam) {
        console.log(`   🎬 Animation Glam img2video...`);
        try {
          const glamPrompt = `${segment.prompt_visuel}`;
          glamSuccess = await glamApi.generateClipFromSegment(
            { id: segment.id, prompt_visuel: glamPrompt, audio_texte: segment.audio_texte },
            imgPath,
            glamRawPath,
            { duration: 5, retries: 3 }
          );
          if (glamSuccess) {
            console.log(`   ✅ Vidéo Glam générée (${(fs.statSync(glamRawPath).size / 1024 / 1024).toFixed(2)} Mo)`);
          }
        } catch (e) {
          console.warn(`   ⚠️ Glam échoué: ${e.message}`);
          glamSuccess = false;
        }
      }

      // ── ÉTAPE D : Assemblage du clip final ──
      if (!ffmpegBin) {
        // Sans FFmpeg : copie directe
        if (glamSuccess && fs.existsSync(glamRawPath)) {
          fs.copyFileSync(glamRawPath, clipPath);
          console.log(`   ✅ Clip ${num} = vidéo Glam brute (sans FFmpeg)`);
          generatedClips.push(clipPath);
        } else if (fs.existsSync(imgPath)) {
          fs.copyFileSync(imgPath, clipPath.replace(".mp4", ".jpg"));
          console.log(`   ⚠️ Clip ${num} = image seulement (FFmpeg indisponible)`);
          // On sauvegarde quand même
          generatedClips.push(imgPath);
        }
        return;
      }

      if (glamSuccess && fs.existsSync(glamRawPath) && fs.statSync(glamRawPath).size > 1000) {
        // Cas A : Vidéo Glam + Audio TTS
        try {
          assembleClipWithAudio(ffmpegBin, glamRawPath, audioPath, clipPath, pos);
          generatedClips.push(clipPath);
        } catch (e) {
          console.warn(`   ⚠️ Assemblage Glam+Audio échoué: ${e.message}`);
          // Fallback sur copie brute
          fs.copyFileSync(glamRawPath, clipPath);
          generatedClips.push(clipPath);
        }
      } else if (fs.existsSync(imgPath)) {
        // Cas B : Image + Audio + Ken Burns (fallback)
        console.log(`   🎞️ Assemblage local (image+audio+Ken Burns)...`);
        try {
          assembleClipLocal(ffmpegBin, imgPath, audioPath, clipPath, pos);
          generatedClips.push(clipPath);
        } catch (e) {
          console.error(`   ❌ Échec assemblage clip ${num}: ${e.message}`);
        }
      } else {
        console.error(`   ❌ Impossible de générer le clip ${num}: ni image ni vidéo disponible`);
      }
    }));

    if (i + BATCH < segments.length) {
      const progress = Math.round(((i + BATCH) / segments.length) * 100);
      console.log(`\n📊 Progression : ${Math.min(i + BATCH, segments.length)}/${segments.length} (${progress}%) — pause...\n`);
      await attendre(1000);
    }
  }

  generatedClips.sort();

  // ── Sauvegarde des infos ──
  const info = {
    folder: clipsFolder,
    totalClips: generatedClips.length,
    totalSegments: segments.length,
    clipsList: generatedClips,
    generated_at: new Date().toISOString(),
    mode: useGlam ? "glam_img2video_pro" : "fallback_image_audio",
    glam_used: useGlam,
  };

  fs.writeFileSync("./tmp_data/clips_info.json", JSON.stringify(info, null, 2));
  fs.writeFileSync("./tmp_data/images_info.json", JSON.stringify({
    folder: imagesFolder, totalFiles: generatedClips.length,
    imagesList: generatedClips.map(p => p.replace("clips", "images").replace(".mp4", ".jpg"))
  }, null, 2));
  fs.writeFileSync("./tmp_data/audio_info.json", JSON.stringify({
    folder: audioFolder, totalAudios: generatedClips.length,
    audiosList: generatedClips.map(p => p.replace("clips", "audio").replace(".mp4", ".mp3"))
  }, null, 2));
  fs.writeFileSync("./tmp_data/video_clips_info.json", JSON.stringify(info, null, 2));

  console.log(`\n🎉 ${generatedClips.length}/${segments.length} clips prêts.`);
  console.log(`   Dossier: ${clipsFolder}`);
  if (generatedClips.length === 0) {
    throw new Error("❌ Aucun clip généré. Vérifiez les logs ci-dessus.");
  }
}

main().catch((err) => {
  console.error(`\n❌ Erreur fatale: ${err.message}`);
  process.exit(1);
});
