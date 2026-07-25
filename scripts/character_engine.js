/**
 * CHARACTER ENGINE — bible de personnages et prompts cohérents entre scènes.
 * Les descriptions sont déterministes : une même série garde les mêmes traits,
 * tenues et accessoires dans chaque image/clip.
 */
"use strict";

const DEFAULT_CAST = {
  dessin_anime: [
    { id: "pomme", name: "Pomme", traits: "small red apple, green leaf tilted right, bright brown eyes, tiny yellow scarf" },
    { id: "orange", name: "Orange", traits: "round orange, small freckle cluster on left cheek, blue cap, playful smile" },
    { id: "banane", name: "Banane", traits: "tall yellow banana, round glasses, purple bow tie, gentle expression" },
    { id: "fraise", name: "Fraise", traits: "heart-shaped strawberry, white seed pattern, turquoise backpack, brave expression" },
  ],
  manga: [
    { id: "mika", name: "Mika", traits: "young adult woman, short black bob with one silver streak, long white coat, obsidian compass on a leather cord" },
    { id: "ilyan", name: "Ilyan", traits: "young adult man, dark curly hair, charcoal high-collar jacket, copper left gauntlet" },
  ],
  horreur: [
    { id: "narrateur", name: "Narrateur", traits: "young adult with short dark hair, worn charcoal hoodie, small silver key pendant" },
  ],
};

function normalize(text) {
  return String(text || "").toLocaleLowerCase("fr-FR");
}

function getCharacterBible(theme, series) {
  const cast = series?.characters || DEFAULT_CAST[theme] || [];
  return cast.map((character, index) => ({
    id: character.id || normalize(character.name).replace(/[^a-z0-9]+/g, "-") || `character-${index + 1}`,
    name: character.name || character.id || `Character ${index + 1}`,
    traits: character.traits || character.visual_description || character.description || "consistent original character design",
  }));
}

function charactersInSegment(segment, bible) {
  const text = normalize(`${segment.audio_texte} ${segment.prompt_visuel}`);
  const found = bible.filter((character) => text.includes(normalize(character.name)) || text.includes(normalize(character.id)));
  // Une scène sans nom garde le protagoniste comme point d'ancrage visuel.
  return found.length ? found : bible.slice(0, 1);
}

function characterPrompt(segment, bible) {
  const cast = charactersInSegment(segment, bible);
  if (!cast.length) return "";
  return `CHARACTER LOCK (do not alter across scenes): ${cast.map((c) => `${c.name}: ${c.traits}`).join("; ")}. Same face, proportions, colors, clothing and signature accessories as the reference image.`;
}

function enrichSegmentsWithCharacters(segments, bible) {
  return segments.map((segment) => {
    const cast = charactersInSegment(segment, bible);
    return {
      ...segment,
      character_ids: cast.map((c) => c.id),
      character_lock: characterPrompt(segment, bible),
    };
  });
}

module.exports = { DEFAULT_CAST, getCharacterBible, charactersInSegment, characterPrompt, enrichSegmentsWithCharacters };
