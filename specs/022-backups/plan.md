# Implementation Plan: Her life kept each night, and given back

**Branch**: `022-backups` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

## Summary

The watcher exports each space each night into the storage; a nightly GitHub workflow keeps the
production database as a Neon branch; one command restores a branch from a backup.

## Technical Context

- Migration `0017_space_backup.sql`: table `space_backup` (members' policy), function
  `jarvis_backup_due(day, max)` (security definer: the spaces without their backup, and a member).
- `packages/core/src/backups.ts`; `apps/api/src/backups.ts` (`backupSpace`, `backupOnce`, three
  spaces a pass); `Blobs.remove` for the backups past thirty days; `GET /api/backups`,
  `GET /api/backups/:day/link`.
- `tooling/backup.ts` (`pnpm backup`, `pnpm backup restore`); `.github/workflows/backup.yml`, which
  runs only once the secret `NEON_API_KEY` is set.

## Constitution Check

| Principle      | How this plan keeps it                                                                  |
| -------------- | --------------------------------------------------------------------------------------- |
| I. Simple      | Her own export, kept each night; Neon branches for the database; no dump format.        |
| IV. Hers alone | A backup is made as a member and read by members only.                                  |
| V. Trust       | A restore is a dry run by default and keeps the state before.                           |
| VII. Proof     | Due then made, forgotten after thirty days, opened through her account; a real restore. |
