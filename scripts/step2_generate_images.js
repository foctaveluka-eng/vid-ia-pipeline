/**
 * ÉTAPE 2 — Wrapper legacy pour rétrocompatibilité
 * Redirige vers la nouvelle génération pro vidéo avec audio intégré.
 * L'ancien système séparait images et audio, le nouveau les fusionne.
 * @deprecated Utilisez step2_generate_videos.js
 */
"use strict";
console.log("ℹ️ step2_generate_images.js est déprécié — redirige vers step2_generate_videos.js (système pro vidéo+audio intégré)");
require("./step2_generate_videos.js");
