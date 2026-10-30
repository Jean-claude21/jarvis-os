# Feature Specification: Type models — the shape of a kind, said once

**Feature Branch**: `012-models`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "From Claude, build complete apps — finances, routines, anything —
with fields that hold, links that mean something, and a structure the app shows clearly. The
rangement of the export must be configurable."

## The idea

Low-code tools asked a person to design tables. Here Claude designs them with her, in
conversation, and Jarvis holds them: a **model** is an entry of kind « Modèle » whose title is the
kind it describes (« Mouvement ») and whose data says its fields, their nature, what is required,
the choices, where the export puts each entry, and how the app shows the kind. Once a kind has a
model, every save of it follows — the end of « montant » one day and « prix » the next.

This is the first layer of the apps (decision in [plan.md](plan.md)): models; then relations and
computations; then pages; then rules. Each comes when a real app (Finances first) asks for it.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — A model holds (Priority: P1)

1. **Given** a « Modèle » « Mouvement » with `montant` (montant, required), `date` (date,
   required), `nature` (choix: entrée, sortie, réaffectation), **When** Claude saves a mouvement
   with `prix`, **Then** the save is refused with a sentence: « prix » is not one of its fields, its
   fields are …, and how to change the model.
2. **When** `montant` is « 500 » (text) or `date` « 30/10 », **Then** refused, saying the nature.
3. **When** `nature` is « Sortie », **Then** it passes (case and accents aside).
4. **When** a change removes a required field, **Then** refused.
5. **Given** a kind without a model, **Then** anything goes, as before.
6. Fields of time (`debut`, `quand`, `echeance`, `repete`…), `texte`, `source`, `statut` are
   allowed in every model.

### User Story 2 — A model is itself checked (Priority: P1)

1. **When** Claude saves a « Modèle » without fields, a choix without choices, a rangement outside
   her folder, or a column that is not a field, **Then** refused with the shape of a model.

### User Story 3 — Claude knows the shapes (Priority: P1)

1. `kinds` gives each kind's model, even a kind with no entry yet.
2. The routine « Les modèles » teaches how to propose a model, build an app step by step, and
   change a model.

### User Story 4 — Her export follows the rangement (Priority: P1)

1. **Given** `rangement` « finances/{année}/{mois}/{titre}.md », **Then** her export puts each
   mouvement there (the year and month from its date, else its creation). An imported entry still
   goes back to its own path.

## Requirements _(mandatory)_

- **FR-001**: No table: a model is an entry, journaled and undoable like any (constitution II).
- **FR-002**: The check lives in the core's `save`: every door follows the same models.
- **FR-003**: Refusals are sentences a model can act on, naming the fields.
- **FR-004**: `colonnes`, `total`, `regroupement` and `app` are kept for the platform (spec 013).

## Success Criteria _(mandatory)_

- **SC-001**: Her finances in Jarvis keep one shape for months, whatever the conversation.
