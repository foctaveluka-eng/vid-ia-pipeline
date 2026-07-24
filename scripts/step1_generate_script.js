/**
 * ÉTAPE 1 — Génère le scénario des quatre formats éditoriaux.
 * Les mangas utilisent 48 scènes par défaut afin de raconter une histoire complète.
 */
"use strict";

const axios = require("axios");
const fs = require("fs");
const { THEMES, getThemeFromEnvironment, getSegmentCount, getMangaEpisode } = require("./pipeline_config");

const DELFA_API_URL = process.env.DELFA_API_URL || "https://delfaapiai.vercel.app/ai/copilot";

function stripJson(answer) {
  const text = String(answer || "").replace(/```json|```/gi, "").trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) throw new Error("La réponse ne contient pas d'objet JSON.");
  return JSON.parse(text.slice(first, last + 1));
}

function validateSegments(segments, expected) {
  if (!Array.isArray(segments) || segments.length !== expected) {
    throw new Error(`Le script doit contenir exactement ${expected} segments (reçu: ${segments?.length ?? 0}).`);
  }
  return segments.map((segment, index) => {
    const audio = String(segment?.audio_texte || "").trim();
    const visual = String(segment?.prompt_visuel || "").trim();
    if (!audio || !visual) throw new Error(`Segment ${index + 1} incomplet (audio_texte et prompt_visuel sont obligatoires).`);
    return { id: index + 1, audio_texte: audio, prompt_visuel: visual };
  });
}

async function main() {
  const themeId = getThemeFromEnvironment();
  const theme = THEMES[themeId];
  const segmentCount = getSegmentCount(themeId);
  const isManga = themeId === "manga";
  const mangaEpisode = isManga ? getMangaEpisode() : null;
  const actGuidance = isManga
    ? `- Ceci est le chapitre ${mangaEpisode.number}, publié le ${mangaEpisode.date}, de la série originale « ${mangaEpisode.title} ». Arc actuel : « ${mangaEpisode.arc.name} » — ${mangaEpisode.arc.goal}\n- Bible immuable : ${mangaEpisode.visualBible}\n- Raconte un épisode complet avec son propre mini-conflit, une avancée nette vers l'objectif de l'arc et une dernière image qui donne envie de voir le chapitre suivant. Ne résume jamais toute la saga en un seul épisode.\n- Répartis les ${segmentCount} scènes: rappel organique, enjeu du chapitre, obstacles, révélation ou confrontation, retombée et promesse du prochain chapitre.\n`
    : "";

  const instructions = `Tu es scénariste pour une vidéo verticale française animée.
Format: ${theme.label}.
Sujet: ${theme.subject}.

${theme.style}

Règles non négociables:
- Génère exactement ${segmentCount} segments strictement chronologiques. Il s'agit d'un seul récit cohérent.
- Chaque audio_texte fait 10 à 22 mots, naturel à l'oral, en français.
- Chaque prompt_visuel est en anglais, décrit l'action visible, le cadrage et les personnages de cette scène. Ne mets ni texte lisible, ni sous-titres, ni logo dans l'image.
- Préserve les mêmes personnages, lieux et objets importants tout au long de l'histoire.
${actGuidance}
Réponds UNIQUEMENT avec un JSON valide, sans markdown:
{"segments":[{"id":1,"audio_texte":"...","prompt_visuel":"..."}]}`;

  console.log(`🤖 [${themeId.toUpperCase()}] Génération de ${segmentCount} segments (${theme.label})...`);
  let script;
  let lastError;
  // Les modèles renvoient parfois un segment de trop: on redemande proprement au lieu
  // de laisser tout le pipeline échouer dès la première réponse imparfaite.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await axios.get(DELFA_API_URL, {
        params: { model: "default", message: `${instructions}\nTentative ${attempt}/3: respecte impérativement le nombre exact de segments.` },
        timeout: 120000,
      });
      script = validateSegments(stripJson(response.data?.answer), segmentCount);
      break;
    } catch (error) {
      lastError = error;
      console.warn(`⚠️ Script invalide ou API indisponible (essai ${attempt}/3): ${error.message}`);
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
  if (!script) throw lastError || new Error("Impossible de générer le script.");

  const output = {
    theme: themeId,
    theme_label: theme.label,
    visual_mode: theme.visualMode,
    visual_style: theme.visualStyle,
    segment_count: segmentCount,
    manga_episode: mangaEpisode && {
      number: mangaEpisode.number,
      date: mangaEpisode.date,
      series_title: mangaEpisode.title,
      arc: mangaEpisode.arc.name,
    },
    script,
    generated_at: new Date().toISOString(),
  };
  fs.mkdirSync("./tmp_data", { recursive: true });
  fs.writeFileSync("./tmp_data/script_data.json", JSON.stringify(output, null, 2), "utf-8");
  console.log(`✅ Script généré: ${script.length} scènes — ${theme.label}.`);
}

main().catch((error) => {
  console.error("❌ Erreur de génération du script:", error.message);
  process.exit(1);
});
