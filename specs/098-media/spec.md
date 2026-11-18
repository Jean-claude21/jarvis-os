# 098 — Médias: files and photos, ready for apps that keep them (v3 D16, D19, D21)

## Step back

A file is an entry « Fichier » like any other (D8), so every view, every app and every agent uses
it the same way. Nothing here is written for one app: a « Souvenirs », a « Garage » or a
« Recettes » app gets thumbnails, covers, versions and sharing just by having a field of type
`file`.

## What changes

1. **The file field, on screen**:
   - A field of type `file` holds one file id or a list of ids.
   - On the fiche, its files show as chips: a thumbnail for a photo, the coloured icon of its genre
     otherwise, and the name. A chip opens the file beside the page. Its ✕ takes it off the field,
     but the file stays in her documents.
   - « Envoyer » sends a file from her device and joins it (« pièce de »). « Choisir » picks a file
     she already keeps.
2. **Thumbnails and covers**:
   - A photo's thumbnail is 480 px WebP. It is made the first time it is asked for
     (`GET /files/:id?thumb=1`), then kept beside the photo at `<key>.thumb.webp`.
   - A gallery never loads full images.
   - Thumbnails appear in Cards (as a cover, the first photo of its file fields), in the files'
     grid and list, and in the attached files of a fiche.
   - Cards are offered for any kind with a file field, not only for people.
3. **What a photo says of itself**:
   - When a photo is kept, Jarvis reads in it:
     - `pris_le`: the hour the camera wrote, in her local time, not moved to another zone;
     - `lieu`: `{ lat, lng }`;
     - `largeur` and `hauteur`.
   - Fichier gains the facets « dated » (on `pris_le`) and « place » (on `lieu`). So photos come
     in the calendar, the timeline and the map with no extra code.
   - The place opens on OpenStreetMap.
   - It is all read on her server; nothing leaves Jarvis.
4. **The same bytes once**:
   - Each file has its SHA-256 (`empreinte`).
   - The same bytes sent again are the file she already has. It is joined where the new one was
     going, and Jarvis answers `duplicate: true`.
   - A large file is printed in the browser first, so its bytes are not even sent.
5. **Large files in parts**:
   - Up to 20 MB, a file goes in one request. Beyond that, up to 500 MB (a video, a long scan), the
     screen sends it in 8 MB parts straight to storage, in this order:
     - `POST /files/uploads` starts it;
     - `PUT /files/uploads/part` sends each part;
     - `POST /files/uploads/complete` finishes it;
     - `POST /files/uploads/abort` cancels it if a part fails.
   - The storage key is made by Jarvis under her space; no other key is accepted.
   - Dropping anywhere, « Joindre » and « Déposer » all use this path.
6. **Versions**:
   - « Remplacer » on a file's fiche makes the new bytes the file: its entry, links and history
     stay.
   - The old bytes are kept as a version (`data.versions`, twenty at most; beyond that the oldest
     bytes go). Each version opens again (`GET /files/:id/versions/:n`).
   - The file is read again.
7. **Erased for good**:
   - « Supprimer définitivement » first says what will go and that it cannot be undone. Only after
     her yes are the bytes, the versions and the thumbnail removed from storage.
   - Then the file's row is gone, and its entry is set aside and marked « effacé ». The journal
     keeps that it existed.
   - Migration 0033 grants the application `delete` on `file`; the policy `file_drop` (0011)
     already says who may.
8. **Shared for a day**: « Lien de partage (24 h) » makes a signed link to the file and copies it.
9. **Google Drive in Documents**:
   - With the « drive.file » right, Jarvis sees only the files it put in her Drive or that she
     opened with it, never her whole Drive.
   - Documents lists them, each with « Importer ». A Google document comes in as PDF. An imported
     file is kept, read and linked like any file.
   - On a file's fiche, « Envoyer vers Drive » puts it in her Drive.
   - When Drive is not connected, Documents shows one line pointing to Réglages › Connexions.

## Left for later

- Transcription of a voice note or a video goes through the Service (F8).
- Converting HEIC for every browser.
- Thumbnails of PDFs and videos.

## Checked

- Core tests (`tests/media.test.ts`) cover four cases:
  - a duplicate is the same file and gets the new link;
  - a replace keeps v1;
  - erasing removes the bytes, the versions and the thumbnail, and the file row is gone;
  - a file sent in parts is kept.
- Real run on a quiet server (side effects off, storage under `next/`), at 1440, 1024 and 390:
  - a photo gives its date (18:30 as written) and its place;
  - its thumbnail is a WebP;
  - the same photo sent again is the same file;
  - 30 MB goes in 4 parts and reads back identical;
  - v1 reads back after a replace;
  - the share link works for 24 h;
  - erasing asks first, then the file answers 404;
  - the Cards cover and the files' grid show thumbnails;
  - no page overflows.
- Not checked: Google Drive. It needs her Google sign-in and the redirect addresses in the Google
  console.
