# 062 — Tick what she has seen, pause a source

## Why

She goes through the offers found each morning and ticks each one: worth a closer look, applied,
or set aside. Some sites block robots or need her account: she still wants them listed with their
link, to open herself, without the morning reading failing on them.

## What

- A `task_list` block may offer several gestures: `action` first, then up to three `more`
  (`{ label, set }`). The computed block gives them all in `actions`; each entry shows one button
  per gesture, and a click sets that gesture's fields. Pages with one `action` are unchanged.
- Candidatures:
  - « Source » gains `active` (« Parcourue chaque matin », yes by default). A source on pause is
    sent along but never read by the Atelier (`parcourir` skips `active: false`).
  - « Nouvelles offres qui correspondent » ticks each offer: « À creuser », « Postulé », « Écarter ».
  - « Où je cherche » shows each source's address, whether it is read, and its notes.

## Done when

- A page computes a task list's gestures in order, and both views set the chosen one's fields.
- A paused source is not read; the others are.
