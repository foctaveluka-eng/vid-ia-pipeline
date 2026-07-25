/**
 * ÉTAPE 1 — PRO VIRAL : Génération de scénario qui buzz
 * - Utilise viral_engine pour structures qui retiennent et font commenter
 * - Hook 0-3s, pattern interrupts, twist 70%, CTA viral
 * - Scoring de viralité et retry si score faible
 */

"use strict";

const axios = require("axios");
const fs = require("fs");
const { THEMES, getThemeFromEnvironment, getSegmentCount, getMangaEpisode, getCartoonEpisode } = require("./pipeline_config");
const {
  VIRAL_HOOKS,
  CTA_TEMPLATES,
  getViralBeats,
  scoreVirality,
  generateViralPromptAddendum,
} = require("./viral_engine");
const { getCharacterBible, enrichSegmentsWithCharacters } = require("./character_engine");
const { enrichSegmentsWithContinuity, validateContinuity } = require("./continuity_engine");

const DELFA_API_URL = process.env.DELFA_API_URL || "https://delfaapiai.vercel.app/ai/copilot";
const MAX_ATTEMPTS = 5;
const REQUEST_TIMEOUT = 180000;

function stripJson(answer) {
  const raw = String(answer || "").trim();
  if (!raw) throw new Error("Réponse vide");
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    const direct = JSON.parse(cleaned);
    if (direct && typeof direct === "object") return direct;
  } catch {}
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    try {
      return JSON.parse(cleaned.slice(first, last + 1));
    } catch (e) {
      throw new Error(`JSON invalide: ${e.message}`);
    }
  }
  throw new Error("Pas de JSON");
}

function normalizeResponse(data) {
  if (!data) throw new Error("vide");
  if (typeof data === "string") return stripJson(data);
  if (Array.isArray(data)) return { segments: data };
  if (data.segments) return data;
  if (data.answer) {
    if (typeof data.answer === "object" && data.answer.segments) return data.answer;
    return stripJson(data.answer);
  }
  if (data.result) {
    if (typeof data.result === "string") return stripJson(data.result);
    if (data.result.segments) return data.result;
  }
  return stripJson(JSON.stringify(data));
}

function validateSegments(segments, expected) {
  if (!Array.isArray(segments) || segments.length === 0) throw new Error(`Reçu ${segments?.length ?? 0} segments`);
  let working = segments;
  if (segments.length > expected) {
    console.warn(`⚠️ ${segments.length} > ${expected}, tronque`);
    working = segments.slice(0, expected);
  } else if (segments.length < expected) {
    throw new Error(`Besoin ${expected}, reçu ${segments.length}`);
  }
  return working.map((s, i) => {
    const audio = String(s?.audio_texte || s?.audio || s?.text || "").trim();
    const visual = String(s?.prompt_visuel || s?.visual || s?.prompt || "").trim();
    if (!audio || !visual) throw new Error(`Seg ${i + 1} incomplet`);
    return { id: i + 1, audio_texte: audio, prompt_visuel: visual };
  });
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateViralFallbackScript(themeId, theme, segmentCount, episodeMeta, viralBeats) {
  console.warn("⚠️ Fallback VIRAL local — API down, génération buzz à la main");
  const hooks = VIRAL_HOOKS[themeId] || VIRAL_HOOKS.actualites;
  const ctas = CTA_TEMPLATES[themeId] || CTA_TEMPLATES.actualites;

  const base = {
    dessin_anime: {
      audios: [
        () => randomPick(hooks).replace("{character}", "Pomme").replace("{lieu}", "grand chêne").replace("{theme}", "les secrets"),
        "Banane le sage a vu quelque chose et il n'ose pas le dire tout haut.",
        "Fraise la téméraire propose un plan fou pour découvrir la vérité aujourd'hui.",
        "Orange fait une blague mais ses yeux trahissent qu'il cache un indice important.",
        "Soudain, une rumeur explose : quelqu'un aurait trouvé la boîte interdite du verger !",
        "Pomme confronte Orange calmement : la communication est la clé, même quand on a peur.",
        "Le groupe découvre que la rumeur était à moitié vraie — et à moitié piège pour tester leur amitié.",
        "Ils réalisent que vérifier avant de juger les rend plus forts ensemble, vraiment.",
      ],
      visuals: "colorful 3D cartoon, cute fruits, magical orchard, expressive, child-friendly, no text",
    },
    manga: {
      audios: [
        () => randomPick(hooks).replace("{number}", String(episodeMeta?.number || 2)),
        "Mika serre sa boussole brisée, l'encre coule à l'envers dans l'air froid.",
        "Ilyan bloque le couloir, son gantelet crépite : 'Tu ne passeras pas, Mika.'",
        "Mais soudain, la page volée révèle une phrase que seule Mika peut entendre.",
        "Le soleil noir pulse, une seconde de nuit totale — Orne retient son souffle.",
        "Révélation : le collectionneur n'est pas l'ennemi, c'est un Veilleur déchu qui protège un secret.",
        "Mika doit choisir : sauver la cité ou garder le dernier souvenir de sa mère.",
        "Elle choisit les deux — et l'encre la choisit en retour, marquant sa main.",
      ],
      visuals: "original black-and-white manga, Mika white coat, obsidian compass, dark city Orne, ink effects, no text",
    },
    actualites: {
      audios: [
        () => randomPick(hooks).replace("{sujet}", "cette crise").replace("{chiffre}", "3,2 milliards").replace("{lieu}", "cette région"),
        "Les sources officielles viennent de confirmer ce que peu osaient dire hier.",
        "Voici le chiffre que tout le monde ignore : 78% des cas sont liés à une seule décision.",
        "Mais attends, la partie la plus choquante arrive maintenant et personne n'en parle.",
        "Sur place, les témoins décrivent une scène irréelle, entre peur et solidarité massive.",
        "Pourquoi maintenant ? Parce que 3 facteurs se sont alignés en même temps, c'est inédit.",
        "Ce que ça change pour toi : prix, sécurité, et une opportunité cachée que peu voient.",
        "Et toi, tu penses qu'on va vers le pire ou vers un sursaut ? Dis-le en commentaire !",
      ],
      visuals: "documentary editorial illustration, realistic, news reportage, clear composition, professional, no text",
    },
    horreur: {
      audios: [
        () => randomPick(hooks),
        "Je pose mon téléphone, j'écoute : un souffle léger vient de sous la porte fermée.",
        "La lumière du couloir clignote deux fois, puis plus rien, juste mon cœur qui cogne.",
        "J'ouvre tout doucement, la porte grince, et je vois que l'ombre a bougé toute seule.",
        "Soudain, un murmure dit mon prénom exactement comme ma mère le disait avant.",
        "Je recule, je veux crier mais aucun son ne sort, l'air est devenu glacé d'un coup.",
        "Je comprends alors que ce n'est pas la maison qui est hantée, c'est moi depuis le début.",
        "Et toi, tu aurais ouvert ou tu aurais fui ? Mets 💀 si tu veux la partie 2 avec l'enregistrement !",
      ],
      visuals: "dark cinematic horror, first-person, atmospheric shadows, tension, no gore, no text",
    },
  };

  const pack = base[themeId] || base.actualites;
  const segs = [];
  for (let i = 0; i < segmentCount; i++) {
    const audioTemplate = pack.audios[i % pack.audios.length];
    const audio = typeof audioTemplate === "function" ? audioTemplate() : audioTemplate;
    let finalAudio = audio;
    // Inject viral beat guidance
    if (i === 0) {
      finalAudio = audio; // hook
    } else if (i === segmentCount - 1) {
      const cta = randomPick(ctas).replace("{character}", "Pomme").replace("{number}", String(episodeMeta?.number || 1)).replace("{next}", String((episodeMeta?.number || 1) + 1));
      finalAudio = cta;
    } else if (i === Math.floor(segmentCount * 0.7)) {
      finalAudio = audio + " Mais là, tout bascule.";
    }

    const beat = viralBeats[i] || "";
    const visual = `${pack.visuals}. ${beat.split("[")[0].slice(0, 120)}. Scene ${i + 1}/${segmentCount}, ${i % 2 === 0 ? "wide" : "close-up"} storytelling.`;

    segs.push({ id: i + 1, audio_texte: finalAudio, prompt_visuel: visual });
  }
  return segs;
}

async function callDelfaAPI(instructions, attempt) {
  const params = {
    model: "default",
    message: `${instructions}\nTentative ${attempt}/${MAX_ATTEMPTS}: respecte EXACT nombre segments + structure virale. JSON only.`,
  };
  try {
    console.log(`🔗 GET Delfa tentative ${attempt}`);
    const res = await axios.get(DELFA_API_URL, { params, timeout: REQUEST_TIMEOUT, headers: { Accept: "application/json" }, validateStatus: (s) => s < 500 });
    if (res.status >= 400) throw new Error(`GET ${res.status}`);
    return res.data;
  } catch (err) {
    if (attempt > 2) {
      console.log(`🔗 POST Delfa fallback ${attempt}`);
      const res = await axios.post(DELFA_API_URL, { model: "default", message: params.message }, { timeout: REQUEST_TIMEOUT, headers: { "Content-Type": "application/json" }, validateStatus: (s) => s < 500 });
      if (res.status >= 400) throw new Error(`POST ${res.status}`);
      return res.data;
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

  const episodeMeta = mangaEpisode || cartoonEpisode || {};
  const viralBeats = getViralBeats(themeId, segmentCount, episodeMeta);

  let sagaContext = "";
  if (isManga) {
    sagaContext = `SÉRIE: ${mangaEpisode.title} Chapitre ${mangaEpisode.number} du ${mangaEpisode.date}. Arc: ${mangaEpisode.arc.name} - ${mangaEpisode.arc.goal}. Bible: ${mangaEpisode.visualBible}.`;
  } else if (isCartoon) {
    sagaContext = `SÉRIE: ${cartoonEpisode.title} Épisode ${cartoonEpisode.number} du ${cartoonEpisode.date}. Arc: ${cartoonEpisode.arc.name} - ${cartoonEpisode.arc.goal}. Thèmes: ${cartoonEpisode.arc.themes.join(", ")}. Bible: ${cartoonEpisode.visualBible}. Structure: ${Object.values(cartoonEpisode.episodeStructure).join(" → ")}.`;
  }

  const viralGuidance = viralBeats.map((b, i) => `${i + 1}. ${b}`).join("\n");

  const instructions = `Tu es scénariste VIRAL pour vidéos verticales 9:16 qui doivent BUZZER sur YouTube Shorts / TikTok français.

FORMAT: ${theme.label}
SUJET: ${theme.subject}
STYLE DE BASE: ${theme.style}

${sagaContext}

🔥 STRUCTURE VIRALE OBLIGATOIRE POUR ${segmentCount} SEGMENTS (Buzz garanti) :
${viralGuidance}

RÈGLES VIRALES NON NÉGOCIABLES :
- Segment 1 = HOOK scroll-stopper ultra court (8-12 mots), curiosity gap, question ou chiffre choc
- Segments 2-${Math.floor(segmentCount * 0.3)} = Setup rapide + promesse forte de ce que le spectateur va découvrir
- Segments ${Math.floor(segmentCount * 0.3) + 1}-${Math.floor(segmentCount * 0.7)} = Escalade avec pattern interrupts visuels (change de cadrage chaque segment), mini open-loops
- Segment ~${Math.floor(segmentCount * 0.7) + 1} = TWIST majeur à 70% qui retourne tout (le moment le plus partageable)
- Segments ${Math.floor(segmentCount * 0.8)}-${segmentCount - 1} = Payoff + Leçon/insight mémorable + teaser suite
- Dernier segment = CTA VIRAL qui déclenche commentaires : question ouverte "Et toi ?" + "Abonne-toi pour partie 2 / suite demain" + emoji
- Chaque audio_texte 10-18 mots, oral, français, avec mot émotion fort
- Chaque prompt_visuel en anglais, action + cadrage + détail rétention, no text, no watermark
- Inclus mot-clés viraux : secret, mystère, révélation, jamais, choquant, incroyable, personne ne, tu vas
- Préserve mêmes personnages/objets, mais varie cadrage wide/close-up pour rétention

Exemples hook ${themeId}: ${VIRAL_HOOKS[themeId].slice(0, 2).join(" | ")}

Réponds UNIQUEMENT JSON valide:
{"segments":[{"id":1,"audio_texte":"...","prompt_visuel":"..."}]}`;

  console.log(`🚀 [${themeId.toUpperCase()} VIRAL] ${segmentCount} segments — Buzz structure activée...`);
  let script;
  let lastErr;
  let bestScore = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const raw = await callDelfaAPI(instructions, attempt);
      const parsed = normalizeResponse(raw);
      const validated = validateSegments(parsed.segments, segmentCount);
      const { score, reasons, isViral } = scoreVirality(validated, themeId);
      console.log(`   📊 Score viral tentative ${attempt}: ${score}/100 — ${reasons.join(", ")}`);
      if (score > bestScore) {
        bestScore = score;
        script = validated;
      }
      if (isViral) {
        console.log(`   🔥 Viral validé (${score}) à tentative ${attempt}`);
        script = validated;
        break;
      } else if (attempt < MAX_ATTEMPTS) {
        console.warn(`   ⚠️ Score viral ${score} <70, on retente avec plus de hooks...`);
      }
    } catch (e) {
      lastErr = e;
      console.warn(`   ⚠️ Tentative ${attempt}/${MAX_ATTEMPTS} échouée: ${e.message}`);
      if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, attempt * 2000 + Math.random() * 1000));
    }
  }

  let usedFallback = false;
  let fallbackMeta = null;
  if (isManga) fallbackMeta = mangaEpisode;
  else if (isCartoon) fallbackMeta = cartoonEpisode;

  if (!script || bestScore < 50) {
    console.warn(`⚠️ Score viral final ${bestScore} trop bas ou échec API (${lastErr?.message}), fallback VIRAL local`);
    script = generateViralFallbackScript(themeId, theme, segmentCount, fallbackMeta, viralBeats);
    usedFallback = true;
  }

  // Verrouille les personnages et l'état visuel avant de transmettre le script au moteur vidéo.
  const characterBible = getCharacterBible(themeId, episodeMeta.series);
  script = enrichSegmentsWithContinuity(enrichSegmentsWithCharacters(script, characterBible));
  const continuity = validateContinuity(script);
  if (!continuity.valid) throw new Error(`Plan de continuité invalide: ${continuity.issues.join("; ")}`);

  // Score final
  const finalScore = scoreVirality(script, themeId);
  console.log(`🏆 Score viral final: ${finalScore.score}/100 — ${finalScore.isViral ? "VIRAL" : "corrigeable"} — ${finalScore.reasons.join(" | ")}`);

  const episodeMetadata = {};
  if (mangaEpisode) {
    episodeMetadata.manga_episode = { number: mangaEpisode.number, date: mangaEpisode.date, series_title: mangaEpisode.title, arc: mangaEpisode.arc.name, arc_goal: mangaEpisode.arc.goal };
  }
  if (cartoonEpisode) {
    episodeMetadata.cartoon_episode = { number: cartoonEpisode.number, date: cartoonEpisode.date, series_title: cartoonEpisode.title, arc: cartoonEpisode.arc.name, arc_goal: cartoonEpisode.arc.goal, themes: cartoonEpisode.arc.themes };
  }

  const output = {
    theme: themeId,
    theme_label: theme.label,
    visual_mode: theme.visualMode,
    visual_style: theme.visualStyle,
    segment_count: segmentCount,
    viral_score: finalScore.score,
    viral_reasons: finalScore.reasons,
    viral_structure: viralBeats,
    character_bible: characterBible,
    continuity_validated: continuity.valid,
    ...episodeMetadata,
    script,
    generated_at: new Date().toISOString(),
    fallback_used: usedFallback,
    generator: usedFallback ? "viral-local-fallback-buzz" : "delfa-api-viral",
  };

  fs.mkdirSync("./tmp_data", { recursive: true });
  fs.writeFileSync("./tmp_data/script_data.json", JSON.stringify(output, null, 2), "utf-8");
  console.log(`✅ Script VIRAL généré: ${script.length} scènes — ${theme.label} — score ${finalScore.score} ${usedFallback ? "(fallback buzz)" : ""}`);
}

main().catch((err) => {
  console.error("❌ Erreur fatale viral:", err.message);
  process.exit(1);
});
