/**
 * MODULE GLAM IMG2VIDEO — Moteur de génération vidéo via l'API Glam
 *
 * Transforme une image + un prompt en une VRAIE vidéo animée avec mouvement,
 * grâce à l'API Android Glam (img2vid / chained_falai_img2video).
 *
 * Utilisation :
 *   const glam = require("./glam_img2video");
 *   const result = await glam.imgToVideo("le personnage court", "/path/to/image.jpg", 5);
 *   // result.video_url → URL de la vidéo générée
 *
 * @author SHIFAT / Pipeline v3 amélioré
 */

"use strict";

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");

// ─── Configuration ──────────────────────────────────────────────────────────
const GLAM_API_BASE = "https://android.getglam.app";
const GLAM_REWARDS_URL = "https://api.getglam.app/rewards/claim/hdnu30r7auc4kve";
const USER_AGENT = "Glam/1.58.4 Android/32 (Samsung SM-A156E)";

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 150; // 5 minutes
const DEFAULT_DURATION = 5;
const MAX_RETRIES = 3;

// ─── Utilitaires ────────────────────────────────────────────────────────────

function generateRandomId(len = 16) {
  const chars = "abcdef0123456789";
  let id = "";
  for (let i = 0; i < len; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

async function downloadFile(url, outputPath, timeout = 60000) {
  const writer = fs.createWriteStream(outputPath);
  const response = await axios.get(url, {
    responseType: "stream",
    timeout,
    validateStatus: (s) => s < 500,
  });
  if (response.status >= 400) throw new Error(`HTTP ${response.status}`);
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on("finish", () => resolve(outputPath));
    writer.on("error", reject);
  });
}

// ─── API Glam ───────────────────────────────────────────────────────────────

/**
 * Obtient un package_id (crédit) via le système de récompenses Glam.
 * @returns {Promise<string>} pack
 */
async function getBalance() {
  const pack = generateRandomId();
  const response = await axios.post(GLAM_REWARDS_URL, null, {
    headers: {
      "User-Agent": USER_AGENT,
      "glam-user-id": pack,
      "user_id": pack,
      "glam-local-date": new Date().toISOString(),
    },
    timeout: 15000,
    validateStatus: (s) => s < 500,
  });
  if (response.status >= 400) {
    throw new Error(`Glam claim échoué: HTTP ${response.status}`);
  }
  return pack;
}

/**
 * Upload une image et lance la génération vidéo.
 * @returns {Promise<string>} event_id
 */
async function uploadFile(pack, stream, prompt, duration = DEFAULT_DURATION) {
  const form = new FormData();
  form.append("package_id", pack);
  form.append("media_file", stream);
  form.append("media_type", "image");
  form.append("template_id", "community_img2vid");
  form.append("template_category", "20_coins_dur");
  form.append("frames", JSON.stringify([{
    prompt,
    custom_prompt: prompt,
    start: 0,
    end: 0,
    timings_units: "frames",
    media_type: "image",
    style_id: "chained_falai_img2video",
    rate_modifiers: { duration: `${duration}s` },
  }]));

  const response = await axios.post(`${GLAM_API_BASE}/v2/magic_video`, form, {
    headers: { ...form.getHeaders(), "User-Agent": USER_AGENT },
    timeout: 60000,
    validateStatus: (s) => s < 500,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  if (response.status >= 400 || !response.data) {
    throw new Error(`Glam upload échoué: HTTP ${response.status}`);
  }
  return response.data.event_id;
}

/**
 * Vérifie le statut jusqu'à ce que la vidéo soit prête.
 * @returns {Promise<object>} Données avec video_url
 */
async function waitForStatus(taskID, pack) {
  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    const response = await axios.get(`${GLAM_API_BASE}/v2/magic_video`, {
      params: { package_id: pack, event_id: taskID },
      headers: { "User-Agent": USER_AGENT },
      timeout: 15000,
      validateStatus: (s) => s < 500,
    });

    if (response.status >= 400) {
      throw new Error(`Glam statut échoué: HTTP ${response.status}`);
    }

    const data = response.data;
    if (data.status === "READY") return data;
    if (data.status === "FAILED" || data.status === "ERROR") {
      throw new Error(`Glam échouée (${data.status}): ${data.error || "erreur inconnue"}`);
    }

    if (attempt % 15 === 0) {
      console.log(`   [Glam] Toujours en cours... (${Math.round(attempt * POLL_INTERVAL_MS / 1000)}s)`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`Glam timeout après ${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s`);
}

/**
 * Fonction principale : anime une image en vidéo.
 * getBalance() → uploadFile() → waitForStatus()
 *
 * @param {string} prompt - Prompt d'animation
 * @param {string} filePath - Chemin local vers l'image
 * @param {number} duration - Durée en secondes
 * @returns {Promise<object>} Données contenant video_url
 */
async function imgToVideo(prompt, filePath, duration = DEFAULT_DURATION, options = {}) {
  const retries = options.retries || MAX_RETRIES;
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const pack = await getBalance();
      if (options.verbose !== false) console.log(`   [Glam] Package: ${pack.slice(0, 8)}... (tentative ${attempt})`);

      const fileStream = fs.createReadStream(filePath);
      const taskID = await uploadFile(pack, fileStream, prompt, duration);
      if (options.verbose !== false) console.log(`   [Glam] Tâche créée: ${taskID}`);

      const result = await waitForStatus(taskID, pack);
      if (options.verbose !== false) console.log(`   [Glam] ✅ Vidéo prête !`);
      return result;
    } catch (err) {
      lastError = err;
      if (options.verbose !== false) console.warn(`   [Glam] ⚠️ Tentative ${attempt}/${retries}: ${err.message}`);
      if (attempt < retries) await new Promise((r) => setTimeout(r, attempt * 3000));
    }
  }
  throw new Error(`Glam: toutes les ${retries} tentatives échouées. ${lastError?.message || ""}`);
}

/**
 * Version avec URL d'image au lieu de chemin fichier.
 */
async function imgUrlToVideo(prompt, imageUrl, duration = DEFAULT_DURATION, options = {}) {
  const tmpPath = path.join(options.tmpDir || "/tmp", `glam_img_${Date.now()}.png`);
  try {
    await downloadFile(imageUrl, tmpPath);
    return await imgToVideo(prompt, tmpPath, duration, options);
  } finally {
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
  }
}

/**
 * Télécharge la vidéo générée vers un chemin local.
 * @returns {Promise<string>} Le chemin du fichier
 */
async function downloadVideo(videoUrl, outputPath) {
  return await downloadFile(videoUrl, outputPath);
}

/**
 * Génère un clip vidéo pour un segment : utilise Glam + ajoute l'audio.
 *
 * @param {object} segment - { id, audio_texte, prompt_visuel }
 * @param {string} imagePath - Image source
 * @param {string} outputPath - Chemin de sortie .mp4
 * @param {object} [options]
 * @returns {Promise<boolean>}
 */
async function generateClipFromSegment(segment, imagePath, outputPath, options = {}) {
  const duration = options.duration || DEFAULT_DURATION;
  const glamPrompt = segment.prompt_visuel || "";

  try {
    const result = await imgToVideo(glamPrompt, imagePath, duration, {
      ...options,
      verbose: options.verbose !== false,
    });

    if (!result || !result.video_url) {
      throw new Error("Pas de video_url dans la réponse Glam");
    }

    await downloadVideo(result.video_url, outputPath);
    console.log(`   ✅ Clip Glam: ${path.basename(outputPath)} (${(fs.existsSync(outputPath) ? fs.statSync(outputPath).size / 1024 / 1024 : 0).toFixed(2)} Mo)`);
    return true;
  } catch (err) {
    console.warn(`   ⚠️ Glam segment ${segment.id}: ${err.message}`);
    return false;
  }
}

// ─── Exports ────────────────────────────────────────────────────────────────
module.exports = {
  getBalance,
  uploadFile,
  waitForStatus,
  imgToVideo,
  imgUrlToVideo,
  downloadVideo,
  generateClipFromSegment,
  DEFAULT_DURATION,
  MAX_RETRIES,
};
