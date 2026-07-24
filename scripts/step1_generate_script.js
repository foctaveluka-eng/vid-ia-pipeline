/**
 * ÉTAPE 1 — Génère le scénario des quatre formats éditoriaux.
 * Version robuste : tolère les variations de taille, tente POST et GET,
 * et fournit un fallback local si l'API Delfa est indisponible.
 * Les mangas utilisent 48 scènes par défaut afin de raconter une histoire complète.
 */
"use strict";

const axios = require("axios");
const fs = require("fs");
const { THEMES, getThemeFromEnvironment, getSegmentCount, getMangaEpisode, getCartoonEpisode } = require("./pipeline_config");

const DELFA_API_URL = process.env.DELFA_API_URL || "https://delfaapiai.vercel.app/ai/copilot";
const MAX_ATTEMPTS = 5;
const REQUEST_TIMEOUT = 180000; // 3 min par requête, les modèles longs (48 scènes) prennent du temps

function stripJson(answer) {
  const raw = String(answer || "").trim();
  if (!raw) throw new Error("Réponse vide");
  // Nettoie les fences markdown
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

  // Essai direct JSON.parse
  try {
    const direct = JSON.parse(cleaned);
    if (direct && typeof direct === "object") return direct;
  } catch {}

  // Recherche du premier { au dernier }
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    const slice = cleaned.slice(first, last + 1);
    try {
      return JSON.parse(slice);
    } catch (e) {
      // Tentative de réparation : le modèle renvoie parfois des virgules traînantes ou des sauts de ligne mal formés
      // On tente de trouver un tableau segments
      const arrayMatch = slice.match(/"segments"\s*:\s*\[/);
      if (arrayMatch) {
        // On laisse l'erreur remonter pour retry, mais message plus clair
        throw new Error(`JSON invalide après extraction: ${e.message}`);
      }
      throw e;
    }
  }
  throw new Error("La réponse ne contient pas d'objet JSON.");
}

function normalizeResponse(data) {
  // L'API peut renvoyer {answer: "...json..."} ou directement {segments: [...]}
  // ou {result: ...} ou une string.
  if (!data) throw new Error("Réponse API vide");
  if (typeof data === "string") return stripJson(data);
  if (Array.isArray(data)) return { segments: data };
  if (data.segments && Array.isArray(data.segments)) return data;
  if (data.answer) {
    if (typeof data.answer === "object" && data.answer.segments) return data.answer;
    return stripJson(data.answer);
  }
  if (data.result) {
    if (typeof data.result === "string") return stripJson(data.result);
    if (data.result.segments) return data.result;
  }
  // Dernière chance : l'objet lui-même est peut-être le JSON attendu
  return stripJson(JSON.stringify(data));
}

function validateSegments(segments, expected) {
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error(`Le script doit contenir au moins 1 segment (reçu: ${segments?.length ?? 0}).`);
  }

  // Tolérance : si le modèle renvoie plus que demandé, on tronque (cas fréquent avec 48 scènes)
  let working = segments;
  if (segments.length > expected) {
    console.warn(`⚠️ Modèle a renvoyé ${segments.length} segments au lieu de ${expected}, on tronque aux ${expected} premiers.`);
    working = segments.slice(0, expected);
  } else if (segments.length < expected) {
    throw new Error(`Le script doit contenir exactement ${expected} segments (reçu: ${segments.length}).`);
  }

  return working.map((segment, index) => {
    const audio = String(segment?.audio_texte || segment?.audio || segment?.text || "").trim();
    const visual = String(segment?.prompt_visuel || segment?.visual || segment?.prompt || "").trim();
    if (!audio || !visual) throw new Error(`Segment ${index + 1} incomplet (audio_texte et prompt_visuel sont obligatoires).`);
    return { id: index + 1, audio_texte: audio, prompt_visuel: visual };
  });
}

function generateFallbackScript(themeId, theme, segmentCount, episodeMeta) {
  console.warn("⚠️ Génération d'un script de secours local (fallback) — l'API Delfa n'a pas répondu.");
  const baseAudio = {
    dessin_anime: [
      "Pomme se réveille dans le verger magique, prête pour une nouvelle aventure.",
      "Banane le sage remarque un petit mystère près du grand chêne lumineux.",
      "Fraise la téméraire propose d'enquêter avec courage et bonne humeur.",
      "Orange l'espiègle fait une blague, mais cache un petit secret.",
      "Le groupe discute et comprend l'importance de l'écoute et de l'amitié.",
      "Une rumeur se répand, mais Pomme choisit de vérifier les faits calmement.",
      "Les amis résolvent le malentendu en parlant avec honnêteté.",
      "Ils découvrent que la communication est la clé pour rester unis.",
    ],
    manga: [
      "Mika entend un murmure d'encre qui s'efface dans les archives d'Orne.",
      "Ilyan ajuste son gantelet mécanique et suit Mika dans les ruelles sombres.",
      "Les lanternes suspendues clignotent alors qu'une page disparaît.",
      "Un souvenir volé révèle l'ombre du collectionneur de mémoire.",
      "Mika se souvient de la promesse faite aux Veilleurs d'Obsidienne.",
      "La boussole d'obsidienne brisée vibre près du soleil noir.",
      "Le groupe affronte un dilemme entre sauver la cité et leurs souvenirs.",
      "La vérité éclate : l'encre elle-même choisit ce qui doit rester.",
    ],
    actualites: [
      "Aujourd'hui, un fait international important attire l'attention du monde.",
      "Les sources officielles confirment les premiers éléments vérifiables.",
      "Les témoins sur place décrivent une situation en évolution rapide.",
      "Les analystes expliquent le contexte et les enjeux derrière l'événement.",
      "Les réactions internationales montrent des positions contrastées.",
      "Les chiffres disponibles restent à confirmer par des sources indépendantes.",
      "Ce qui est établi et ce qui reste incertain doit être clairement distingué.",
      "Nous suivrons les développements et leurs implications dans les prochaines heures.",
    ],
    horreur: [
      "Je me réveille et la maison semble anormalement silencieuse cette nuit.",
      "Un bruit léger vient du couloir, comme un souffle qui hésite.",
      "La lumière vacille, et mon cœur bat plus fort à chaque pas.",
      "Je trouve une porte entrouverte que je pensais fermée à clé.",
      "L'air devient froid et une présence semble m'observer dans l'ombre.",
      "Je comprends que je ne suis pas seule et que quelque chose m'écoute.",
      "Les souvenirs s'emmêlent alors que la peur monte lentement.",
      "Je dois affronter ce qui m'attend avant que la nuit ne m'emporte.",
    ],
  };

  const visuals = {
    dessin_anime: "cute anthropomorphic fruits in magical orchard, colorful 3D cartoon, expressive faces, soft lighting, child-friendly, no text",
    manga: "original black-and-white manga panel, Mika with short black hair and white coat, dark city Orne with lanterns, ink effects, no text, no speech bubbles",
    actualites: "editorial documentary illustration, realistic news scene, clear composition, professional lighting, no text overlays",
    horreur: "dark cinematic horror illustration, first-person view, atmospheric shadows, tension, no gore, no text",
  };

  const audios = baseAudio[themeId] || baseAudio.actualites;
  const visualBase = visuals[themeId] || visuals.actualites;

  const segments = [];
  for (let i = 0; i < segmentCount; i++) {
    const audio = audios[i % audios.length] + (segmentCount > audios.length ? ` (scène ${i + 1})` : "");
    // On varie légèrement le visuel pour éviter la répétition exacte
    const variation = `scene ${i + 1} of ${segmentCount}, sequential storytelling, ${i % 2 === 0 ? "wide shot" : "close-up"}${episodeMeta ? `, ${episodeMeta}` : ""}`;
    segments.push({
      id: i + 1,
      audio_texte: audio,
      prompt_visuel: `${visualBase}. ${variation}`,
    });
  }
  return segments;
}

async function callDelfaAPI(instructions, attempt) {
  const params = {
    model: "default",
    message: `${instructions}\nTentative ${attempt}/${MAX_ATTEMPTS}: respecte impérativement le nombre exact de segments demandés. Réponds uniquement en JSON.`,
  };

  // Essai en GET d'abord (comportement historique)
  try {
    console.log(`🔗 GET ${DELFA_API_URL} (tentative ${attempt})`);
    const response = await axios.get(DELFA_API_URL, {
      params,
      timeout: REQUEST_TIMEOUT,
      headers: { "Accept": "application/json" },
      validateStatus: (s) => s < 500, // 4xx on laisse passer pour parser l'erreur
    });
    if (response.status >= 400) {
      throw new Error(`API GET a répondu ${response.status}: ${JSON.stringify(response.data).slice(0, 500)}`);
    }
    return response.data;
  } catch (err) {
    if (attempt > 2) {
      // Après 2 échecs GET, on tente POST (certains déploiements Vercel préfèrent POST pour gros payloads)
      try {
        console.log(`🔗 POST ${DELFA_API_URL} (fallback tentative ${attempt})`);
        const response = await axios.post(
          DELFA_API_URL,
          { model: "default", message: params.message },
          { timeout: REQUEST_TIMEOUT, headers: { "Content-Type": "application/json", Accept: "application/json" }, validateStatus: (s) => s < 500 }
        );
        if (response.status >= 400) {
          throw new Error(`API POST a répondu ${response.status}: ${JSON.stringify(response.data).slice(0, 500)}`);
        }
        return response.data;
      } catch (postErr) {
        // On propage l'erreur GET originale si POST échoue aussi, pour garder le contexte
        throw err;
      }
    }
    throw err;
  }
}

async function main() {
  const themeId = getThemeFromEnvironment();
  const theme = THEMES[themeId];
  const segmentCount = getSegmentCount(themeId);
  const isManga = themeId === "manga";
  const isCartoon = themeId === "dessin_anime";
  const mangaEpisode = isManga ? getMangaEpisode() : null;
  const cartoonEpisode = isCartoon ? getCartoonEpisode() : null;

  let actGuidance = "";
  let fallbackMeta = "";
  if (isManga) {
    actGuidance = `- Ceci est le chapitre ${mangaEpisode.number}, publié le ${mangaEpisode.date}, de la série originale « ${mangaEpisode.title} ». Arc actuel : « ${mangaEpisode.arc.name} » — ${mangaEpisode.arc.goal}\n- Bible immuable : ${mangaEpisode.visualBible}\n- Raconte un épisode complet avec son propre mini-conflit, une avancée nette vers l'objectif de l'arc et une dernière image qui donne envie de voir le chapitre suivant. Ne résume jamais toute la saga en un seul épisode.\n- Répartis les ${segmentCount} scènes: rappel organique, enjeu du chapitre, obstacles, révélation ou confrontation, retombée et promesse du prochain chapitre.\n`;
    fallbackMeta = `Chapitre ${mangaEpisode.number}, arc ${mangaEpisode.arc.name}`;
  } else if (isCartoon) {
    const structure = cartoonEpisode.episodeStructure;
    actGuidance = `- Ceci est l'épisode ${cartoonEpisode.number}, publié le ${cartoonEpisode.date}, de la série « ${cartoonEpisode.title} ». Arc actuel : « ${cartoonEpisode.arc.name} » — ${cartoonEpisode.arc.goal}\n- Thèmes de l'arc : ${cartoonEpisode.arc.themes.join(", ")}\n- Bible visuelle : ${cartoonEpisode.visualBible}\n- Structure de l'épisode : ${structure.opening} → ${structure.setup} → ${structure.conflict} → ${structure.resolution} → ${structure.lesson} → ${structure.teaser}\n- Raconte une aventure quotidienne avec des fruits qui parlent. Inclus un petit mystère, une rumeur ou un malentendu qui se résout toujours positivement par la communication et l'amitié.\n- Répartis les ${segmentCount} scènes selon la structure ci-dessus. Termine par une leçon de vie simple et positive.\n`;
    fallbackMeta = `Épisode ${cartoonEpisode.number}, arc ${cartoonEpisode.arc.name}`;
  }

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

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const rawData = await callDelfaAPI(instructions, attempt);
      const parsed = normalizeResponse(rawData);
      script = validateSegments(parsed.segments, segmentCount);
      console.log(`✅ Script valide obtenu à la tentative ${attempt}`);
      break;
    } catch (error) {
      lastError = error;
      console.warn(`⚠️ Script invalide ou API indisponible (essai ${attempt}/${MAX_ATTEMPTS}): ${error.message}`);
      if (attempt < MAX_ATTEMPTS) {
        const backoff = attempt * 2500 + Math.random() * 1000;
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
  }

  // Fallback local si l'API n'a jamais répondu correctement
  let usedFallback = false;
  if (!script) {
    console.warn(`⚠️ Toutes les tentatives API ont échoué (${lastError?.message}). Passage en mode fallback local.`);
    script = generateFallbackScript(themeId, theme, segmentCount, fallbackMeta);
    usedFallback = true;
  }

  const episodeMetadata = {};
  if (mangaEpisode) {
    episodeMetadata.manga_episode = {
      number: mangaEpisode.number,
      date: mangaEpisode.date,
      series_title: mangaEpisode.title,
      arc: mangaEpisode.arc.name,
      arc_goal: mangaEpisode.arc.goal,
    };
  }
  if (cartoonEpisode) {
    episodeMetadata.cartoon_episode = {
      number: cartoonEpisode.number,
      date: cartoonEpisode.date,
      series_title: cartoonEpisode.title,
      arc: cartoonEpisode.arc.name,
      arc_goal: cartoonEpisode.arc.goal,
      themes: cartoonEpisode.arc.themes,
    };
  }

  const output = {
    theme: themeId,
    theme_label: theme.label,
    visual_mode: theme.visualMode,
    visual_style: theme.visualStyle,
    segment_count: segmentCount,
    ...episodeMetadata,
    script,
    generated_at: new Date().toISOString(),
    fallback_used: usedFallback,
    generator: usedFallback ? "local-fallback" : "delfa-api",
  };
  fs.mkdirSync("./tmp_data", { recursive: true });
  fs.writeFileSync("./tmp_data/script_data.json", JSON.stringify(output, null, 2), "utf-8");
  console.log(`✅ Script généré: ${script.length} scènes — ${theme.label}${usedFallback ? " (fallback local)" : ""}.`);
}

main().catch((error) => {
  console.error("❌ Erreur de génération du script:", error.message);
  process.exit(1);
});
