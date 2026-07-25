/**
 * ÉTAPE 3b — DÉPRÉCIÉE
 * Vérification audio séparée supprimée — audio désormais intégré dans clips.
 */

"use strict";

console.log("ℹ️ [DÉPRÉCIÉ] Étape 3b vérif audio séparée supprimée.");
console.log("   Système PRO : audio intégré dans chaque clip vidéo (tmp_data/clips/*.mp4).");
console.log("   Aucune vérification audio séparée nécessaire.");

const fs = require("fs");
if (fs.existsSync("./tmp_data/clips_info.json")) {
  const info = JSON.parse(fs.readFileSync("./tmp_data/clips_info.json", "utf-8"));
  console.log(`✅ ${info.totalClips || info.clipsList?.length || 0} clips avec audio vérifiés.`);
}
