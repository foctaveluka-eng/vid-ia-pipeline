/** Génère une démo locale légère sans API ni secrets dans demo_output/. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync, execSync } = require("child_process");
const { enrichSegmentsWithContinuity } = require("./continuity_engine");
const { getCharacterBible, enrichSegmentsWithCharacters } = require("./character_engine");

function getFFmpeg() {
  try { execSync("ffmpeg -version", { stdio: "ignore" }); return "ffmpeg"; } catch {}
  try { return require("@ffmpeg-installer/ffmpeg").path; } catch {}
  throw new Error("FFmpeg introuvable. Installez ffmpeg ou npm install.");
}
const ffmpeg = getFFmpeg();
const out = path.resolve("demo_output");
fs.mkdirSync(out, { recursive: true });
const scenes = enrichSegmentsWithContinuity(enrichSegmentsWithCharacters([
  { id: 1, audio_texte: "Chut ! Pomme a trouvé une lumière sous le grand chêne.", prompt_visuel: "Pomme discovers a glowing seed" },
  { id: 2, audio_texte: "Orange arrive, mais la graine montre le chemin secret.", prompt_visuel: "Orange follows the glowing seed" },
  { id: 3, audio_texte: "Et toi, ouvrirais-tu cette porte magique ?", prompt_visuel: "friends face a magical door" },
], getCharacterBible("dessin_anime")));
const colors = ["0xF6A623", "0x4A90E2", "0x7ED321"];
for (const [index, scene] of scenes.entries()) {
  const file = path.join(out, `clip_${String(index + 1).padStart(3, "0")}.mp4`);
  execFileSync(ffmpeg, ["-y", "-f", "lavfi", "-i", `color=c=${colors[index]}:s=360x640:r=30:d=${scene.continuity.duration_seconds}`, "-f", "lavfi", "-i", `sine=frequency=${440 + index * 110}:sample_rate=44100:duration=${scene.continuity.duration_seconds}`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", file], { stdio: "ignore" });
}
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify({ generated_at: new Date().toISOString(), note: "Démo locale: clips 5–10 s avec audio de démonstration, sans contenu IA ni voix.", scenes }, null, 2));
console.log(`✅ Démo générée: ${out}`);
