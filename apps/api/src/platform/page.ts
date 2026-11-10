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
  bind,
  router,
].join('\n\n');

const escape = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** Her web account: the shell; every page is drawn by the script from `/api`. */
export function appPage(lang: Lang): string {
  const words = appWords[lang];
  const link = (hash: string, key: keyof typeof words, icon: string, count = '') =>
    `<a class="navi" href="#/${hash}" data-page="${key}">${icon}<span>${escape(words[key])}</span>${count}</a>`;
  // The mockup's icons (its sprite), for the screens of plan v2.
  const use = (id: string) => `<svg class="i"><use href="#${id}"/></svg>`;
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(words.brand)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700&family=Instrument+Sans:wght@400;600&family=JetBrains+Mono:wght@600&display=swap">
<style>${brandCss}${appCss}${v2Css}
svg.i { width: 16px; height: 16px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
button.navi { width: 100%; background: none; font: inherit; cursor: pointer; text-align: left; }</style></head>
<body><div class="shell">
<aside class="sidebar">
  <div class="brand"><i>J</i><select id="space" aria-label="${escape(words.space)}"></select></div>
  <input class="search-box" id="search" type="search" placeholder="${escape(words.search)}">
  <nav class="navg"><div class="caps">${escape(words.navDaily)}</div>
    ${link('', 'navNow', ICONS.now)}
    ${link('agenda', 'navAgenda', ICONS.agenda)}
    ${link('ranger', 'navToSort', use('i-box'), '<span class="n hot" id="n-ranger" hidden></span>')}
    ${link('revue', 'navReview', use('i-eye'))}
  </nav>
  <nav class="navg"><div class="caps">${escape(words.navLife)}</div>
    ${link('personnes', 'navPeople', use('i-person'))}
    ${link('vie', 'navEntries', ICONS.life)}
    ${link('documents', 'navDocuments', ICONS.documents)}
    ${link('fichiers', 'navFiles', ICONS.files)}
    ${link('tableaux', 'navDashboards', ICONS.dashboards)}
  </nav>
  <nav class="navg" id="apps"></nav>
  <nav class="navg" id="spaces-nav"></nav>
  <div class="profile">
    <details><summary class="navi">${ICONS.more}<span>${escape(words.navSettings)}</span></summary>
      <div class="more">
        ${link('journal', 'navJournal', ICONS.journal)}
        ${link('rappels', 'navReminders', ICONS.reminders)}
        ${link('collections', 'navModels', use('i-shape'))}
        ${link('espaces', 'navSpaces', ICONS.spaces)}
        ${link('connexions', 'navConnections', ICONS.connections)}
        ${link('donnees', 'navData', ICONS.data)}
        ${link('compte', 'navAccount', ICONS.account)}
        <button class="navi" id="theme" type="button">${use('i-moon')}<span>${escape(words.navTheme)}</span></button>
      </div>
    </details>
    <div class="who" id="who"></div>
  </div>
</aside>
<div class="frame">
  <header class="topbar">
    <button class="quiet" id="menu" aria-label="${escape(words.menu)}">☰</button>
    <h1 id="title"></h1>
    <span class="chip-now" id="clock"></span>
  </header>
  <main class="page" id="page"><p class="empty">${escape(words.loading)}</p></main>
</div>
</div>
<nav class="x-tabbar" aria-label="${escape(words.navDaily)}">
  <a href="#/" data-tab="">${use('i-now')}${escape(words.navNow)}</a>
  <a href="#/agenda" data-tab="agenda">${use('i-cal')}${escape(words.navAgenda)}</a>
  <button class="fab" id="note" type="button" aria-label="${escape(words.navNote)}">${use('i-plus')}</button>
  <a href="#/ranger" data-tab="ranger">${use('i-box')}${escape(words.navToSort)}<span class="n" id="tab-ranger" style="display:none"></span></a>
  <button type="button" id="tab-menu">${use('i-menu')}${escape(words.navMenu)}</button>
</nav>
${SPRITE}
<aside class="drawer" id="drawer" role="dialog" aria-modal="true"></aside>
<div class="toast" id="toast" role="status"><span id="toast-text"></span><button id="toast-undo">${escape(words.undo)}</button></div>
<script>
const LANG = ${JSON.stringify(lang)};
const WORDS = ${JSON.stringify(words)};
const ICON_PLUS = ${JSON.stringify(ICONS.plus)};
${script}
</script></body></html>`;
}
