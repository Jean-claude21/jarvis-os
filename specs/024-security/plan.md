# Implementation Plan: Who may come in, and how many tries

**Branch**: `024-security` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

## Summary

A check before an account is made (Better Auth's `user.create.before` hook), and Better Auth's own
rate limiter with database storage and the client address from Netlify's or a tunnel's header.

## Technical Context

- Migration `0018_signup.sql`: `jarvis_invited(address)` (security definer, a boolean only).
- `apps/api/src/auth.ts`: `SignUpRule`, `signUpRuleOf(env)`, `mayJoin`; `rateLimit` (storage
  « database », custom rules for sign-in and sign-up); `advanced.ipAddress.ipAddressHeaders`
  (`x-nf-client-connection-ip`, then `x-forwarded-for`). The table `rateLimit` is made by the
  accounts' migration and granted with Better Auth's tables.
- `JARVIS_RATE_LIMIT=off` for the test suite only (many accounts from one process, no address).
- The sign-in page says « on invitation » and « too many tries » in her language.

## Constitution Check

| Principle  | How this plan keeps it                                                          |
| ---------- | ------------------------------------------------------------------------------- |
| I. Simple  | Better Auth's own limiter and hook; one function in the database.               |
| V. Trust   | A refusal says why; nothing about an invitation leaks before an account exists. |
| VII. Proof | Refused, allowed, invited; the sixth try refused from one address only.         |
