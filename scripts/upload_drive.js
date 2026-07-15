/**
 * ÉTAPE 6 — Upload de la Vidéo sur Google Drive
 * Adapté depuis le guide de migration (upload_drive.js)
 *
 * Variables d'environnement requises (GitHub Secrets) :
 *   GOOGLE_CLIENT_ID     — ID Client OAuth
 *   GOOGLE_CLIENT_SECRET — Secret Client OAuth
 *   GOOGLE_REFRESH_TOKEN — Refresh Token permanent
 *   DRIVE_FOLDER_ID      — ID du dossier Drive cible
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
    "DRIVE_FOLDER_ID",
  ];

  for (const envVar of requiredEnv) {
    if (!process.env[envVar]) {
      console.error(`❌ Variable d'environnement manquante : ${envVar}`);
      process.exit(1);
    }
  }

  // 2. Lecture des informations de la vidéo et des métadonnées
  if (
    !fs.existsSync("./tmp_data/video_info.json") ||
    !fs.existsSync("./tmp_data/metadata.json")
  ) {
    console.error("❌ Fichiers video_info.json ou metadata.json manquants.");
    process.exit(1);
  }

  const videoInfo = JSON.parse(
    fs.readFileSync("./tmp_data/video_info.json", "utf-8")
  );
  const metadata = JSON.parse(
    fs.readFileSync("./tmp_data/metadata.json", "utf-8")
  );

  const videoPath = "./tmp_data/video_finale.mp4";

  if (!fs.existsSync(videoPath)) {
    console.error(`❌ Fichier vidéo introuvable : ${videoPath}`);
    process.exit(1);
  }

  console.log(`📤 Upload de la vidéo sur Google Drive...`);
  console.log(`   Titre    : ${metadata.title}`);
  console.log(`   Fichier  : ${metadata.filename}.mp4`);
  console.log(`   Taille   : ${videoInfo.tailleMo} Mo`);
  console.log(`   Dossier  : ${process.env.DRIVE_FOLDER_ID}`);

  // 3. Authentification OAuth2
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  const drive = google.drive({ version: "v3", auth: oauth2Client });

  // 4. Métadonnées du fichier Drive
  const fileMetadata = {
    name: `${metadata.filename}.mp4`,
    description: `${metadata.title}\n\n${metadata.hashtags}`,
    parents: [process.env.DRIVE_FOLDER_ID],
  };

  const media = {
    mimeType: "video/mp4",
    body: fs.createReadStream(videoPath),
  };

  // 5. Upload sur Google Drive
  try {
    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id, name, webViewLink",
    });

    console.log(`\n✅ Vidéo uploadée sur Google Drive avec succès !`);
    console.log(`   ID Drive  : ${response.data.id}`);
    console.log(`   Nom       : ${response.data.name}`);
    console.log(`   Lien      : ${response.data.webViewLink}`);

    // Sauvegarde de l'ID Drive pour l'étape YouTube
    const driveResult = {
      driveFileId: response.data.id,
      driveName: response.data.name,
      driveLink: response.data.webViewLink,
    };
    fs.writeFileSync(
      "./tmp_data/drive_result.json",
      JSON.stringify(driveResult, null, 2),
      "utf-8"
    );
  } catch (err) {
    console.error("❌ Erreur lors de l'upload sur Drive :", err.message);
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
