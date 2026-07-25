/**
 * CONTINUITY ENGINE — raccords visuels entre clips 5–10 secondes.
 * Chaque scène transporte l'état narratif et sa référence image précédente.
 */
"use strict";

const SHOTS = ["wide establishing shot", "medium tracking shot", "close-up reaction", "over-the-shoulder shot", "low-angle detail shot"];

function clipDuration(segment) {
  const words = String(segment.audio_texte || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(5, Math.min(10, Math.ceil(words / 2.4)));
}

function enrichSegmentsWithContinuity(segments) {
  return segments.map((segment, index) => ({
    ...segment,
    continuity: {
      scene_number: index + 1,
      duration_seconds: clipDuration(segment),
      shot: SHOTS[index % SHOTS.length],
      transition_from_previous: index === 0 ? "cold open" : "match cut preserving characters, location, lighting and props",
      reference_image: index === 0 ? null : `images/reference_${String(index).padStart(3, "0")}.jpg`,
      state_note: index === 0
        ? "Introduce the exact canonical character design and key prop."
        : "Continue directly from the previous scene: preserve the last character positions, dominant light, key prop and emotional state before advancing the action.",
    },
  }));
}

function continuityPrompt(segment) {
  const c = segment.continuity || {};
  return `CONTINUITY LOCK: scene ${c.scene_number || segment.id}; ${c.state_note || "preserve continuity"} Shot: ${c.shot || "cinematic shot"}. ${c.transition_from_previous || "clean cut"}.`;
}

function validateContinuity(segments) {
  const issues = [];
  segments.forEach((segment, index) => {
    const c = segment.continuity;
    if (!c) issues.push(`Scène ${index + 1}: métadonnées continuity absentes`);
    else {
      if (c.scene_number !== index + 1) issues.push(`Scène ${index + 1}: numéro de continuité invalide`);
      if (c.duration_seconds < 5 || c.duration_seconds > 10) issues.push(`Scène ${index + 1}: durée hors plage 5–10 s`);
      if (index > 0 && !c.reference_image) issues.push(`Scène ${index + 1}: image de référence absente`);
    }
  });
  return { valid: issues.length === 0, issues };
}

module.exports = { SHOTS, clipDuration, enrichSegmentsWithContinuity, continuityPrompt, validateContinuity };
