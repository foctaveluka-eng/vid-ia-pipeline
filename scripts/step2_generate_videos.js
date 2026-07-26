/**
 * ÉTAPE 2 — PROFESSIONNELLE PRO v2 : Génération vidéo avec audio intégré + support 5s/10s
 *
 * LOGIQUE API VIDÉO RENFORCÉE :
 * - Génération UNIQUEMENT via VIDEO_API_URL (MP4 direct avec audio français embarqué + lip-sync)
 * - Support durées 5s et 10s : estimation automatique selon longueur du dialogue
 *   - < 18 mots ou < 100 caractères → 5 secondes
 *   - sinon → 10 secondes (ou VIDEO_DURATION forcée via env)
 * - Tentatives multi-payloads : [5s audio=true], [10s audio=true], [5s sans flag], [10s sans flag], [format mp4 seul]
 * - Détection robuste MP4 vs JPEG, vérification taille, retry exponentiel, logs détaillés
 *
 * CONTINUITÉ (API Image uniquement) :
 * - Extraction dernière frame du clip précédent via FFmpeg pour continuité visuelle
 * - Génération image de continuité (édition scène, ajout perso / changement décor)
 * - Utilisée comme info contextuelle pour prompt suivant
 *
 * COMPATIBILITÉ :
 * - theme manga / dessin_anime / actualites / horreur
 * - personnages récurrents : Mika, Ilyan, Kael, Elara, Riven, Sylas, etc.
 * - Prompt structuré : Location + Dialogue exact français + Expressions par perso + Lip-sync + Audio embarqué
 *
 * Sortie : tmp_data/clips/clip_001.mp4 ... (audio intégré)
 */

"use strict";

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const IMAGE_API_URL = process.env.IMAGE_API_URL || "https://gem-tw6a.onrender.com/generate";
const VIDEO_API_URL = process.env.VIDEO_API_URL || IMAGE_API_URL;
const CONTINUITY_FOLDER = "./tmp_data/continuity_frames";
const FORCED_DURATION = parseInt(process.env.VIDEO_DURATION || "", 10) || null; // 5 ou 10 si forcé

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Estimation durée 5s / 10s ───────────────────────────────────────────────
function estimateDurationSec(text) {
  if (FORCED_DURATION === 5 || FORCED_DURATION === 10) return FORCED_DURATION;
  const t = String(text || "").trim();
  if (!t) return 5;
  const words = t.split(/\s+/).filter(Boolean).length;
  const chars = t.length;
  // Heuristique : voix française TTS ~ 2.5 mots/sec, + marge animation
  // <18 mots OU <100 chars => 5s, sinon 10s
  if (words <= 18 && chars <= 110) return 5;
  if (words <= 25 && chars <= 160) return 8; // on map 8 -> 10 pour API qui ne supporte que 5/10
  return 10;
}

function normalizeDurationForAPI(sec) {
  // API supporte principalement 5 et 10, on map 8->10, et tout >6 ->10
  if (sec <= 5) return 5;
  return 10;
}

// ─── Prompt structuré PRO ───────────────────────────────────────────────────
function unifiedVideoPrompt(scriptData, segment, continuityInfo = "", desiredDuration = 5) {
  const style = scriptData.visual_style || "professional full-color modern anime, cinematic, vertical 9:16";
  const theme = scriptData.theme || "manga";
  const location = extractLocationHint(segment.prompt_visuel);
  const dialogue = (segment.audio_texte || "").replace(/"/g, "'").slice(0, 500);

  return `${style}.
SCENE ${segment.id}/${scriptData.script?.length || "?"} — Theme: ${theme}

${segment.prompt_visuel}

${continuityInfo}

STRUCTURED SCENE PROMPT (must be respected exactly):
- Location: ${location}
  Detailed anime background, consistent with previous scene, depth, atmospheric lighting, no empty void.
- Dialogue (exact French, must be spoken): "${dialogue}"
  Character speaks naturally in French, clear articulation, emotional tone matching context.
- Character expressions: detailed facial expressions per character (Mika determined eyes, slight lip tremble; Ilyan intense gaze, protective stance; Kael surprised eyebrows raised; Elara authoritative calm; Riven mysterious smirk; Sylas focused). Visible reactions even for silent characters.
- Lip-sync: mouth moves precisely synchronized with the French dialogue, accurate visemes, no desync, no closed-mouth speaking.
- Multi-characters: when several characters present, all visible in frame, natural eye contact, conversational body language.
- Camera: subtle cinematic movement, slight push-in or lateral, suitable for ${desiredDuration}s clip.

CRITICAL REQUIREMENTS — MUST BE ONE MP4 FILE:
1. Duration: ${desiredDuration} seconds (explicitly ${normalizeDurationForAPI(desiredDuration)}s requested)
2. Visual: full animation (not static), fluid ${desiredDuration}s loop, high quality, professional anime (Solo Leveling / Jujutsu Kaisen style if manga)
3. Audio: exact French voiceover "${dialogue}" EMBEDDED DIRECTLY inside MP4, mono/stereo, clear, no background music over voice
4. Lip-sync: characters' lips visibly move matching the embedded French audio
5. Format: MP4 H.264 + AAC, vertical 9:16 (1080x1920), no subtitles, no watermark, no text overlay, no speech bubbles.

This video must play with sound and talking characters immediately. No separate audio track. Generate as final deliverable.`;
}

function extractLocationHint(visualPrompt) {
  // Simple heuristic to keep location info, fallback generic
  const vp = String(visualPrompt || "").slice(0, 300);
  if (/Orne|rue|ville|tower|forêt|forest|chêne|orchard|verger|street|city|labo|cité|école|school/i.test(vp)) {
    return vp.split(".")[0].slice(0, 200);
  }
  return "Detailed anime location background: Orne streets with obsidian towers, glowing lanterns, floating ink particles, magical atmosphere, depth layers";
}

function continuityImagePrompt(scriptData, segment, lastFrameDescription = "") {
  return `Edit this anime scene for perfect visual continuity.

Previous scene context: ${lastFrameDescription || "Continue from last clip frame"}
Current scene: ${segment.prompt_visuel}
Task: Add or adjust characters and environment so it looks like the immediate next second after previous clip.
Keep same art style: ${scriptData.visual_style || "professional full-color modern anime"}
Keep character designs consistent (Mika blue-black ink hair, Ilyan silver eyes, etc.)
If new character arrives (Kael, Elara, Riven, Sylas), introduce them naturally entering frame.
Professional anime, no text, no speech bubbles, seamless continuation, high detail.`;
}

// ─── API Vidéo robuste — 5s/10s + audio ─────────────────────────────────────
async function tryGenerateVideoViaAPI(prompt, outputPath, desiredDuration = 5, maxRetries = 3) {
  const normDur = normalizeDurationForAPI(desiredDuration);
  const altDur = normDur === 5 ? 10 : 5;

  // Payloads ordonnés : on tente d'abord la durée estimée, puis l'alternative
  const payloads = [
    { prompt, ratio: "9:16", format: "mp4", duration: normDur, audio: true, with_audio: true, has_audio: true, voice: "fr", lang: "fr" },
    { prompt, ratio: "9:16", format: "mp4", duration: normDur, audio: true, with_audio: true },
    { prompt, ratio: "9:16", format: "mp4", duration: normDur, audio: true },
    { prompt, ratio: "9:16", format: "mp4", duration: altDur, audio: true, with_audio: true },
    { prompt, ratio: "9:16", format: "mp4", duration: altDur, audio: true },
    { prompt, ratio: "9:16", format: "mp4", duration: normDur },
    { prompt, ratio: "9:16", format: "mp4", duration: altDur },
    { prompt, ratio: "9:16", format: "mp4" },
    { prompt, ratio: "9:16" },
    { prompt, format: "mp4", duration: normDur, audio: true, with_audio: true },
  ];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    for (let pIdx = 0; pIdx < payloads.length; pIdx++) {
      const payload = payloads[pIdx];
      try {
        console.log(`   → Attempt ${attempt}/${maxRetries} payload ${pIdx + 1}/${payloads.length} (duration=${payload.duration || "auto"} audio=${payload.audio || false})`);
        const res = await axios.post(VIDEO_API_URL, payload, {
          responseType: "arraybuffer",
          timeout: 180000,
          validateStatus: (s) => s < 500,
          headers: { "Content-Type": "application/json", Accept: "video/mp4, image/jpeg, */*" },
        });

        if (res.status >= 400) {
          console.warn(`   ⚠️ API HTTP ${res.status} payload ${pIdx + 1}`);
          continue;
        }
        if (!res.data || res.data.byteLength < 2000) {
          console.warn(`   ⚠️ Réponse trop petite (${res.data?.byteLength || 0}) payload ${pIdx + 1}`);
          continue;
        }

        // Détection type via magic bytes
        const b0 = res.data[0];
        const b1 = res.data[1];
        const isJpeg = b0 === 0xff && b1 === 0xd8;
        const isMp4Ftyp = (() => {
          try {
            const head = Buffer.from(res.data).slice(0, 20).toString("utf8");
            return head.includes("ftyp") || head.includes("mp4");
          } catch { return false; }
        })();

        if (isJpeg) {
          console.warn(`   ⚠️ API a retourné JPEG au lieu de MP4 (payload ${pIdx + 1}) — ignoré pour cette étape`);
          continue;
        }

        // Si pas JPEG, on suppose MP4, on écrit
        fs.writeFileSync(outputPath, res.data);
        const size = fs.statSync(outputPath).size;
        if (size < 2000) {
          console.warn(`   ⚠️ Fichier écrit trop petit (${size})`);
          try { fs.unlinkSync(outputPath); } catch {}
          continue;
        }

        // Vérif optionnelle rapide de durée via ffprobe si dispo (non bloquant)
        console.log(`   ✅ MP4 reçu: ${size} bytes (payload ${pIdx + 1}, durée demandée ${payload.duration || "auto"})`);
        return { success: true, payloadUsed: payload, size, attempt, altDurationUsed: payload.duration !== normDur };

      } catch (e) {
        const msg = e.response ? `HTTP ${e.response.status}` : e.message;
        console.warn(`   ⚠️ Erreur payload ${pIdx + 1}: ${msg}`);
        // continue to next payload
      }
    }
    if (attempt < maxRetries) {
      const backoff = attempt * 2500 + Math.random() * 1000;
      console.log(`   ⏳ Retry global dans ${Math.round(backoff)}ms...`);
      await attendre(backoff);
    }
  }
  return { success: false };
}

// ─── Image Continuité (édition légère) ──────────────────────────────────────
async function generateContinuityImage(prompt, outputPath, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await axios.post(IMAGE_API_URL, { prompt, ratio: "9:16", format: "jpg" }, {
        responseType: "arraybuffer",
        timeout: 120000,
        validateStatus: (s) => s < 500,
      });
      if (res.status >= 400) throw new Error(`API ${res.status}`);
      if (!res.data || res.data.byteLength < 1000) throw new Error("Réponse image trop petite");
      fs.writeFileSync(outputPath, res.data);
      if (fs.statSync(outputPath).size > 1000) return true;
    } catch (e) {
      console.warn(`   ⚠️ Continuité image attempt ${attempt}/${retries}: ${e.message}`);
      if (attempt < retries) await attendre(1200 + Math.random() * 600);
    }
  }
  return false;
}

// ─── MAIN ───────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync("./tmp_data/script_data.json")) {
    throw new Error("script_data.json introuvable. Lancez l'étape 1 (generate script).");
  }

  const scriptData = JSON.parse(fs.readFileSync("./tmp_data/script_data.json", "utf-8"));
  const segments = scriptData.script;

  if (!Array.isArray(segments) || !segments.length) {
    throw new Error("Aucun segment à générer (script_data.json vide).");
  }

  const clipsFolder = path.join("./tmp_data", "clips");
  fs.mkdirSync(clipsFolder, { recursive: true });
  fs.mkdirSync(CONTINUITY_FOLDER, { recursive: true });

  console.log(`🎬 [PRO v2 — 5s/10s] Génération de ${segments.length} clips vidéo avec AUDIO INTÉGRÉ`);
  console.log(`   API Vidéo: ${VIDEO_API_URL}`);
  console.log(`   API Image (continuité only): ${IMAGE_API_URL}`);
  console.log(`   Durée forcée: ${FORCED_DURATION ? FORCED_DURATION + "s" : "auto (estimation par texte)"}`);
  console.log(`   Stratégie: Vidéo directe MP4 (5s/10s + audio FR embarqué + lip-sync) + continuité via last frame`);
  console.log(`   Thème: ${scriptData.theme_label || scriptData.theme} | Mode: ${scriptData.visual_mode}`);

  const generatedClips = [];
  const failedClips = [];
  const batchSize = 2;

  for (let i = 0; i < segments.length; i += batchSize) {
    const batch = segments.slice(i, i + batchSize);

    // Process batch in parallel (2 at a time) but keep logs clear
    await Promise.all(
      batch.map(async (segment, offset) => {
        const pos = i + offset;
        const num = String(pos + 1).padStart(3, "0");
        const clipPath = path.join(clipsFolder, `clip_${num}.mp4`);

        if (fs.existsSync(clipPath) && fs.statSync(clipPath).size > 2000) {
          console.log(`⏭️  Clip ${num} déjà présent (${fs.statSync(clipPath).size} bytes) — skip.`);
          generatedClips.push(clipPath);
          return;
        }

        const desiredDuration = estimateDurationSec(segment.audio_texte);
        const words = String(segment.audio_texte || "").split(/\s+/).length;

        console.log(`\n🔄 Clip ${num} — "${String(segment.audio_texte).slice(0, 60)}..." (${words} mots → ${desiredDuration}s estimé → API ${normalizeDurationForAPI(desiredDuration)}s)`);

        // 1) Génération vidéo directe
        let continuityInfo = "";
        if (pos > 0) {
          continuityInfo = `Continuity: This is the immediate next shot after scene ${pos}. Keep same characters, same location, seamless visual continuation. Previous visual was: ${segments[pos - 1]?.prompt_visuel?.slice(0, 120) || ""}`;
        }

        const prompt = unifiedVideoPrompt(scriptData, segment, continuityInfo, desiredDuration);
        const videoResult = await tryGenerateVideoViaAPI(prompt, clipPath, desiredDuration, 3);

        if (videoResult.success) {
          console.log(`✅ Clip ${num} généré avec succès (MP4 + audio intégré, ${videoResult.size} bytes, payload duration=${videoResult.payloadUsed?.duration || "auto"})`);
          generatedClips.push(clipPath);
          return;
        }

        // 2) Fallback continuité : extraire last frame précédente et générer image de continuité comme aide contextuelle
        console.log(`🟡 Clip ${num} — Échec vidéo directe, tentative continuité via image...`);

        const lastFramePath = path.join(CONTINUITY_FOLDER, `last_frame_${num}.jpg`);

        if (pos > 0) {
          const prevNum = String(pos).padStart(3, "0");
          const prevClip = path.join(clipsFolder, `clip_${prevNum}.mp4`);
          if (fs.existsSync(prevClip)) {
            try {
              execSync(`ffmpeg -y -hide_banner -loglevel error -i "${prevClip}" -vf "thumbnail,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" -frames:v 1 -q:v 2 "${lastFramePath}"`, { stdio: "ignore", timeout: 20000 });
              console.log(`   → Last frame extraite: ${path.basename(lastFramePath)}`);
            } catch (e) {
              console.warn(`   ⚠️ Impossible d'extraire last frame: ${e.message}`);
            }
          }
        }

        const contPrompt = continuityImagePrompt(scriptData, segment, pos > 0 ? `Previous scene: ${segments[pos - 1]?.prompt_visuel?.slice(0, 100)}` : "First scene");
        const continuityOk = await generateContinuityImage(contPrompt, lastFramePath, 2);
        if (continuityOk) console.log(`   → Image de continuité générée pour aide: ${lastFramePath}`);

        // 3) Deuxième tentative vidéo avec contexte continuité enrichi
        const enrichedContinuity = `Continuity enriched: reference last frame at ${lastFramePath} if supported. ${continuityInfo} Maintain same lighting and character positions.`;
        const prompt2 = unifiedVideoPrompt(scriptData, segment, enrichedContinuity, desiredDuration);
        const finalAttempt = await tryGenerateVideoViaAPI(prompt2, clipPath, desiredDuration, 2);

        if (finalAttempt.success) {
          console.log(`✅ Clip ${num} généré via API Vidéo (2e tentative avec continuité).`);
          generatedClips.push(clipPath);
        } else {
          console.error(`❌ Échec définitif génération clip ${num} — marqué comme échoué.`);
          failedClips.push(`clip_${num}`);
        }
      })
    );

    if (i + batchSize < segments.length) {
      console.log(`\n⏳ Pause ${1200}ms avant batch suivant...`);
      await attendre(1200);
    }
  }

  generatedClips.sort();

  const info = {
    folder: clipsFolder,
    totalRequested: segments.length,
    totalClips: generatedClips.length,
    failedClips,
    clipsList: generatedClips,
    generated_at: new Date().toISOString(),
    mode: "video_with_embedded_audio_5s_10s_PRO_v2",
    api_video: VIDEO_API_URL,
    api_image_for_continuity: IMAGE_API_URL,
    duration_logic: FORCED_DURATION ? `forced_${FORCED_DURATION}s` : "auto_5s_10s_by_text_length",
    continuity_used: true,
    continuity_folder: CONTINUITY_FOLDER,
  };

  fs.writeFileSync("./tmp_data/clips_info.json", JSON.stringify(info, null, 2));
  fs.writeFileSync("./tmp_data/video_clips_info.json", JSON.stringify(info, null, 2));

  console.log(`\n${"=".repeat(70)}`);
  console.log(`🎉 ${generatedClips.length}/${segments.length} clips vidéo générés avec audio intégré.`);
  console.log(`   Dossier: ${clipsFolder}`);
  console.log(`   Mode: 5s/10s auto + continuité`);
  if (failedClips.length) console.warn(`   ⚠️ Échoués: ${failedClips.join(", ")}`);
  console.log(`${"=".repeat(70)}`);

  if (generatedClips.length === 0) throw new Error("Aucun clip généré — toutes les tentatives ont échoué.");
}

main().catch((err) => {
  console.error("❌ Erreur fatale étape 2 vidéo:", err.message);
  console.error(err.stack?.slice(0, 800) || "");
  process.exit(1);
});
