/**
 * ÉTAPE 1 — V3 VIRAL ULTIME : Génération de script avec stratégie virale complète
 *
 * Utilise le nouveau Viral Strategy v3 avec :
 * - Courbes d'émotion précises par phase (hook → setup → escalation → twist → resolution → cta)
 * - Pattern interrupts millimétrés
 * - Comment-bait engineering
 * - Trend jacking saisonnier
 * - Scoring de hook individuel
 * - Analytics feedback loop
 *
 * @author Viral Strategy v3
 */

"use strict";

const axios = require("axios");
const fs = require("fs");
const { THEMES, getThemeFromEnvironment, getSegmentCount, getMangaEpisode, getCartoonEpisode } = require("./pipeline_config");
const { generateViralPrompt, scoreViralityV3 } = require("./viral_strategy_v3");
const { getSeasonalPromptAddendum, generateTrendingSubject, scoreTrendRelevance } = require("./viral_trend_jacker");
const { scoreVirality, generateViralPromptAddendum } = require("./viral_engine");

const DELFA_API_URL = process.env.DELFA_API_URL || "https://delfaapiai.vercel.app/ai/copilot";
const MAX_ATTEMPTS = 5;
const REQUEST_TIMEOUT = 180000;

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
    } catch {}
  }
  throw new Error("JSON invalide");
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

async function callDelfaAPI(instructions, attempt) {
  const params = {
    model: "default",
    message: `${instructions}\nTentative ${attempt}/${MAX_ATTEMPTS}: JSON UNIQUEMENT, respecte EXACTEMENT le nombre de segments et les directives virales.`,
  };
  try {
    console.log(`🔗 [V3] API Delfa tentative ${attempt}`);
    const res = await axios.get(DELFA_API_URL, { params, timeout: REQUEST_TIMEOUT, headers: { Accept: "application/json" }, validateStatus: (s) => s < 500 });
    if (res.status >= 400) throw new Error(`GET ${res.status}`);
    return res.data;
  } catch (err) {
    if (attempt > 2) {
      console.log(`🔗 POST fallback ${attempt}`);
      const res = await axios.post(DELFA_API_URL, { model: "default", message: params.message }, { timeout: REQUEST_TIMEOUT, headers: { "Content-Type": "application/json" }, validateStatus: (s) => s < 500 });
      if (res.status >= 400) throw new Error(`POST ${res.status}`);
      return res.data;
    }
    throw err;
  }
}

// ─── Fallback viral local amélioré v3 ───────────────────────────────────────
function generateViralFallbackScriptV3(themeId, theme, segmentCount, episodeMeta) {
  console.warn("⚠️ Fallback VIRAL V3 local — génération buzz optimisée");

  // Templates d'audio ultra-optimisés par phase virale
  const phaseTemplates = {
    hook: {
      dessin_anime: [
        "CHUT ! Pomme vient de trouver un secret sous le grand chêne... et tout le verger est en danger !",
        "ATTENTION : Orange a menti à tout le monde depuis 3 jours — voici la vérité.",
        "Oh non ! Fraise a cassé la boîte INTERDITE du verger magique...",
      ],
      manga: [
        "Mika vient de découvrir que sa boussole brisée n'est pas brisée — elle est scellée.",
        "Le Soleil Noir s'est éteint 7 secondes. Ilyan savait que ça arriverait.",
        "La trahison d'Ilyan était en fait le SEUL moyen de sauver Orne.",
      ],
      actualites: [
        "Personne n'en parle mais 78% des gens ignorent ce qui vient de changer.",
        "🚨 CHIFFRE CHOC : 3,2 milliards concernés en 24h — et ça va empirer.",
        "Ce que les médias ne vous disent pas sur ce qui vient de se passer.",
      ],
      horreur: [
        "Je n'ai pas dormi depuis 3 nuits. La porte du couloir s'ouvre TOUTE SEULE à 3h12.",
        "Mon voisin m'avait dit : 'Ne regarde jamais sous l'évier'. J'ai regardé cette nuit.",
        "J'ai enregistré un bruit dans le grenier... écoute jusqu'à la fin, tu vas comprendre.",
      ],
    },
    setup: {
      default: [
        "Voici ce qu'il faut savoir : {context} — et ça change tout.",
        "Pour comprendre, il faut savoir que {context}. Maintenant accroche-toi.",
        "Je vais tout t'expliquer en 20 secondes. {context}.",
      ],
    },
    twist: {
      dessin_anime: ["Mais en fait... ce n'était pas un mensonge. C'était UN TEST d'amitié !"],
      manga: ["Mais la vérité est bien PIRE : l'encre ne coule pas — elle CHOISIT qui elle marque."],
      actualites: ["Sauf que la réalité est encore plus complexe : les vrais chiffres sont 3x plus élevés."],
      horreur: ["Mais le pire, c'est que quand j'ai regardé sous le lit... il n'y avait PERSONNE. Normalement."],
    },
    cta: {
      dessin_anime: [
        "Et toi, t'aurais ouvert la boîte ou pas ? Dis-le en commentaire ! Abonne-toi pour l'épisode {next} ! 🍎",
      ],
      manga: [
        "Team Mika ou Team Ilyan ? Ton commentaire va compter pour le chapitre {next} ! 🔥",
      ],
      actualites: [
        "Et toi, ça te fait réagir ? Commente et abonne-toi pour les sources vérifiées ! 🚨",
      ],
      horreur: [
        "Tu serais resté ou tu aurais fui ? Si tu veux la partie 2, mets 💀 en commentaire !",
      ],
    },
  };

  const segs = [];
  for (let i = 0; i < segmentCount; i++) {
    const pct = i / segmentCount;
    let audio, visual;

    if (i === 0) {
      // HOOK
      const hooks = phaseTemplates.hook[themeId] || phaseTemplates.hook.actualites;
      audio = hooks[i % hooks.length];
      visual = `${theme.visualStyle}. Scroll-stopping opening shot, intense composition, wide establishing scene for ${theme.label}, no text, no watermark.`;
    } else if (pct >= 0.9) {
      // CTA
      const ctas = phaseTemplates.cta[themeId] || phaseTemplates.cta.actualites;
      audio = ctas[0].replace("{next}", String((episodeMeta?.number || 1) + 1));
      visual = `${theme.visualStyle}. Final scene, engaging composition, looking at camera, cliffhanger moment, no text.`;
    } else if (pct >= 0.68 && pct <= 0.75) {
      // TWIST
      const twists = phaseTemplates.twist[themeId] || phaseTemplates.twist.actualites;
      audio = twists[i % twists.length];
      visual = `${theme.visualStyle}. Plot twist moment, dramatic reveal, sudden change of perspective, dramatic lighting, no text.`;
    } else if (pct < 0.15) {
      // SETUP
      audio = `La scène se passe dans ${theme.subject.slice(0, 60)}. ${theme.label}, un détail étrange vient tout changer.`;
      visual = `${theme.visualStyle}. Medium establishing shot, introducing the scene, ${i % 2 === 0 ? "wide angle" : "close-up detail"}, cinematic lighting.`;
    } else if (pct < 0.68) {
      // ESCALADE
      audio = `Mais ${["soudain", "personne ne s'y attendait", "voici le moment clé", "et là, tout bascule"][i % 4]}, ${["un nouveau détail apparaît", "la situation empire", "la vérité se rapproche", "rien ne se passe comme prévu"][i % 4]}.`;
      visual = `${theme.visualStyle}. Scene ${i + 1}/${segmentCount}, ${i % 2 === 0 ? "close-up dramatic" : "wide action"}, dynamic composition, ${i % 3 === 0 ? "low angle" : "high angle"}, no text.`;
    } else {
      // RÉSOLUTION
      audio = `Alors voici la vérité : ${["tout était lié depuis le début", "le plus important c'est ce qu'on apprend", "la clé était sous nos yeux"][i % 3]}. Mais ça, c'est pour la prochaine fois.`;
      visual = `${theme.visualStyle}. Resolution scene, satisfying composition, ${i % 2 === 0 ? "warm lighting" : "mysterious twilight"}, final reveal, no text.`;
    }

    segs.push({ id: i + 1, audio_texte: audio, prompt_visuel: visual });
  }
  return segs;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  const themeId = getThemeFromEnvironment();
  const theme = THEMES[themeId];
  const segmentCount = getSegmentCount(themeId);
  const isManga = themeId === "manga";
  const isCartoon = themeId === "dessin_anime";
  const mangaEpisode = isManga ? getMangaEpisode() : null;
  const cartoonEpisode = isCartoon ? getCartoonEpisode() : null;
  const episodeMeta = mangaEpisode || cartoonEpisode || {};

  // ── 1. Contexte de série ──
  let sagaContext = "";
  if (isManga) {
    sagaContext = `SÉRIE: ${mangaEpisode.title} Chapitre ${mangaEpisode.number} du ${mangaEpisode.date}. Arc: ${mangaEpisode.arc.name} - ${mangaEpisode.arc.goal}. Bible: ${mangaEpisode.visualBible}.`;
  } else if (isCartoon) {
    sagaContext = `SÉRIE: ${cartoonEpisode.title} Épisode ${cartoonEpisode.number} du ${cartoonEpisode.date}. Arc: ${cartoonEpisode.arc.name} - ${cartoonEpisode.arc.goal}. Thèmes: ${cartoonEpisode.arc.themes.join(", ")}. Bible: ${cartoonEpisode.visualBible}.`;
  }

  // ── 2. Trend jacking saisonnier ──
  const seasonalAddendum = getSeasonalPromptAddendum(themeId);
  if (seasonalAddendum) {
    console.log(`🌿 Contexte saisonnier: ${seasonalAddendum}`);
  }

  // ── 3. Génération du prompt viral v3 ──
  const viralBeats = []; // Sera rempli par le prompt
  for (let i = 0; i < segmentCount; i++) {
    const pct = i / segmentCount;
    if (i === 0) viralBeats[i] = "HOOK scroll-stopper : curiosity gap + émotion forte, 6-12 mots, interpellation directe";
    else if (pct < 0.15) viralBeats[i] = "SETUP éclair : pose décor + personnage + enjeu en 1 phrase, mini open-loop";
    else if (pct < 0.35) viralBeats[i] = "INCIDENT : problème du jour, détail sensoriel, changement de cadrage";
    else if (pct < 0.55) viralBeats[i] = "ESCALADE : obstacle ou révélation partielle, mini-cliffhanger";
    else if (pct < 0.75) viralBeats[i] = "TWIST 70% : retournement complet, moment le plus partageable";
    else if (pct < 0.88) viralBeats[i] = "RÉSOLUTION : fin satisfaisante mais question ouverte pour suite";
    else if (pct < 0.95) viralBeats[i] = "TEASER suite : ouverture boucle prochain épisode";
    else viralBeats[i] = "CTA VIRAL : question polarisante + incitation abonnement + émoji";
  }

  const { fullPrompt, summary } = generateViralPrompt(themeId, segmentCount, episodeMeta, viralBeats);

  const finalPrompt = `${fullPrompt}\n\n${sagaContext}\n${seasonalAddendum ? `\nCONTEXTE SAISONNIER : ${seasonalAddendum}` : ""}`;

  console.log(`\n🚀 [V3 VIRAL ULTIME] ${themeId.toUpperCase()} — ${segmentCount} segments`);
  console.log(`   Hook window: ${summary.hookWindow.end}s | Twist: ${summary.twistPosition} | Pattern: ${summary.patternInterrupt}`);
  console.log(`   Émotions: ${Object.entries(summary.emotions).map(([p, e]) => `${p}[${e.join(", ")}]`).join(" → ")}`);
  if (seasonalAddendum) console.log(`   🎯 Trend saisonnier actif: ${seasonalAddendum}`);

  // ── 4. Génération du script (tentatives API) ──
  let script;
  let lastErr;
  let bestScore = 0;
  let bestScript = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const raw = await callDelfaAPI(finalPrompt, attempt);
      const parsed = normalizeResponse(raw);
      const validated = validateSegments(parsed.segments, segmentCount);

      // Score viral v3 (amélioré)
      const result = scoreViralityV3(validated, themeId);
      console.log(`   📊 Score VIRAL v3 tentative ${attempt}: ${result.score}/100 — ${result.grade}`);
      console.log(`      ${result.summary}`);

      if (result.score > bestScore) {
        bestScore = result.score;
        bestScript = validated;
      }

      if (result.isViral) {
        console.log(`   🔥 VIRAL OPTIMAL atteint (${result.score}) à tentative ${attempt}`);
        script = validated;
        break;
      } else if (attempt < MAX_ATTEMPTS) {
        console.warn(`   ⚠️ Score < 60, nouvelle tentative avec plus d'émotion et pattern interrupts...`);
      }
    } catch (e) {
      lastErr = e;
      console.warn(`   ⚠️ Tentative ${attempt}/${MAX_ATTEMPTS} échouée: ${e.message}`);
      if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, attempt * 2000 + Math.random() * 1000));
    }
  }

  // Fallback si nécessaire
  if (!bestScript || bestScore < 50) {
    console.warn(`⚠️ Score viral final ${bestScore} trop bas — fallback VIRAL v3 local`);
    script = generateViralFallbackScriptV3(themeId, theme, segmentCount, episodeMeta);
    bestScore = scoreViralityV3(script, themeId).score;
  } else if (!script) {
    script = bestScript;
  }

  // Score final v3
  const finalResult = scoreViralityV3(script, themeId);
  console.log(`\n🏆 Score VIRAL final v3: ${finalResult.score}/100 — Grade ${finalResult.grade}`);
  console.log(`   ${finalResult.summary}`);

  // ── 5. Sauvegarde ──
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
    viral_score: finalResult.score,
    viral_grade: finalResult.grade,
    viral_reasons: finalResult.details.map((d) => `${d.category}: ${d.score}/${d.max}`),
    viral_summary: finalResult.summary,
    hook_score: finalResult.details[0] || null,
    seasonal_context: seasonalAddendum || null,
    ...episodeMetadata,
    script,
    script_v3: true,
    generated_at: new Date().toISOString(),
    generator: "viral-strategy-v3",
  };

  fs.mkdirSync("./tmp_data", { recursive: true });
  fs.writeFileSync("./tmp_data/script_data.json", JSON.stringify(output, null, 2), "utf-8");

  console.log(`\n✅ Script VIRAL v3 généré: ${script.length} scènes — ${finalResult.grade}`);
  console.log(`   Score: ${finalResult.score}/100`);
  console.log(`   Sauvegardé dans: tmp_data/script_data.json`);
}

main().catch((err) => {
  console.error("❌ Erreur fatale Viral v3:", err.message);
  process.exit(1);
});
