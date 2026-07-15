/**
 * ÉTAPE 4 — Assemblage de la Vidéo Finale (FFmpeg)
 * VERSION OPTIMISÉE — Transitions audio/vidéo fluides
 *
 * Corrections apportées vs Pipedream :
 *   ✅ Le fade-out audio commence AVANT la fin (plus de coupure brutale)
 *   ✅ Crossfade audio entre les clips (transition douce)
 *   ✅ Xfade vidéo entre les clips (transition visuelle fluide)
 *   ✅ Temps de clip = durée audio réelle (pas de silence forcé)
 *   ✅ Gestion des timeouts Node.js augmentés
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ─── Configuration des transitions ───────────────────────────────────────────
const FADE_IN_DURATION    = 0.15;  // s — fondu entrant audio
const FADE_OUT_DURATION   = 0.55;  // s — fondu sortant audio (commence AVANT la fin)
const FADE_OUT_ANTICIPATION = 0.4; // s — décalage avant la fin pour éviter la coupure
const XFADE_DURATION      = 0.5;   // s — crossfade vidéo entre clips
const BUFFER_CLIP         = 0.3;   // s — petit buffer après l'audio

// ─── Détection de ffmpeg ──────────────────────────────────────────────────────
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

// ─── Mesure de durée audio via ffprobe ───────────────────────────────────────
function getAudioDuration(ffmpegBin, filePath) {
  const ffprobeBin = ffmpegBin === "ffmpeg" ? "ffprobe" : ffmpegBin.replace("ffmpeg", "ffprobe");
  try {
    const result = execSync(
      `"${ffprobeBin}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
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
function generateClip(ffmpegBin, pathImg, pathAudio, clipPath, dureeAudio) {
  const dureeClip = dureeAudio + BUFFER_CLIP;

  // Le fade-out COMMENCE avant la fin de l'audio pour ne pas couper le son
  const debutFadeOut = Math.max(0, dureeAudio - FADE_OUT_ANTICIPATION - FADE_OUT_DURATION);

  // Filtre audio : fade in au début + fade out AVANT la fin
  const audioFilter = [
    `afade=t=in:ss=0:d=${FADE_IN_DURATION}`,
    `afade=t=out:st=${debutFadeOut.toFixed(3)}:d=${FADE_OUT_DURATION}`,
  ].join(",");

  const cmd = [
    `"${ffmpegBin}"`,
    `-y`,
    `-loop 1 -i "${pathImg}"`,   // image en boucle
    `-i "${pathAudio}"`,          // audio
    `-filter_complex`,
    `"[1:a]${audioFilter}[aout]"`,
    `-map 0:v`,
    `-map "[aout]"`,
    `-c:v libx264 -preset veryfast -pix_fmt yuv420p`,
    `-vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2"`,
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
    // Cas trivial : 1 seul clip
    fs.copyFileSync(clips[0], outputPath);
    return;
  }

  // Calcul des durées de chaque clip pour le crossfade vidéo
  const durees = clips.map((c) => {
    try {
      const ffprobeBin = ffmpegBin === "ffmpeg" ? "ffprobe" : ffmpegBin.replace("ffmpeg", "ffprobe");
      const r = execSync(
        `"${ffprobeBin}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${c}"`,
        { encoding: "utf-8", timeout: 15000 }
      );
      return parseFloat(r.trim()) || 4.0;
    } catch {
      return 4.0;
    }
  });

  // Construction du filtre complexe pour xfade vidéo + acrossfade audio
  // Stratégie : concaténation simple mais avec acrossfade audio entre clips
  // (plus robuste que xfade pour de nombreux clips)
  const inputs = clips.map((c) => `-i "${c}"`).join(" ");

  // Construire le filtre audio avec acrossfade entre chaque paire de clips
  let filterLines = [];
  let currentAudio = "[0:a]";
  let currentVideo = "[0:v]";

  for (let i = 1; i < clips.length; i++) {
    const nextAudio = `[${i}:a]`;
    const nextVideo = `[${i}:v]`;
    const outAudio  = i === clips.length - 1 ? "[afinal]" : `[a${i}]`;
    const outVideo  = i === clips.length - 1 ? "[vfinal]" : `[v${i}]`;

    // Crossfade audio : transition douce entre fin d'un clip et début du suivant
    filterLines.push(
      `${currentAudio}${nextAudio}acrossfade=d=${XFADE_DURATION}:c1=exp:c2=exp${outAudio}`
    );

    // Crossfade vidéo : fondu enchaîné entre clips
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

  execSync(cmd, { timeout: 600000, stdio: ["ignore", "pipe", "pipe"] }); // 10 min max
}

// ─── Assemblage de secours (concat simple si xfade échoue) ───────────────────
function assembleSimpleConcat(ffmpegBin, clips, outputPath) {
  console.log("🔄 Utilisation du mode concat simple (fallback)...");

  const listFile = path.join("./tmp_data", "clips_list.txt");
  const listContent = clips.map((c) => `file '${c.replace(/\\/g, "/")}'`).join("\n");
  fs.writeFileSync(listFile, listContent, "utf-8");

  const cmd = [
    `"${ffmpegBin}"`,
    `-y`,
    `-f concat -safe 0 -i "${listFile}"`,
    `-c:v libx264 -preset veryfast -pix_fmt yuv420p`,
    `-c:a aac -b:a 128k`,
    `"${outputPath}"`,
  ].join(" ");

  execSync(cmd, { timeout: 600000, stdio: ["ignore", "pipe", "pipe"] });
}

// ─── PROGRAMME PRINCIPAL ──────────────────────────────────────────────────────
async function main() {
  const ffmpegBin = detectFFmpeg();
  console.log(`🔧 FFmpeg détecté : ${ffmpegBin}`);

  // Lecture des listes d'images et d'audios
  if (
    !fs.existsSync("./tmp_data/images_info.json") ||
    !fs.existsSync("./tmp_data/audio_info.json")
  ) {
    console.error("❌ Fichiers images_info.json ou audio_info.json manquants.");
    process.exit(1);
  }

  const imagesInfo = JSON.parse(fs.readFileSync("./tmp_data/images_info.json", "utf-8"));
  const audioInfo  = JSON.parse(fs.readFileSync("./tmp_data/audio_info.json",  "utf-8"));

  const poolImages = imagesInfo.imagesList;
  const poolAudios = audioInfo.audiosList;
  const maxClips   = Math.min(poolImages.length, poolAudios.length, 16);

  if (maxClips === 0) {
    console.error("❌ Aucun fichier image ou audio trouvé.");
    process.exit(1);
  }

  const dossierClips = "./tmp_data/clips";
  fs.mkdirSync(dossierClips, { recursive: true });

  // ── Étape 1 : Génération des clips individuels ──────────────────────────────
  console.log(`\n📥 [1/2] Génération de ${maxClips} clips avec transitions audio optimisées...`);
  const clipsGeneres = [];

  for (let i = 0; i < maxClips; i++) {
    const clipPath    = path.join(dossierClips, `clip_${String(i + 1).padStart(2, "0")}.mp4`);
    const dureeAudio  = getAudioDuration(ffmpegBin, poolAudios[i]);
    const numStr      = String(i + 1).padStart(2, "0");

    // Si le clip existe déjà et n'est pas vide, on passe
    if (fs.existsSync(clipPath) && fs.statSync(clipPath).size > 0) {
      console.log(`⏭️  Clip ${numStr} déjà présent.`);
      clipsGeneres.push(clipPath);
      continue;
    }

    try {
      generateClip(ffmpegBin, poolImages[i], poolAudios[i], clipPath, dureeAudio);
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

  // ── Étape 2 : Assemblage final ───────────────────────────────────────────────
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

  const stats    = fs.statSync(pathVideoFinale);
  const tailleMo = (stats.size / (1024 * 1024)).toFixed(2);

  console.log(`\n🎉 Vidéo finale créée avec succès !`);
  console.log(`   Taille   : ${tailleMo} Mo`);
  console.log(`   Chemin   : ${path.resolve(pathVideoFinale)}`);
  console.log(`   Clips    : ${clipsGeneres.length}`);
  console.log(`   Fade-out : démarre ${FADE_OUT_ANTICIPATION + FADE_OUT_DURATION}s avant la fin de chaque audio`);

  // Sauvegarde des infos pour les étapes suivantes
  fs.writeFileSync(
    "./tmp_data/video_info.json",
    JSON.stringify({
      videoPath:  path.resolve(pathVideoFinale),
      tailleMo,
      nbClips:    clipsGeneres.length,
      created_at: new Date().toISOString(),
    }, null, 2),
    "utf-8"
  );
}

main().catch((err) => {
  console.error("❌ Erreur fatale :", err.message);
  process.exit(1);
});
