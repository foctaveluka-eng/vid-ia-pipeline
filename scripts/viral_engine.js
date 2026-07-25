/**
 * VIRAL ENGINE — Logiques et structures pour vidéos qui buzzent sur YouTube Shorts / TikTok
 * Fournit des hooks, beats de rétention, CTA et scoring de viralité pour les 4 formats.
 *
 * Principes appliqués :
 * - 0-3s HOOK qui stoppe le scroll (curiosity gap, chiffre choc, question ouverte)
 * - Pattern interrupts tous les 3-4 segments (nouveau visuel, twist, zoom)
 * - Montée de tension + twist à 70%
 * - Payoff + leçon / révélation
 * - Cliffhanger + CTA qui déclenche commentaires (question ouverte, "et toi ?")
 */

"use strict";

const VIRAL_HOOKS = {
  dessin_anime: [
    "Chut ! {character} vient de trouver un truc BIZARRE sous le {lieu} et personne ne doit le savoir...",
    "ATTENTION : la rumeur la plus folle du verger vient de démarrer — et c'est {character} qui est accusé !",
    "Oh non ! {character} a fait une GROSSE bêtise ce matin, et tout le verger va le savoir...",
    "STOP ! Si tu aimes {theme}, tu vas ADORER ce qui arrive à {character} aujourd'hui",
    "Le secret que {character} cache depuis {n} jours vient d'exploser !",
  ],
  manga: [
    "Mika ne devait JAMAIS ouvrir cette page. Maintenant Orne va s'effacer.",
    "Ilyan a trahi les Veilleurs — et c'était le PLAN depuis le début.",
    "Le soleil noir vient de s'éteindre 7 secondes. Personne ne comprend pourquoi sauf Mika.",
    "Ce que les archives cachaient sous Orne va tout changer. Chapitre {number} = point de non-retour.",
    "Ils pensaient avoir gagné. Puis l'encre s'est mise à saigner.",
  ],
  actualites: [
    "Personne n'en parle mais {sujet} vient de changer les règles du jeu mondial.",
    "🚨 CHIFFRE CHOC : {chiffre} en 24h — et ce n'est que le début de {sujet}",
    "Ce que les médias ne te disent pas sur {sujet} — les 3 faits qui dérangent",
    "En 48h, {lieu} a tout perdu. La raison ? {twist} — et ça nous concerne tous.",
    "BREAKING : {evenement} — voici pourquoi tu devrais t'inquiéter (et quoi faire)",
  ],
  horreur: [
    "Je n'ai pas dormi depuis 3 nuits à cause de ce qui s'est passé dans le couloir.",
    "Je vous jure, la porte était fermée à clé. Pourtant elle était ouverte à 3h12.",
    "J'ai enregistré le bruit. Écoutez jusqu'à la fin — vous allez comprendre pourquoi j'ai déménagé.",
    "Mon voisin m'avait prévenu : 'Ne regarde jamais sous l'évier la nuit'. J'ai regardé.",
    "Ça a commencé par un souffle. Maintenant ça connaît mon prénom.",
  ],
};

const RETENTION_TRIGGERS = {
  dessin_anime: ["mini-révélation", "réaction drôle de Orange", "nouveau indice visuel", "question au spectateur", "pause comique"],
  manga: ["flash d'action", "révélation de pouvoir", "dialogue choc", "zoom sur boussole", "souvenir qui revient"],
  actualites: ["chiffre à l'écran (décrit)", "témoignage", "carte / lieu", "conséquence concrète", "question éthique"],
  horreur: ["silence + souffle", "ombre qui bouge", "objet déplacé", "whisper", "fausse accalmie"],
};

const CTA_TEMPLATES = {
  dessin_anime: [
    "Et toi, tu aurais fait quoi à la place de {character} ? Dis-le en commentaire !",
    "Tu veux savoir ce qu'il y a DANS la boîte ? Abonne-toi, suite demain !",
    "Leçon du jour : {lesson} — Tu es d'accord ?",
    "Si tu as déjà vécu une rumeur comme ça, mets 🍎 en commentaire !",
  ],
  manga: [
    "Team Mika ou Team Ilyan ? Ton choix va compter pour la suite — commente !",
    "Tu penses que l'encre va choisir quoi ? Théories en commentaires — je lis tout !",
    "Chapitre {number} t'a choqué ? Attends chapitre {next} — abonne-toi pour ne pas le rater !",
  ],
  actualites: [
    "Et toi, tu penses que {sujet} va s'améliorer ou empirer ? Donne ton avis en commentaire !",
    "Tu veux la suite avec sources vérifiées ? Abonne-toi, on poste 3x par jour !",
    "Tu savais pour {fait} ? Dis-moi en commentaire si tu veux le dossier complet !",
  ],
  horreur: [
    "Tu aurais ouvert la porte ou pas ? Dis-moi en commentaire — je dois savoir si je suis fou !",
    "Si tu veux la partie 2 (j'ai retrouvé l'enregistrement), mets 💀 et abonne-toi !",
    "Ça t'est déjà arrivé ce genre de truc ? Raconte en commentaire, on se soutient !",
  ],
};

// Structures de beats par nombre de segments
function getViralBeats(theme, segmentCount, episodeMeta = {}) {
  // Retourne un tableau de directives par segment
  const beats = [];
  const pct = (i) => i / segmentCount;

  for (let i = 0; i < segmentCount; i++) {
    const p = pct(i);
    let directive = "";
    if (i === 0) {
      directive = "HOOK 0-3s : commence par une phrase choc qui stoppe le scroll, curiosity gap, question ouverte ou chiffre fou. 8-12 mots max, très oral, émotion forte. Doit contenir un mot-clé viral du thème.";
    } else if (p < 0.15) {
      directive = "SETUP + PROMESSE : pose le lieu/personnages en 1 phrase, et fais une promesse claire de ce que le spectateur va découvrir. Pattern interrupt visuel (wide shot).";
    } else if (p < 0.35) {
      directive = "INCIDENT / MYSTÈRE : introduis le problème du jour, avec un détail sensoriel ou visuel nouveau. Garde un micro open-loop.";
    } else if (p < 0.55) {
      directive = "ESCALADE + RETENTION : ajoute 1 obstacle ou révélation partielle, puis mini-cliffhanger. Utilise un changement de cadrage (close-up).";
    } else if (p < 0.75) {
      directive = "TWIST 70% : révélation ou retournement qui change tout, le moment le plus fort émotionnellement. Doit surprendre même les habitués.";
    } else if (p < 0.85) {
      directive = "RÉSOLUTION / PAYOFF : résous le conflit de façon positive (dessin_anime) ou explique l'implication (actu) ou survie (horreur) ou victoire douce-amère (manga).";
    } else if (p < 0.95) {
      directive = "LEÇON / VALEUR + TEASER : donne 1 leçon simple ou 1 insight mémorable, puis ouvre une boucle pour demain (cliffhanger).";
    } else {
      directive = "CTA VIRAL : question ouverte ultra engageante qui pousse au commentaire + incitation abo pour suite. Finis sur image qui donne envie de partager.";
    }
    // Ajoute trigger de rétention
    const triggers = RETENTION_TRIGGERS[theme] || RETENTION_TRIGGERS.actualites;
    const trigger = triggers[i % triggers.length];
    beats.push(`${directive} [Retention: ${trigger}]`);
  }

  // Ajoute méta épisode si dispo
  if (episodeMeta.title) {
    beats[0] += ` Contexte série: ${episodeMeta.title} — Arc: ${episodeMeta.arc?.name || ""}`;
  }
  return beats;
}

function getViralTitleTemplates(theme) {
  const templates = {
    dessin_anime: [
      "🍎 SECRET : {character} a menti et tout le verger est en danger ! Épisode {number}",
      "OMG ! La rumeur sur {character} est VRAIE ?! Verger Magique Épisode {number}",
      "Pomme vs Orange : le clash qui va changer le verger Épisode {number} 😱",
      "{character} a trouvé {objet} INTERDIT — la suite va te choquer Épisode {number}",
      "Ils ont caché ça pendant {n} jours... Verger Magique Ép {number}",
    ],
    manga: [
      "Chapitre {number} : Mika vient de TRAHIR tout le monde — Obsidienne",
      "Le Soleil Noir s'est éteint — Chapitre {number} va tout changer {arc}",
      "Ilyan révèle son vrai pouvoir — Chapitre {number} est INSANE",
      "Ils pensaient avoir gagné… puis l'encre a saigné — Chap {number}",
      "CHOC Chap {number} : la boussole brisée vient de choisir — et ce n'est pas Mika",
    ],
    actualites: [
      "🚨 {sujet} : le chiffre que personne n'ose dire ({chiffre})",
      "{lieu} : ce qui vient de se passer va te concerner directement",
      "J'ai vérifié {sujet} — voici les 3 faits qui changent tout",
      "BREAKING : {evenement} — pourquoi ça explose maintenant ?",
      "{sujet} : l'info que les médias cachent (preuves à l'appui)",
    ],
    horreur: [
      "Je n'aurais JAMAIS dû ouvrir cette porte à 3h12 — histoire vraie",
      "J'ai enregistré le bruit dans le couloir — écoute jusqu'à la fin",
      "Mon voisin m'avait prévenu : ne regarde pas sous l'évier",
      "Ça connaît mon prénom maintenant — partie {number}",
      "3 nuits sans dormir à cause de ça — je raconte tout",
    ],
  };
  return templates[theme] || templates.actualites;
}

function getHashtagPacks(theme) {
  const packs = {
    dessin_anime: {
      core: ["#DessinAnime", "#VergerMagique", "#HistoirePourEnfants"],
      viral: ["#PourToi", "#FYP", "#BuzzKids", "#MoralDuJour", "#Cliffhanger"],
      niche: ["#PommeLaCurieuse", "#FruitsMagiques", "#AnimationFrancaise"],
    },
    manga: {
      core: ["#MangaFR", "#MangaOriginal", "#VeilleursObsidienne"],
      viral: ["#PourToi", "#FYP", "#ChapitreDuJour", "#PlotTwist", "#MangaTok"],
      niche: ["#Obsidienne", "#DarkFantasy", "#SeinenFR"],
    },
    actualites: {
      core: ["#Actualites", "#InfoDuJour", "#Monde"],
      viral: ["#PourToi", "#BreakingNews", "#Explication", "#FautSavoir"],
      niche: ["#Geopolitique", "#Economie", "#FactChecking"],
    },
    horreur: {
      core: ["#Horreur", "#HistoireVraie", "#Creepy"],
      viral: ["#PourToi", "#FYP", "#ThreadHorreur", "#NeDorsPas", "#Jumpscare"],
      niche: ["#Paranormal", "#HorreurFR", "#HistoireQuiFaitPeur"],
    },
  };
  return packs[theme] || packs.actualites;
}

function scoreVirality(script, theme) {
  let score = 0;
  const reasons = [];
  const fullText = script.map((s) => s.audio_texte?.toLowerCase() || "").join(" ");

  // 1. Hook présent en segment 1 (court, question ou chiffre ou mot émotion)
  const first = script[0]?.audio_texte || "";
  if (first.length <= 120 && /(\?|!|incroyable|choquant|secret|mystère|jamais|personne|attends|omg|chut)/i.test(first)) {
    score += 25;
    reasons.push("Hook fort en seg1");
  } else {
    reasons.push("Hook faible seg1");
  }

  // 2. Twist à 70%
  const midIndex = Math.floor(script.length * 0.7);
  const midText = script[midIndex]?.audio_texte?.toLowerCase() || "";
  if (/(mais|soudain|en fait|révélation|plot twist|en réalité|puis|alors que)/i.test(midText)) {
    score += 20;
    reasons.push("Twist détecté ~70%");
  } else {
    reasons.push("Pas de twist marqué");
  }

  // 3. CTA en dernier segment
  const last = script[script.length - 1]?.audio_texte?.toLowerCase() || "";
  if (/(et toi|tu penses|commente|abonne|suite|demain|qu'en penses|et vous)/i.test(last)) {
    score += 25;
    reasons.push("CTA présent fin");
  } else {
    reasons.push("Pas de CTA");
  }

  // 4. Pattern interrupts / variété visuelle
  const prompts = script.map((s) => s.prompt_visuel || "");
  const unique = new Set(prompts.map((p) => p.split(" ").slice(0, 5).join(" "))).size;
  if (unique >= script.length * 0.7) {
    score += 15;
    reasons.push("Variété visuelle OK");
  } else {
    reasons.push("Visuels répétitifs");
  }

  // 5. Mots viral triggers
  const triggers = ["secret", "mystère", "révélation", "jamais", "toujours", "incroyable", "choquant", "personne ne", "tu vas", "pourquoi"];
  const triggerCount = triggers.filter((t) => fullText.includes(t)).length;
  score += Math.min(15, triggerCount * 3);
  reasons.push(`${triggerCount} triggers viraux`);

  // Score total /100
  return { score: Math.min(100, score), reasons, isViral: score >= 70, isPerfect: score >= 85 };
}

function generateViralPromptAddendum(theme, beats, index) {
  const beat = beats[index] || "";
  return `Directive virale segment ${index + 1}: ${beat}. Audio_texte doit être oral, court (10-18 mots), avec émotion, et faire avancer l'histoire. Prompt_visuel doit changer de cadrage par rapport au précédent (wide/close-up/over-shoulder) et inclure un détail nouveau pour retention.`;
}

module.exports = {
  VIRAL_HOOKS,
  RETENTION_TRIGGERS,
  CTA_TEMPLATES,
  getViralBeats,
  getViralTitleTemplates,
  getHashtagPacks,
  scoreVirality,
  generateViralPromptAddendum,
};
