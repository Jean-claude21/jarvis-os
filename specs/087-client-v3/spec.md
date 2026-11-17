# 087 — The v3 client: its frame (v3 D17)

## What changes

1. **`apps/web`**: React 19, Vite, TanStack Router (the URL holds where she is: back, forth and a
   clickable breadcrumb — the old I15) and TanStack Query; Tailwind v4 with the mockup's tokens
   (light and dark); Radix primitives copied in `src/ui`; Lucide icons; cmdk. No library from a
   CDN: the build is served by the API.
2. **Served at `/v3`** behind her session (`/v3/assets/*` cached for good, the page never). Where
   `JARVIS_HOME=/v3` (next), home and `/app` lead to it; the v2 stays at `/app?v2`.
3. **The frame**: the sidebar — the space she looks at on top (a menu of her spaces), Chercher
   (Ctrl K), « Vivre » (Aujourd'hui, Agenda, Documents, Personnes, Argent, Activité, À valider, Mes
   apps), her apps, her spaces again at the bottom, Atelier, Réglages, her account; a drawer on a
   phone. The top bar: the breadcrumb, and « EN DIRECT » while the journal stream is open.
4. **First screens on real data**: Aujourd'hui (four figures, what waits for her by group, her day,
   what Jarvis and she did), Activité (by day, who and how, new lines lit as they arrive, undo),
   Mes apps and an app (its kinds and their facets), an entry (its values and its history). The
   other screens say which step brings them.
5. **Live**: one EventSource on `/api/live`; each change refreshes what may show it.

## Proof

1440, 1024 and 390 px without overflow; Ctrl K finds an offer and opens it; back returns home.
