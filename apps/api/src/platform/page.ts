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

// Her web account (spec 009): one page, no build step, in the Kete brand — a sidebar of what she
// keeps (home, life, documents, dashboards, reminders, journal) and of her settings (spaces,
// connections, data, account). It reads and acts through `/api` with her session, like any door.
// Dashboards and documents reuse the views of the clients, framed (`/app/frame/…`).

// The script is cut by what it draws (`./client`) and joined here in the order it runs: the ground,
// the views, the Entries page, the pages, what they do, then the router that starts it all.
const script = [base, views, entries, dayPages, lifePages, settingsPages, bind, router].join(
  '\n\n',
);

const escape = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** Her web account: the shell; every page is drawn by the script from `/api`. */
export function appPage(lang: Lang): string {
  const words = appWords[lang];
  const link = (hash: string, key: keyof typeof words, icon: string) =>
    `<a class="navi" href="#/${hash}" data-page="${key}">${icon}<span>${escape(words[key])}</span></a>`;
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(words.brand)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700&family=Instrument+Sans:wght@400;600&family=JetBrains+Mono:wght@600&display=swap">
<style>${brandCss}${appCss}</style></head>
<body><div class="shell">
<aside class="sidebar">
  <div class="brand"><i>J</i><select id="space" aria-label="${escape(words.space)}"></select></div>
  <input class="search-box" id="search" type="search" placeholder="${escape(words.search)}">
  <nav class="navg"><div class="caps">${escape(words.navDaily)}</div>
    ${link('', 'navNow', ICONS.now)}
    ${link('agenda', 'navAgenda', ICONS.agenda)}
    ${link('rappels', 'navReminders', ICONS.reminders)}
  </nav>
  <nav class="navg" id="apps"></nav>
  <nav class="navg"><div class="caps">${escape(words.navLife)}</div>
    ${link('collections', 'navCollections', ICONS.life)}
    ${link('vie', 'navEntries', ICONS.life)}
    ${link('documents', 'navDocuments', ICONS.documents)}
    ${link('fichiers', 'navFiles', ICONS.files)}
    ${link('tableaux', 'navDashboards', ICONS.dashboards)}
  </nav>
  <div class="profile">
    <details><summary class="navi">${ICONS.more}<span>${escape(words.navSettings)}</span></summary>
      <div class="more">
        ${link('journal', 'navJournal', ICONS.journal)}
        ${link('espaces', 'navSpaces', ICONS.spaces)}
        ${link('connexions', 'navConnections', ICONS.connections)}
        ${link('donnees', 'navData', ICONS.data)}
        ${link('compte', 'navAccount', ICONS.account)}
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
<aside class="drawer" id="drawer" role="dialog" aria-modal="true"></aside>
<div class="toast" id="toast" role="status"><span id="toast-text"></span><button id="toast-undo">${escape(words.undo)}</button></div>
<script>
const LANG = ${JSON.stringify(lang)};
const WORDS = ${JSON.stringify(words)};
const ICON_PLUS = ${JSON.stringify(ICONS.plus)};
${script}
</script></body></html>`;
}
