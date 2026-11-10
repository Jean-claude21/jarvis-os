import type { Lang } from '../i18n';
import { brandCss } from '../views/base';
import { appWords } from './words';
import { appCss } from './client/styles';
import { ICONS } from './client/icons';
import { base } from './client/base';
import { views } from './client/views';
import { entries } from './client/entries';
import { dayPages } from './client/pages-day';
import { lifePages } from './client/pages-life';
import { settingsPages } from './client/pages-settings';
import { bind } from './client/bind';
import { router } from './client/router';
import { v2Pages } from './client/pages-v2';
import { v2Agenda } from './client/pages-v2-agenda';
import { v2Entry } from './client/pages-v2-entry';
import { v2Apps } from './client/pages-v2-apps';
import { v2Life } from './client/pages-v2-life';
import { v2Routines } from './client/pages-v2-routines';
import { v2Css } from './client/styles-v2';
import { SPRITE } from './client/sprite';

// Her web account (spec 009): one page, no build step, in the Kete brand — a sidebar of what she
// keeps (home, life, documents, dashboards, reminders, journal) and of her settings (spaces,
// connections, data, account). It reads and acts through `/api` with her session, like any door.
// Dashboards and documents reuse the views of the clients, framed (`/app/frame/…`).

// The script is cut by what it draws (`./client`) and joined here in the order it runs: the ground,
// the views, the Entries page, the pages, what they do, then the router that starts it all.
const script = [
  base,
  views,
  entries,
  dayPages,
  lifePages,
  settingsPages,
  v2Pages,
  v2Agenda,
  v2Entry,
  v2Apps,
  v2Life,
  v2Routines,
  bind,
  router,
].join('\n\n');

const escape = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** Her web account: the shell; every page is drawn by the script from `/api`. */
export function appPage(lang: Lang): string {
  const words = appWords[lang];
  // The mockup's icons (its sprite).
  const use = (id: string) => `<svg class="i"><use href="#${id}"/></svg>`;
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(words.brand)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap">
<style>${brandCss}${appCss}${v2Css}
svg.i { width: 16px; height: 16px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.v2 #space-menu { position: absolute; top: 58px; left: 12px; right: 12px; z-index: 30; }
.v2 .side { position: relative; }
.v2 .chip-now::before { content: none; display: none; }
.page.v2 > * { flex-shrink: 0; }
.v2 .hbar .track { top: auto; left: auto; right: auto; }
.v2 .panel svg.chart { max-height: 220px; width: 100%; }</style></head>
<body class="v2">
<div class="app">
  <aside class="side" id="side">
    <button class="switcher" id="switcher" type="button" aria-haspopup="menu" title="${escape(words.space)}">
      <span class="logo">J</span><span><b>${escape(words.brand)}</b><small id="space-name"></small></span>${use('i-updown')}
    </button>
    <div class="menu" id="space-menu" role="menu"></div>
    <label class="search">${use('i-search')}<input id="search" placeholder="${escape(words.v2searchOrNote)}" aria-label="${escape(words.v2searchOrNote)}" autocomplete="off"><span class="kbd">Ctrl K</span></label>
    <nav id="nav"></nav>
    <div class="grow"></div>
    <div class="menu" id="me-menu" role="menu">
      <button data-go="#/collections">${use('i-shape')}${escape(words.navModels)}</button>
      <button data-go="#/connexions">${use('i-plug')}${escape(words.navConnections)}</button>
      <button data-go="#/donnees">${use('i-box')}${escape(words.navData)}</button>
      <button data-go="#/espaces">${use('i-person')}${escape(words.navSpaces)}</button>
      <button data-go="#/compte">${use('i-gear')}${escape(words.navAccount)}</button>
      <button id="theme" type="button">${use('i-moon')}${escape(words.v2themeToggle)}</button>
    </div>
    <button class="me" id="me" type="button" aria-haspopup="menu"><span class="avatar" id="me-initials"></span><span><b id="me-name"></b><small id="me-sub"></small></span>${use('i-updown')}</button>
  </aside>
  <main>
    <header class="topbar">
      <button class="icon-btn only-mobile" id="open-side" type="button" aria-label="${escape(words.menu)}">${use('i-menu')}</button>
      <div class="crumbs" id="crumbs"></div>
      <span class="chip-now mono"><span class="live"></span><span id="clock"></span></span>
      <button class="icon-btn" id="open-journal" type="button" aria-label="${escape(words.navJournal)}">${use('i-history')}</button>
      <button class="icon-btn" id="open-bell" type="button" aria-label="${escape(words.v2notifications)}">${use('i-bell')}<span class="pip" id="pip" style="display:none"></span></button>
    </header>
    <div class="page v2" id="page"><div class="empty">${escape(words.loading)}</div></div>
  </main>
</div>
<nav class="x-tabbar" aria-label="${escape(words.navDaily)}">
  <a href="#/" data-tab="">${use('i-now')}${escape(words.navNow)}</a>
  <a href="#/agenda" data-tab="agenda">${use('i-cal')}${escape(words.navAgenda)}</a>
  <button class="fab" id="note" type="button" aria-label="${escape(words.navNote)}">${use('i-plus')}</button>
  <a href="#/ranger" data-tab="ranger">${use('i-box')}${escape(words.navToSort)}<span class="n" id="tab-ranger" style="display:none"></span></a>
  <button type="button" id="tab-menu">${use('i-menu')}${escape(words.navMenu)}</button>
</nav>
${SPRITE}
<div class="scrim" id="scrim"></div>
<aside class="drawer" id="drawer" role="dialog" aria-modal="true"></aside>
<div class="toast" id="toast" role="status"><span id="toast-text"></span><button id="toast-undo">${escape(words.undo)}</button></div>
<script>
const LANG = ${JSON.stringify(lang)};
const WORDS = ${JSON.stringify(words)};
const ICON_PLUS = ${JSON.stringify(ICONS.plus)};
${script}
</script></body></html>`;
}
