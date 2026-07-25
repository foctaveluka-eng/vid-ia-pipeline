/**
 * ÉTAPE 4 — PROFESSIONNELLE : Assemblage final de la vidéo à partir de clips avec audio intégré
 *
 * Nouveau système pro :
 * - Les clips dans tmp_data/clips/*.mp4 contiennent DÉJÀ audio + visuel (générés en étape 2)
 * - Cette étape ne fait que concaténer avec transitions pro (crossfade + acrossfade)
 * - Fallback legacy : si clips n'existent pas mais images+audio existent, génère les clips à la volée
 *
 * Supprime la dépendance à une génération audio séparée.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const FADE_IN_DURATION = 0.15;
const FADE_OUT_DURATION = 0.55;
const FADE_OUT_ANTICIPATION = 0.4;
const XFADE_DURATION = 0.5;
const BUFFER_CLIP = 0.3;

// ─── FFmpeg detection ───────────────────────────────────────────────────────
function detectFFmpeg() {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    return "ffmpeg";
  } catch {
    try {
      return require("@ffmpeg-installer/ffmpeg").path;
    } catch {
      throw new Error("FFmpeg introuvable.");
    }
  }
}

function detectFFprobe(ffmpegBin) {
  try {
    execSync("ffprobe -version", { stdio: "ignore" });
    return "ffprobe";
  } catch {}
  try {
    return require("@ffprobe-installer/ffprobe").path;
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

let ffprobeCache = null;
function getMediaDuration(ffmpegBin, filePath) {
  if (!ffprobeCache) ffprobeCache = detectFFprobe(ffmpegBin);
  if (!ffprobeCache) return 4.0;
  try {
    const out = execSync(
      `"${ffprobeCache}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: "utf-8", timeout: 15000 }
    );
    const d = parseFloat(out.trim());
    return isNaN(d) ? 4.0 : d;
  } catch {
    return 4.0;
  }
}

// ─── Legacy clip generation (fallback) ─────────────────────────────────────
function generateClipLegacy(ffmpegBin, imgPath, audioPath, clipPath, durationAudio, index) {
  const clipDuration = durationAudio + BUFFER_CLIP;
  const frames = Math.max(1, Math.ceil(clipDuration * 30));
  const move =
    index % 2 === 0
      ? `zoompan=z='min(zoom+0.0008,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30`
      : `zoompan=z='min(zoom+0.0008,1.12)':x='iw-iw/zoom':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30`;
  const debutFadeOut = Math.max(0, durationAudio - FADE_OUT_ANTICIPATION - FADE_OUT_DURATION);
  const audioFilter = `afade=t=in:ss=0:d=${FADE_IN_DURATION},afade=t=out:st=${debutFadeOut.toFixed(3)}:d=${FADE_OUT_DURATION}`;
  const cmd = [
    `"${ffmpegBin}" -y`,
    `-loop 1 -framerate 30 -i "${imgPath}"`,
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

// ─── Assemblage crossfade ───────────────────────────────────────────────────
function assembleWithCrossfade(ffmpegBin, clips, outputPath) {
  if (clips.length === 1) {
    fs.copyFileSync(clips[0], outputPath);
    return;
  }

  const durations = clips.map((c) => getMediaDuration(ffmpegBin, c));
  const inputs = clips.map((c) => `-i "${c}"`).join(" ");

  let filterLines = [];
  let curA = "[0:a]";
  let curV = "[0:v]";

  for (let i = 1; i < clips.length; i++) {
    const nextA = `[${i}:a]`;
    const nextV = `[${i}:v]`;
    const outA = i === clips.length - 1 ? "[afinal]" : `[a${i}]`;
    const outV = i === clips.length - 1 ? "[vfinal]" : `[v${i}]`;
    filterLines.push(`${curA}${nextA}acrossfade=d=${XFADE_DURATION}:c1=exp:c2=exp${outA}`);
    const offset = durations.slice(0, i).reduce((a, b) => a + b, 0) - XFADE_DURATION * i;
    filterLines.push(`${curV}${nextV}xfade=transition=fade:duration=${XFADE_DURATION}:offset=${Math.max(0, offset).toFixed(3)}${outV}`);
    curA = outA;
    curV = outV;
  }

  const cmd = [
    `"${ffmpegBin}" -y`,
    inputs,
    `-filter_complex "${filterLines.join(";")}"`,
    `-map "[vfinal]" -map "[afinal]"`,
    `-c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac -b:a 128k`,
    `"${outputPath}"`,
  ].join(" ");
  execSync(cmd, { timeout: 600000, stdio: ["ignore", "pipe", "pipe"] });
}

function assembleSimpleConcat(ffmpegBin, clips, outputPath) {
  console.log("🔄 Concat simple (fallback)...");
  const listFile = path.join("./tmp_data", "clips_list.txt");
  const content = clips
    .map((c) => {
      const abs = path.resolve(c).replace(/'/g, "'\\''");
      return `file '${abs}'`;
    })
    .join("\n");
  fs.writeFileSync(listFile, content, "utf-8");

  try {
    execSync(`"${ffmpegBin}" -y -f concat -safe 0 -i "${listFile}" -c copy "${outputPath}"`, {
      timeout: 600000,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    console.warn("⚠️ copy échoué, re-encode...");
    execSync(
      `"${ffmpegBin}" -y -f concat -safe 0 -i "${listFile}" -c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac -b:a 128k "${outputPath}"`,
      { timeout: 600000, stdio: ["ignore", "pipe", "pipe"] }
    );
  }
}

// ─── MAIN ───────────────────────────────────────────────────────────────────
async function main() {
  const ffmpegBin = detectFFmpeg();
  ffprobeCache = detectFFprobe(ffmpegBin);
  console.log(`🔧 FFmpeg: ${ffmpegBin} | FFprobe: ${ffprobeCache || "fallback"}`);

  // Lecture script pour nombre attendu
  if (!fs.existsSync("./tmp_data/script_data.json")) throw new Error("script_data.json manquant");
  const scriptData = JSON.parse(fs.readFileSync("./tmp_data/script_data.json", "utf-8"));
  const expected = scriptData.script?.length || 0;

  // 1. Cherche clips pro déjà existants
  const clipsFolder = "./tmp_data/clips";
  fs.mkdirSync(clipsFolder, { recursive: true });

  let clips = [];
  if (fs.existsSync("./tmp_data/clips_info.json")) {
    try {
      const info = JSON.parse(fs.readFileSync("./tmp_data/clips_info.json", "utf-8"));
      clips = (info.clipsList || []).filter((p) => fs.existsSync(p) && fs.statSync(p).size > 0);
    } catch {}
  }
  if (clips.length === 0) {
    // Scan dossier
    if (fs.existsSync(clipsFolder)) {
      clips = fs
        .readdirSync(clipsFolder)
        .filter((f) => f.endsWith(".mp4"))
        .map((f) => path.join(clipsFolder, f))
        .filter((p) => fs.statSync(p).size > 0)
        .sort();
    }
  }

  // 2. Fallback legacy : si pas de clips mais images+audio existent → génère clips
  if (clips.length === 0) {
    console.log("⚠️ Aucun clip pro trouvé, tentative fallback legacy images+audio...");
    if (fs.existsSync("./tmp_data/images_info.json") && fs.existsSync("./tmp_data/audio_info.json")) {
      const imagesInfo = JSON.parse(fs.readFileSync("./tmp_data/images_info.json", "utf-8"));
      const audioInfo = JSON.parse(fs.readFileSync("./tmp_data/audio_info.json", "utf-8"));
      const poolImages = imagesInfo.imagesList || [];
      const poolAudios = audioInfo.audiosList || [];
      const maxClips = Math.min(poolImages.length, poolAudios.length, expected);
      console.log(`📥 Génération legacy de ${maxClips} clips depuis images+audio...`);
      for (let i = 0; i < maxClips; i++) {
        const clipPath = path.join(clipsFolder, `clip_${String(i + 1).padStart(3, "0")}.mp4`);
        if (fs.existsSync(clipPath) && fs.statSync(clipPath).size > 0) {
          clips.push(clipPath);
          continue;
        }
        try {
          const dur = getMediaDuration(ffmpegBin, poolAudios[i]);
          generateClipLegacy(ffmpegBin, poolImages[i], poolAudios[i], clipPath, dur, i);
          clips.push(clipPath);
          console.log(`✅ Clip legacy ${i + 1} généré`);
        } catch (e) {
          console.error(`❌ Clip legacy ${i + 1}: ${e.message}`);
        }
      }
    }
  }

  if (clips.length === 0) {
    console.error("❌ Aucun clip disponible pour assemblage final.");
    process.exit(1);
  }

  clips.sort();
  console.log(`\n📦 ${clips.length}/${expected || clips.length} clips prêts pour assemblage final (audio déjà intégré).`);

  const finalPath = "./tmp_data/video_finale.mp4";
  console.log(`\n🎬 Assemblage final pro avec crossfade ${XFADE_DURATION}s...`);

  try {
    if (clips.length > 1) {
      assembleWithCrossfade(ffmpegBin, clips, finalPath);
    } else {
      fs.copyFileSync(clips[0], finalPath);
    }
  } catch (err) {
    console.warn(`⚠️ Crossfade échoué (${err.message}), concat simple...`);
    assembleSimpleConcat(ffmpegBin, clips, finalPath);
  }

  const stats = fs.statSync(finalPath);
  const tailleMo = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`\n🎉 Vidéo finale PRO créée !`);
  console.log(`   Taille: ${tailleMo} Mo`);
  console.log(`   Chemin: ${path.resolve(finalPath)}`);
  console.log(`   Clips: ${clips.length} (audio intégré)`);

  fs.writeFileSync(
    "./tmp_data/video_info.json",
    JSON.stringify(
      {
        videoPath: path.resolve(finalPath),
        tailleMo,
        nbClips: clips.length,
        mode: "pro_clips_with_audio_integrated",
        created_at: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf-8"
  );
}

main().catch((err) => {
  console.error("❌ Erreur fatale assemblage:", err.message);
  process.exit(1);
});
