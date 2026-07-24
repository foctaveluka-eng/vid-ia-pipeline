/**
 * ÉTAPE 4 — Assemblage de la Vidéo Finale (FFmpeg)
 * VERSION ROBUSTE — Transitions audio/vidéo fluides + fallback concat
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ─── Configuration des transitions ───────────────────────────────────────────
const FADE_IN_DURATION = 0.15;
const FADE_OUT_DURATION = 0.55;
const FADE_OUT_ANTICIPATION = 0.4;
const XFADE_DURATION = 0.5;
const BUFFER_CLIP = 0.3;

// ─── Détection de ffmpeg/ffprobe ────────────────────────────────────────────
function detectFFmpeg() {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    return "ffmpeg";
  } catch {
    try {
      const installer = require("@ffmpeg-installer/ffmpeg");
      return installer.path;
    } catch {
      throw new Error("FFmpeg introuvable. Installez-le ou ajoutez @ffmpeg-installer/ffmpeg.");
    }
  }
}

function detectFFprobe(ffmpegBin) {
  // Si ffmpeg système disponible, ffprobe aussi probablement
  try {
    execSync("ffprobe -version", { stdio: "ignore" });
    return "ffprobe";
  } catch {}
  // Essaie de déduire depuis le binaire ffmpeg installer
  if (ffmpegBin && ffmpegBin.includes("@ffmpeg-installer")) {
    // Tente @ffprobe-installer via require
    try {
      const ffprobeInstaller = require("@ffprobe-installer/ffprobe");
      return ffprobeInstaller.path;
    } catch {}
    // Fallback heuristique : remplace chemin ffmpeg -> ffprobe
    try {
      const candidate = ffmpegBin.replace("ffmpeg", "ffprobe");
      execSync(`"${candidate}" -version`, { stdio: "ignore" });
      return candidate;
    } catch {}
    // Essaie aussi le dossier sibling
    try {
      const candidate2 = ffmpegBin.replace("@ffmpeg-installer", "@ffprobe-installer").replace("ffmpeg", "ffprobe");
      execSync(`"${candidate2}" -version`, { stdio: "ignore" });
      return candidate2;
    } catch {}
  }
  // Dernier recours : chemin fourni par remplacement simple
  if (ffmpegBin !== "ffmpeg") {
    const candidate = ffmpegBin.replace("ffmpeg", "ffprobe");
    try {
      execSync(`"${candidate}" -version`, { stdio: "ignore" });
      return candidate;
    } catch {}
  }
  return null;
}

// ─── Mesure de durée audio via ffprobe ───────────────────────────────────────
let ffprobeBinCache = null;
function getAudioDuration(ffmpegBin, filePath) {
  if (!ffprobeBinCache) {
    ffprobeBinCache = detectFFprobe(ffmpegBin);
  }
  if (!ffprobeBinCache) {
    console.warn(`⚠️  ffprobe introuvable, durée par défaut 3.0s pour ${path.basename(filePath)}`);
    return 3.0;
  }
  try {
    const result = execSync(
      `"${ffprobeBinCache}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: "utf-8", timeout: 15000 }
    );
    const duration = parseFloat(result.trim());
    return isNaN(duration) ? 3.0 : duration;
  } catch {
    console.warn(`⚠️  Durée introuvable pour ${path.basename(filePath)} → 3.0s par défaut`);
    return 3.0;
  }
}

// ─── Génération d'un clip unique (image + audio + fades) ─────────────────────
function generateClip(ffmpegBin, pathImg, pathAudio, clipPath, dureeAudio, clipIndex) {
  const dureeClip = dureeAudio + BUFFER_CLIP;
  const frames = Math.max(1, Math.ceil(dureeClip * 30));
  const move = clipIndex % 2 === 0
    ? `zoompan=z='min(zoom+0.0008,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30`
    : `zoompan=z='min(zoom+0.0008,1.12)':x='iw-iw/zoom':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30`;

  const debutFadeOut = Math.max(0, dureeAudio - FADE_OUT_ANTICIPATION - FADE_OUT_DURATION);
  const audioFilter = [
    `afade=t=in:ss=0:d=${FADE_IN_DURATION}`,
    `afade=t=out:st=${debutFadeOut.toFixed(3)}:d=${FADE_OUT_DURATION}`,
  ].join(",");

  const cmd = [
    `"${ffmpegBin}"`,
    `-y`,
    `-loop 1 -framerate 30 -i "${pathImg}"`,
    `-i "${pathAudio}"`,
    `-filter_complex`,
    `"[1:a]${audioFilter}[aout]"`,
    `-map 0:v`,
    `-map "[aout]"`,
    `-c:v libx264 -preset veryfast -pix_fmt yuv420p`,
    `-vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,${move},format=yuv420p"`,
    `-c:a aac -b:a 128k`,
    `-t ${dureeClip.toFixed(3)}`,
    `-shortest`,
    `"${clipPath}"`,
  ].join(" ");

  execSync(cmd, { timeout: 120000, stdio: ["ignore", "pipe", "pipe"] });
}

// ─── Assemblage final avec crossfade audio+vidéo ─────────────────────────────
function assembleWithCrossfade(ffmpegBin, clips, outputPath) {
  if (clips.length === 1) {
    fs.copyFileSync(clips[0], outputPath);
    return;
  }

  const durees = clips.map((c) => {
    try {
      const probe = ffprobeBinCache || detectFFprobe(ffmpegBin);
      if (!probe) return 4.0;
      const r = execSync(
        `"${probe}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${c}"`,
        { encoding: "utf-8", timeout: 15000 }
      );
      return parseFloat(r.trim()) || 4.0;
    } catch {
      return 4.0;
    }
  });

  const inputs = clips.map((c) => `-i "${c}"`).join(" ");

  let filterLines = [];
  let currentAudio = "[0:a]";
  let currentVideo = "[0:v]";

  for (let i = 1; i < clips.length; i++) {
    const nextAudio = `[${i}:a]`;
    const nextVideo = `[${i}:v]`;
    const outAudio = i === clips.length - 1 ? "[afinal]" : `[a${i}]`;
    const outVideo = i === clips.length - 1 ? "[vfinal]" : `[v${i}]`;

    filterLines.push(
      `${currentAudio}${nextAudio}acrossfade=d=${XFADE_DURATION}:c1=exp:c2=exp${outAudio}`
    );

    const offset = durees.slice(0, i).reduce((a, b) => a + b, 0) - XFADE_DURATION * i;
    filterLines.push(
      `${currentVideo}${nextVideo}xfade=transition=fade:duration=${XFADE_DURATION}:offset=${Math.max(0, offset).toFixed(3)}${outVideo}`
    );

    currentAudio = outAudio;
    currentVideo = outVideo;
  }

  const filterComplex = filterLines.join(";");

  const cmd = [
    `"${ffmpegBin}"`,
    `-y`,
    inputs,
    `-filter_complex "${filterComplex}"`,
    `-map "[vfinal]"`,
    `-map "[afinal]"`,
    `-c:v libx264 -preset veryfast -pix_fmt yuv420p`,
    `-c:a aac -b:a 128k`,
    `"${outputPath}"`,
  ].join(" ");

  execSync(cmd, { timeout: 600000, stdio: ["ignore", "pipe", "pipe"] });
}

// ─── Assemblage de secours (concat simple si xfade échoue) ───────────────────
function assembleSimpleConcat(ffmpegBin, clips, outputPath) {
  console.log("🔄 Utilisation du mode concat simple (fallback)...");

  const listFile = path.join("./tmp_data", "clips_list.txt");
  // Utiliser des chemins absolus pour éviter le double préfixe tmp_data/tmp_data
  const listContent = clips
    .map((c) => {
      const abs = path.resolve(c);
      // Escape single quotes
      const escaped = abs.replace(/'/g, "'\\''");
      return `file '${escaped}'`;
    })
    .join("\n");
  fs.writeFileSync(listFile, listContent, "utf-8");

  const cmd = [
    `"${ffmpegBin}"`,
    `-y`,
    `-f concat -safe 0 -i "${listFile}"`,
    `-c copy`,
    `"${outputPath}"`,
  ].join(" ");

  try {
    execSync(cmd, { timeout: 600000, stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    // Si -c copy échoue (codecs différents), ré-encode
    console.warn(`⚠️ concat copy échoué, tentative ré-encodage: ${e.message}`);
    const cmd2 = [
      `"${ffmpegBin}"`,
      `-y`,
      `-f concat -safe 0 -i "${listFile}"`,
      `-c:v libx264 -preset veryfast -pix_fmt yuv420p`,
      `-c:a aac -b:a 128k`,
      `"${outputPath}"`,
    ].join(" ");
    execSync(cmd2, { timeout: 600000, stdio: ["ignore", "pipe", "pipe"] });
  }
}

// ─── PROGRAMME PRINCIPAL ──────────────────────────────────────────────────────
async function main() {
  const ffmpegBin = detectFFmpeg();
  ffprobeBinCache = detectFFprobe(ffmpegBin);
  console.log(`🔧 FFmpeg détecté : ${ffmpegBin}`);
  console.log(`🔧 FFprobe détecté : ${ffprobeBinCache || "non trouvé (fallback 3s)"}`);

  if (
    !fs.existsSync("./tmp_data/images_info.json") ||
    !fs.existsSync("./tmp_data/audio_info.json")
  ) {
    console.error("❌ Fichiers images_info.json ou audio_info.json manquants.");
    process.exit(1);
  }

  const imagesInfo = JSON.parse(fs.readFileSync("./tmp_data/images_info.json", "utf-8"));
  const audioInfo = JSON.parse(fs.readFileSync("./tmp_data/audio_info.json", "utf-8"));

  const poolImages = imagesInfo.imagesList;
  const poolAudios = audioInfo.audiosList;
  const scriptData = JSON.parse(fs.readFileSync("./tmp_data/script_data.json", "utf-8"));
  const expectedClips = Array.isArray(scriptData.script) ? scriptData.script.length : 0;
  const maxClips = Math.min(poolImages.length, poolAudios.length, expectedClips);

  if (maxClips === 0) {
    console.error("❌ Aucun fichier image ou audio trouvé.");
    process.exit(1);
  }

  const dossierClips = "./tmp_data/clips";
  fs.mkdirSync(dossierClips, { recursive: true });

  console.log(`\n📥 [1/2] Génération de ${maxClips} clips avec transitions audio optimisées...`);
  const clipsGeneres = [];

  for (let i = 0; i < maxClips; i++) {
    const clipPath = path.join(dossierClips, `clip_${String(i + 1).padStart(3, "0")}.mp4`);
    const dureeAudio = getAudioDuration(ffmpegBin, poolAudios[i]);
    const numStr = String(i + 1).padStart(3, "0");

    if (fs.existsSync(clipPath) && fs.statSync(clipPath).size > 0) {
      console.log(`⏭️  Clip ${numStr} déjà présent.`);
      clipsGeneres.push(clipPath);
      continue;
    }

    try {
      generateClip(ffmpegBin, poolImages[i], poolAudios[i], clipPath, dureeAudio, i);
      clipsGeneres.push(clipPath);
      console.log(`✅ Clip ${numStr} — ${dureeAudio.toFixed(1)}s audio → ${(dureeAudio + BUFFER_CLIP).toFixed(1)}s clip`);
    } catch (err) {
      console.error(`❌ Erreur clip ${numStr}: ${err.message}`);
    }
  }

  if (clipsGeneres.length === 0) {
    console.error("❌ Aucun clip généré. Arrêt.");
    process.exit(1);
  }

  console.log(`\n✅ ${clipsGeneres.length}/${maxClips} clips générés avec succès.`);

  const pathVideoFinale = "./tmp_data/video_finale.mp4";
  console.log(`\n🎬 [2/2] Assemblage final avec crossfade (${XFADE_DURATION}s entre clips)...`);

  try {
    if (clipsGeneres.length > 1) {
      assembleWithCrossfade(ffmpegBin, clipsGeneres, pathVideoFinale);
    } else {
      fs.copyFileSync(clipsGeneres[0], pathVideoFinale);
    }
  } catch (errXfade) {
    console.warn(`⚠️  Crossfade échoué (${errXfade.message}), tentative concat simple...`);
    try {
      assembleSimpleConcat(ffmpegBin, clipsGeneres, pathVideoFinale);
    } catch (errConcat) {
      console.error("❌ Échec assemblage final :", errConcat.message);
      process.exit(1);
    }
  }

  const stats = fs.statSync(pathVideoFinale);
  const tailleMo = (stats.size / (1024 * 1024)).toFixed(2);

  console.log(`\n🎉 Vidéo finale créée avec succès !`);
  console.log(`   Taille   : ${tailleMo} Mo`);
  console.log(`   Chemin   : ${path.resolve(pathVideoFinale)}`);
  console.log(`   Clips    : ${clipsGeneres.length}`);
  console.log(`   Fade-out : démarre ${FADE_OUT_ANTICIPATION + FADE_OUT_DURATION}s avant la fin de chaque audio`);

  fs.writeFileSync(
    "./tmp_data/video_info.json",
    JSON.stringify({
      videoPath: path.resolve(pathVideoFinale),
      tailleMo,
      nbClips: clipsGeneres.length,
      created_at: new Date().toISOString(),
    }, null, 2),
    "utf-8"
  );
}

main().catch((err) => {
  console.error("❌ Erreur fatale :", err.message);
  process.exit(1);
});
