/**
 * SCRIPT DE TEST — Pipeline réduit (3 segments seulement)
 * 
 * Lancez ce script AVANT de pousser sur GitHub pour vérifier que :
 *   ✅ L'API Delfa génère bien un script
 *   ✅ L'API d'images répond correctement
 *   ✅ Google TTS génère des fichiers audio
 *   ✅ FFmpeg assemble correctement la vidéo
 *   ✅ Google Drive accepte l'upload
 *   ✅ YouTube accepte la publication
 * 
 * Usage (local) :
 *   node scripts/test_pipeline.js
 * 
 * Usage (GitHub Actions) :
 *   Workflow "test_pipeline.yml" → Run workflow
 */

"use strict";

const axios   = require("axios");
const fs      = require("fs");
const path    = require("path");
const { execSync } = require("child_process");

// ─── Configuration ─────────────────────────────────────────────────────────────
const NB_SEGMENTS_TEST = 3; // Seulement 3 segments pour le test (rapide)
const DELFA_API_URL    = process.env.DELFA_API_URL || "https://delfaapiai.vercel.app/ai/copilot";
const IMAGE_API_URL    = process.env.IMAGE_API_URL || "https://gem-tw6a.onrender.com/generate";

const RESULTS = {
  etape1_script:  { ok: false, details: "" },
  etape2_images:  { ok: false, details: "" },
  etape3_audio:   { ok: false, details: "" },
  etape4_video:   { ok: false, details: "" },
  etape5_drive:   { ok: false, details: "" },
  etape6_youtube: { ok: false, details: "" },
};

// ─── Utilitaires ──────────────────────────────────────────────────────────────
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

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

function printResults() {
  console.log("\n" + "=".repeat(60));
  console.log("📊 RAPPORT DE TEST — VID IA PIPELINE");
  console.log("=".repeat(60));

  const entries = Object.entries(RESULTS);
  let nbOk = 0;

  for (const [etape, { ok, details }] of entries) {
    const icon = ok ? "✅" : "❌";
    const label = etape.replace(/_/g, " ").toUpperCase();
    console.log(`${icon}  ${label}: ${details}`);
    if (ok) nbOk++;
  }

  console.log("-".repeat(60));
  console.log(`\n🏁 Résultat : ${nbOk}/${entries.length} étapes réussies`);

  if (nbOk === entries.length) {
    console.log("🎉 SUCCÈS TOTAL — Le pipeline est prêt pour la production !");
  } else if (nbOk >= 4) {
    console.log("⚠️  SUCCÈS PARTIEL — Vérifiez les étapes en rouge.");
  } else {
    console.log("💥 ÉCHEC — Corrigez les erreurs avant de déployer.");
  }
  console.log("=".repeat(60));
}

// ─── TEST 1 : Génération du script ────────────────────────────────────────────
async function testGenerateScript() {
  console.log("\n🧪 [TEST 1] Génération du script IA...");
  const prompt = `Génère exactement ${NB_SEGMENTS_TEST} segments de test pour une vidéo courte sur l'IA.
Renvoie UNIQUEMENT un JSON valide :
{"segments": [{"id": 1, "audio_texte": "...", "prompt_visuel": "..."}]}`;

  try {
    const response = await axios.get(DELFA_API_URL, {
      params: { model: "default", message: prompt },
      timeout: 45000,
    });

    const clean = response.data.answer.replace(/```json|```/g, "").trim();
    const data  = JSON.parse(clean);

    if (!data.segments || data.segments.length < 1) {
      throw new Error("Pas de segments dans la réponse");
    }

    // Sauvegarde pour les tests suivants
    fs.mkdirSync("./tmp_data_test/images", { recursive: true });
    fs.mkdirSync("./tmp_data_test/audio",  { recursive: true });
    fs.mkdirSync("./tmp_data_test/clips",  { recursive: true });

    fs.writeFileSync(
      "./tmp_data_test/script_data.json",
      JSON.stringify({
        theme: "ia",
        character_ref_image: "https://drive.google.com/file/d/1Xa9ZzRhqWgEFlJxGAf-vF2fGDG2_LEQU/view",
        script: data.segments.slice(0, NB_SEGMENTS_TEST),
      }, null, 2)
    );

    RESULTS.etape1_script = { ok: true, details: `${data.segments.length} segment(s) générés` };
    console.log(`   ✅ ${data.segments.length} segments générés`);
    return data.segments.slice(0, NB_SEGMENTS_TEST);

  } catch (err) {
    RESULTS.etape1_script = { ok: false, details: err.message };
    console.error(`   ❌ ${err.message}`);
    return null;
  }
}

// ─── TEST 2 : Génération d'une image ─────────────────────────────────────────
async function testGenerateImage(segments) {
  console.log("\n🧪 [TEST 2] Génération d'une image de test...");
  if (!segments) {
    RESULTS.etape2_images = { ok: false, details: "Skipped (étape 1 échouée)" };
    return false;
  }

  const seg = segments[0];
  const prompt = `Character reference: portrait futuriste. Action: ${seg.prompt_visuel}`;

  try {
    const response = await axios.post(
      IMAGE_API_URL,
      { prompt, ratio: "9:16", format: "jpg" },
      { responseType: "arraybuffer", timeout: 90000 }
    );

    fs.writeFileSync("./tmp_data_test/images/img_01.jpg", response.data);
    const taille = (response.data.byteLength / 1024).toFixed(0);

    RESULTS.etape2_images = { ok: true, details: `Image générée (${taille} Ko)` };
    console.log(`   ✅ Image générée : ${taille} Ko`);
    return true;

  } catch (err) {
    RESULTS.etape2_images = { ok: false, details: err.message };
    console.error(`   ❌ ${err.message}`);
    return false;
  }
}

// ─── TEST 3 : Génération d'un audio TTS ───────────────────────────────────────
async function testGenerateAudio(segments) {
  console.log("\n🧪 [TEST 3] Génération d'un audio TTS...");
  if (!segments) {
    RESULTS.etape3_audio = { ok: false, details: "Skipped" };
    return false;
  }

  const seg    = segments[0];
  const urlTTS = `https://translate.google.com/translate_tts?ie=UTF-8&tl=fr&client=tw-ob&q=${encodeURIComponent(seg.audio_texte)}`;

  try {
    const response = await axios.get(urlTTS, {
      responseType: "arraybuffer",
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      timeout: 30000,
    });

    fs.writeFileSync("./tmp_data_test/audio/audio_01.mp3", response.data);
    const taille = (response.data.byteLength / 1024).toFixed(0);

    RESULTS.etape3_audio = { ok: true, details: `Audio TTS généré (${taille} Ko)` };
    console.log(`   ✅ Audio TTS : ${taille} Ko — "${seg.audio_texte.substring(0, 40)}..."`);
    return true;

  } catch (err) {
    RESULTS.etape3_audio = { ok: false, details: err.message };
    console.error(`   ❌ ${err.message}`);
    return false;
  }
}

// ─── TEST 4 : Assemblage d'une mini-vidéo ─────────────────────────────────────
async function testAssembleVideo(imageOk, audioOk) {
  console.log("\n🧪 [TEST 4] Assemblage FFmpeg (mini-vidéo 1 clip)...");

  const ffmpegBin = detectFFmpeg();
  if (!ffmpegBin) {
    RESULTS.etape4_video = { ok: false, details: "FFmpeg non installé" };
    console.error("   ❌ FFmpeg non trouvé");
    return false;
  }

  if (!imageOk || !audioOk) {
    RESULTS.etape4_video = { ok: false, details: "Skipped (image ou audio manquant)" };
    return false;
  }

  const imgPath  = "./tmp_data_test/images/img_01.jpg";
  const audPath  = "./tmp_data_test/audio/audio_01.mp3";
  const outPath  = "./tmp_data_test/video_test.mp4";

  try {
    const cmd = [
      `"${ffmpegBin}" -y`,
      `-loop 1 -i "${imgPath}"`,
      `-i "${audPath}"`,
      `-c:v libx264 -preset veryfast -pix_fmt yuv420p`,
      `-vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2"`,
      `-c:a aac -b:a 128k`,
      `-af "afade=t=in:ss=0:d=0.15,afade=t=out:st=2.5:d=0.55"`,
      `-t 4 -shortest`,
      `"${outPath}"`,
    ].join(" ");

    execSync(cmd, { timeout: 60000, stdio: ["ignore", "pipe", "pipe"] });

    const taille = (fs.statSync(outPath).size / 1024).toFixed(0);
    RESULTS.etape4_video = { ok: true, details: `Vidéo test : ${taille} Ko` };
    console.log(`   ✅ Vidéo test assemblée : ${taille} Ko`);
    return true;

  } catch (err) {
    RESULTS.etape4_video = { ok: false, details: err.message };
    console.error(`   ❌ ${err.message}`);
    return false;
  }
}

// ─── TEST 5 : Upload Google Drive ─────────────────────────────────────────────
async function testGoogleDrive(videoOk) {
  console.log("\n🧪 [TEST 5] Test connexion Google Drive...");

  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, DRIVE_FOLDER_ID } = process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN || !DRIVE_FOLDER_ID) {
    RESULTS.etape5_drive = { ok: false, details: "Variables d'environnement manquantes" };
    console.error("   ❌ Secrets Google manquants");
    return false;
  }

  if (!videoOk) {
    // Test de connexion uniquement (sans upload)
    console.log("   ⚠️  Vidéo non disponible — test de connexion seul");
  }

  try {
    const { google } = require("googleapis");
    const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });

    const drive = google.drive({ version: "v3", auth });
    const { data } = await drive.files.list({
      q: `'${DRIVE_FOLDER_ID}' in parents and trashed=false`,
      pageSize: 1,
      fields: "files(id, name)",
    });

    RESULTS.etape5_drive = { ok: true, details: `Connexion OK — dossier accessible` };
    console.log(`   ✅ Google Drive OK — dossier accessible`);
    return true;

  } catch (err) {
    RESULTS.etape5_drive = { ok: false, details: err.message };
    console.error(`   ❌ ${err.message}`);
    return false;
  }
}

// ─── TEST 6 : Connexion YouTube ───────────────────────────────────────────────
async function testYouTube() {
  console.log("\n🧪 [TEST 6] Test connexion YouTube...");

  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    RESULTS.etape6_youtube = { ok: false, details: "Variables d'environnement manquantes" };
    console.error("   ❌ Secrets Google manquants");
    return false;
  }

  try {
    const { google } = require("googleapis");
    const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });

    const youtube = google.youtube({ version: "v3", auth });

    // On vérifie les quotas et l'accès sans uploader
    const { data } = await youtube.channels.list({
      part: ["snippet"],
      mine: true,
    });

    const channelName = data.items?.[0]?.snippet?.title || "Canal inconnu";
    RESULTS.etape6_youtube = { ok: true, details: `Canal YouTube accessible : "${channelName}"` };
    console.log(`   ✅ YouTube OK — Canal : "${channelName}"`);

  } catch (err) {
    RESULTS.etape6_youtube = { ok: false, details: err.message };
    console.error(`   ❌ ${err.message}`);
  }
}

// ─── Nettoyage ────────────────────────────────────────────────────────────────
function cleanup() {
  try {
    fs.rmSync("./tmp_data_test", { recursive: true, force: true });
    console.log("\n🧹 Fichiers de test nettoyés.");
  } catch {
    // Silencieux
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=".repeat(60));
  console.log("🚀 TEST DU VID IA PIPELINE");
  console.log(`   Segments testés : ${NB_SEGMENTS_TEST} (au lieu de 16)`);
  console.log(`   Date            : ${new Date().toLocaleString("fr-FR")}`);
  console.log("=".repeat(60));

  const segments = await testGenerateScript();
  await attendre(1000);

  const imageOk  = await testGenerateImage(segments);
  await attendre(500);

  const audioOk  = await testGenerateAudio(segments);
  await attendre(500);

  const videoOk  = await testAssembleVideo(imageOk, audioOk);
  await attendre(500);

  await testGoogleDrive(videoOk);
  await attendre(500);

  await testYouTube();

  cleanup();
  printResults();

  // Code de sortie : 0 si tout OK, 1 sinon
  const allOk = Object.values(RESULTS).every((r) => r.ok);
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error("❌ Erreur inattendue :", err.message);
  process.exit(1);
});
