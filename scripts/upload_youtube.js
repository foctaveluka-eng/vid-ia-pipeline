/**
 * ÉTAPE 7 — Publication de la Vidéo sur YouTube
 *
 * Variables d'environnement requises (GitHub Secrets) :
 *   GOOGLE_CLIENT_ID     — ID Client OAuth
 *   GOOGLE_CLIENT_SECRET — Secret Client OAuth
 *   GOOGLE_REFRESH_TOKEN — Refresh Token permanent (avec scope youtube.upload)
 */

"use strict";

const fs = require("fs");
const { google } = require("googleapis");

async function main() {
  // 1. Vérification des variables d'environnement
  const requiredEnv = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REFRESH_TOKEN",
  ];

  for (const envVar of requiredEnv) {
    if (!process.env[envVar]) {
      console.error(`❌ Variable d'environnement manquante : ${envVar}`);
      process.exit(1);
    }
  }

  // 2. Lecture des métadonnées
  if (!fs.existsSync("./tmp_data/metadata.json")) {
    console.error("❌ Fichier metadata.json manquant.");
    process.exit(1);
  }

  const metadata = JSON.parse(
    fs.readFileSync("./tmp_data/metadata.json", "utf-8")
  );

  const videoPath = "./tmp_data/video_finale.mp4";

  if (!fs.existsSync(videoPath)) {
    console.error(`❌ Fichier vidéo introuvable : ${videoPath}`);
    process.exit(1);
  }

  const videoStats = fs.statSync(videoPath);
  console.log(`📤 Publication sur YouTube...`);
  console.log(`   Titre    : ${metadata.title}`);
  console.log(`   Hashtags : ${metadata.hashtags}`);
  console.log(`   Taille   : ${(videoStats.size / (1024 * 1024)).toFixed(2)} Mo`);

  // 3. Authentification OAuth2
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  const youtube = google.youtube({ version: "v3", auth: oauth2Client });

  // 4. Description complète avec hashtags
  const description = `${metadata.title}

${metadata.hashtags}

Généré automatiquement par Vid IA Pipeline 🤖`;

  // 5. Catégories YouTube par thème (nouveaux formats + compat anciens)
  const categoryIds = {
    dessin_anime: "1",  // Film & Animation
    manga: "1",         // Film & Animation
    actualites: "25",   // News & Politics
    horreur: "24",      // Entertainment
    // rétro-compatibilité
    ia: "28",
    monde: "25",
    reportage: "25",
  };
  const categoryId = categoryIds[metadata.theme] || "22"; // 22 = People & Blogs

  // 6. Upload YouTube
  try {
    const response = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: metadata.title,
          description: description,
          tags: metadata.hashtags
            .split(" ")
            .map((h) => h.replace("#", ""))
            .filter(Boolean),
          categoryId: categoryId,
          defaultLanguage: "fr",
          defaultAudioLanguage: "fr",
        },
        status: {
          privacyStatus: "public", // "public" | "unlisted" | "private"
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        body: fs.createReadStream(videoPath),
      },
    });

    console.log(`\n🎉 Vidéo publiée sur YouTube avec succès !`);
    console.log(`   ID YouTube : ${response.data.id}`);
    console.log(`   URL        : https://www.youtube.com/watch?v=${response.data.id}`);
    console.log(`   Titre      : ${response.data.snippet?.title}`);
    console.log(`   Statut     : ${response.data.status?.privacyStatus}`);
  } catch (err) {
    console.error("❌ Erreur lors de la publication YouTube :", err.message);
    if (err.response) {
      console.error("   Détails :", JSON.stringify(err.response.data, null, 2));
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Erreur fatale :", err.message);
  process.exit(1);
});
