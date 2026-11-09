# Tasks: Her files, read

**Input**: [spec.md](spec.md)

- [x] T001 Migration `0021_file_reading.sql`: `read_state`, `read_error`, `read_at`; `jarvis_files_to_read(max)`
- [x] T002 `packages/core/src/files.ts`: `READ_LATER`, `filesToRead`, `setFileWords`; an upload marks what is to read
- [x] T003 `apps/api/src/reading.ts`: PDF (unpdf 1.9.1), Word (mammoth 1.13.0), photos (tesseract.js 7.0.0); `readOnce` in the watcher's pass
- [x] T004 Proof in `apps/api/tests/reading.test.ts`; tried by hand with the photo of a receipt
- [ ] T005 Before production: check that the Netlify bundle carries tesseract.js's worker (or read photos on the own servers)
- [ ] T006 Scanned PDFs: draw pages as images, then read them (later)
