# Feature Specification: Her files, read

**Feature Branch**: `028-reading` (spec 026)

**Created**: 2026-11-09

**Status**: Draft

**Input**: Plan v2, item S7 (reading files: the text of PDFs, photos read (OCR), previews), in the
plan's order.

## What is missing

Only text files are read: a PDF invoice, a Word lease or the photo of a receipt are kept, but `find`
and her assistants cannot reach what they say.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Her documents and photos, read (Priority: P1)

1. A PDF, a Word document (.docx) or a photo (JPEG, PNG, WebP) she gives is kept at once; its words
   are read just after, by the watcher, a few files each pass.
2. Then `find` (the app's search, Claude's tool) reaches them: the reference on an invoice, the
   name of a medicine on a receipt.
3. A file that cannot be read says why, once; a photo without writing has nothing to read.

**Proof**: a PDF and a Word document built by the test are uploaded, read by a pass of the watcher,
then found by their words; a broken PDF is not tried again. Tried by hand: the photo of a receipt,
drawn in the browser, uploaded, read, then found by the app's search.

## Requirements

- **FR-001** Reading never slows an upload: it happens in the watcher (`read_state` pending → read,
  none or failed).
- **FR-002** Up to 200 000 characters of a read document are kept for `find`.
- **FR-003** Photos are read in French and English (tesseract.js, its language data cached).
- **FR-004** Previews of files belong to the Files screen (plan v2, I5).
- **FR-005** A scanned PDF (images only) is not read yet: it needs a page drawn as an image first.
