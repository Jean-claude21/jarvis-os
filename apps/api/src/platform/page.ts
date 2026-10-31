import type { Lang } from '../i18n';
import { brandCss } from '../views/base';
import { appWords } from './words';

// Her web account (spec 009): one page, no build step, in the Kete brand — a sidebar of what she
// keeps (home, life, documents, dashboards, reminders, journal) and of her settings (spaces,
// connections, data, account). It reads and acts through `/api` with her session, like any door.
// Dashboards and documents reuse the views of the clients, framed (`/app/frame/…`).

const css = `
body { padding: 0; }
.app { display: grid; grid-template-columns: 248px 1fr; min-height: 100vh; }
.side { background: var(--sand); border-right: 1px solid var(--rule); padding: 18px 14px; display: flex; flex-direction: column; gap: 18px;
  position: sticky; top: 0; height: 100vh; overflow-y: auto; }
.logo { display: flex; align-items: center; gap: 10px; font: 700 17px/1 Archivo, system-ui, sans-serif; color: var(--ink); text-decoration: none; }
.logo i { width: 28px; height: 28px; background: var(--primary); color: var(--on-primary); display: grid; place-items: center;
  font: 700 15px/1 Archivo, sans-serif; font-style: normal; border-radius: 2px; }
.side select { width: 100%; font: 600 13px/1.2 "Instrument Sans", sans-serif; padding: 8px; border: 1px solid var(--rule-strong);
  border-radius: 2px; background: var(--paper); color: var(--ink); }
.nav { display: grid; gap: 2px; }
.nav a { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 2px; color: var(--ink); text-decoration: none; font-weight: 600; font-size: 14px; }
.nav a:hover { background: var(--clay); }
.nav a.on { background: var(--ink); color: var(--paper); }
.nav a svg { width: 16px; height: 16px; flex: none; }
.nav .caps { padding: 12px 10px 4px; }
.who { margin-top: auto; border-top: 1px solid var(--rule); padding-top: 12px; font-size: 13px; }
.main { min-width: 0; }
.top { display: flex; align-items: center; gap: 12px; padding: 14px 28px; border-bottom: 1px solid var(--rule); background: var(--paper);
  position: sticky; top: 0; z-index: 2; }
.top h1 { flex: 1; font-size: 18px; }
.top input { width: min(340px, 40vw); font: 14px "Instrument Sans", sans-serif; padding: 8px 10px; border: 1px solid var(--rule-strong);
  border-radius: 2px; background: var(--sand); color: var(--ink); }
#menu { display: none; }
.page { padding: 24px 28px 48px; max-width: 1180px; }
.lead { color: var(--bark); margin: -4px 0 18px; }
.kpis { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-bottom: 16px; }
.kpi-card .kpi { margin-top: 6px; }
.split { display: grid; gap: 16px; grid-template-columns: 220px 1fr; align-items: start; }
.ent { display: grid; gap: 16px; grid-template-columns: 250px minmax(0, 1fr); align-items: start; }
.ent-kinds { position: sticky; top: 76px; max-height: calc(100vh - 100px); display: flex; flex-direction: column; padding: 12px; }
.ent-kinds .kscroll { overflow-y: auto; min-height: 0; flex: 1; margin: 8px -4px 0; padding: 0 4px; }
.ent-kinds details { margin-bottom: 6px; } .ent-kinds summary { cursor: pointer; padding: 6px 4px; display: flex; justify-content: space-between; }
.ent-main { min-width: 0; padding: 14px 16px; }
.ent-scroll { max-height: calc(100vh - 250px); overflow: auto; border-top: 1px solid var(--rule); }
.ent-scroll thead th { position: sticky; top: 0; background: var(--paper); z-index: 1; }
.ent-scroll td.pick, .ent-scroll th.pick { width: 28px; }
.ent-tools { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 10px 0; }
.ent-tools .grow { flex: 1; }
.ent-tools input[type=search] { flex: 1; min-width: 160px; }
.ent-tools input, .ent-tools select, .ent-kinds input { padding: 6px 8px; border: 1px solid var(--rule-strong); border-radius: 2px; background: var(--paper); color: var(--ink); font: 13px "Instrument Sans", sans-serif; }
.ent-sel { display: none; position: sticky; top: 64px; z-index: 2; gap: 8px; align-items: center; flex-wrap: wrap; padding: 8px 10px; margin: 0 0 10px; background: var(--ink); color: var(--paper); border-radius: 2px; }
.ent-sel.on { display: flex; } .ent-sel button { padding: 5px 9px; } .ent-sel .grow { flex: 1; }
.ent tr.period td { background: var(--sand); font: 600 12px "JetBrains Mono", monospace; letter-spacing: .04em; text-transform: uppercase; color: var(--bark); }
.ent tr.period.year td { background: var(--clay); color: var(--ink); }
.ftree { padding: 4px 0; } .ftree details { margin-left: 14px; } .ftree > details { margin-left: 0; }
.ftree summary { cursor: pointer; padding: 5px 4px; display: flex; gap: 8px; align-items: center; }
.ftree summary .grow { flex: 1; } .ftree .fe { display: flex; gap: 8px; align-items: center; padding: 3px 4px 3px 22px; font-size: 14px; }
.ftree .fe a { color: var(--ink); text-decoration: none; } .ftree .fe a:hover { text-decoration: underline; }
.heat { display: grid; grid-auto-flow: column; grid-template-rows: repeat(7, 9px); gap: 2px; margin-top: 10px; }
.heat i { width: 9px; height: 9px; border-radius: 1px; background: var(--clay); }
.heat i.l1 { background: color-mix(in srgb, var(--primary) 40%, var(--clay)); } .heat i.l2 { background: color-mix(in srgb, var(--primary) 70%, var(--clay)); } .heat i.l3 { background: var(--primary); }
.heat i.today { outline: 1.5px solid var(--ink); }
.facets a { display: flex; justify-content: space-between; padding: 6px 8px; color: var(--ink); text-decoration: none; border-radius: 2px; font-size: 14px; }
.facets a:hover { background: var(--clay); } .facets a.on { background: var(--clay); font-weight: 600; }
.rows tr { cursor: pointer; } .rows tr:hover td { background: var(--sand); }
.spark { display: flex; align-items: flex-end; gap: 3px; height: 40px; margin-top: 8px; }
.spark span { flex: 1; background: var(--primary); opacity: 0.85; min-height: 2px; border-radius: 1px; }
.field-row { display: grid; grid-template-columns: minmax(110px, 30%) 1fr auto; gap: 10px; padding: 7px 0; border-bottom: 1px dotted var(--rule); align-items: baseline; }
.doc { max-width: 760px; } .doc p, .doc li { font-size: 15px; line-height: 1.65; }
.doc h1, .doc h2, .doc h3 { margin: 1.2em 0 0.5em; } .doc blockquote { border-left: 3px solid var(--primary); margin: 0 0 0.9em; padding: 2px 0 2px 14px; color: var(--bark); }
.doc pre { background: var(--sand); border: 1px solid var(--rule); padding: 10px; overflow-x: auto; } .doc .ref { color: var(--primary); }
.actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.stack { display: grid; gap: 14px; }
input.field, textarea.field { width: 100%; font: 14px "Instrument Sans", sans-serif; padding: 9px 10px; border: 1px solid var(--rule-strong);
  border-radius: 2px; background: var(--paper); color: var(--ink); }
textarea.field { min-height: 90px; font-family: "JetBrains Mono", monospace; font-size: 12px; }
code.url { font: 13px "JetBrains Mono", monospace; background: var(--clay); padding: 6px 8px; border-radius: 2px; overflow-wrap: anywhere; }
iframe.view { width: 100%; border: 1px solid var(--rule); border-radius: 2px; min-height: 420px; background: var(--paper); }
a.link { color: var(--primary); text-decoration: none; } a.link:hover { text-decoration: underline; }
@media (max-width: 860px) {
  .app { grid-template-columns: 1fr; }
  .side { position: fixed; inset: 0 auto 0 0; width: 260px; z-index: 5; transform: translateX(-100%); transition: transform .2s; }
  .app.open .side { transform: none; box-shadow: 0 0 0 100vmax rgba(0,0,0,.35); }
  #menu { display: inline-flex; }
  .top { padding: 12px 16px; } .top input { width: 42vw; }
  .page { padding: 16px; }
  .split { grid-template-columns: 1fr; }
  .ent { grid-template-columns: 1fr; } .ent-kinds { position: static; max-height: 280px; } .ent-scroll { max-height: none; }
  .field-row { grid-template-columns: 1fr; gap: 2px; }
}
`;

const css2 = `
.week-bar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 14px; }
.week-bar h2 { flex: 1; font-size: 16px; min-width: 180px; }
.week { display: grid; grid-template-columns: 46px repeat(7, minmax(0, 1fr)); border: 1px solid var(--rule); border-radius: 2px; background: var(--paper); }
.week .wh { padding: 8px 4px; text-align: center; border-bottom: 1px solid var(--rule); border-left: 1px solid var(--rule); font: 600 11px/1.3 "JetBrains Mono", monospace; color: var(--bark); text-transform: uppercase; }
.week .wh b { display: block; font-size: 16px; color: var(--ink); }
.week .wh.today b { display: inline-block; padding: 0 6px; background: var(--primary); color: var(--on-primary); border-radius: 2px; }
.week .allday { border-left: 1px solid var(--rule); border-bottom: 1px solid var(--rule); padding: 3px; display: grid; gap: 3px; align-content: start; min-height: 26px; min-width: 0; }
.week .gut { position: relative; }
.week .gut span { position: absolute; right: 6px; transform: translateY(-50%); font: 600 10px "JetBrains Mono", monospace; color: var(--bark); }
.week .col { position: relative; border-left: 1px solid var(--rule); background-image: repeating-linear-gradient(to bottom, transparent 0 39px, var(--rule) 39px 40px); }
.week .col.today { background-color: var(--sand); }
.ev { position: absolute; left: 3px; right: 3px; overflow: hidden; border-radius: 2px; padding: 3px 5px; font-size: 12px; line-height: 1.2; border: 1px solid var(--ink); background: var(--paper); color: var(--ink); text-decoration: none; }
.ev small { display: block; font: 600 10px "JetBrains Mono", monospace; color: var(--bark); }
.ev.repeated { background: var(--clay); border-color: transparent; }
.ev.moment { border-color: var(--rule-strong); }
.ev.proposed, .chip-ev.proposed { background: var(--info-surface); border: 1px dashed var(--info); color: var(--info); }
.chip-ev { display: block; border-radius: 2px; padding: 2px 5px; font-size: 11.5px; border: 1px solid var(--primary); color: var(--primary); background: var(--paper); text-decoration: none; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.chip-ev.day { border-color: var(--rule-strong); color: var(--ink); }
.nowline { position: absolute; left: 0; right: 0; height: 2px; background: var(--primary); z-index: 1; }
.days { display: none; }
.legend { display: flex; gap: 14px; flex-wrap: wrap; color: var(--bark); font-size: 12px; margin-top: 10px; }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: -1px; border: 1px solid var(--ink); }
@media (max-width: 860px) { .week { display: none; } .days { display: grid; gap: 12px; } }
`;

const css3 = `
body { background: var(--clay); }
.shell { display: grid; grid-template-columns: 252px 1fr; min-height: 100vh; padding: 12px; gap: 12px; }
.sidebar { display: flex; flex-direction: column; gap: 14px; position: sticky; top: 12px; height: calc(100vh - 24px); overflow-y: auto; padding: 2px 4px 2px 2px; }
.brand { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: var(--paper); border: 1px solid var(--rule); border-radius: 2px; }
.brand i { width: 30px; height: 30px; background: var(--primary); color: var(--on-primary); display: grid; place-items: center; font: 700 15px/1 Archivo, sans-serif; font-style: normal; border-radius: 2px; flex: none; }
.brand select { flex: 1; min-width: 0; border: 0; background: transparent; font: 600 13px/1.2 Archivo, sans-serif; color: var(--ink); padding: 2px 0; }
.sidebar .search-box { width: 100%; font: 13px "Instrument Sans", sans-serif; padding: 8px 10px; border: 1px solid var(--rule); border-radius: 2px; background: var(--paper); color: var(--ink); }
.navg { display: grid; gap: 2px; }
.navg > .caps { padding: 6px 8px 4px; font: 500 10.5px/1.4 "JetBrains Mono", monospace; letter-spacing: .06em; color: var(--rule-strong); display: flex; justify-content: space-between; }
.navi { display: flex; align-items: center; gap: 10px; padding: 7px 8px; border-radius: 2px; color: var(--ink); text-decoration: none; font-size: 14px; border: 1px solid transparent; }
.navi:hover { background: rgba(255, 253, 249, .5); }
.navi.on { background: var(--paper); border-color: var(--rule); font-weight: 600; box-shadow: 0 1px 2px rgba(42, 22, 16, .06); }
.navi svg { width: 16px; height: 16px; flex: none; }
.navi .n { margin-left: auto; font: 500 11px/1 "JetBrains Mono", monospace; color: var(--bark); }
.navi .n.hot { background: var(--primary); color: var(--on-primary); padding: 3px 6px; border-radius: 2px; }
.navi .app-dot { width: 18px; height: 18px; border-radius: 2px; background: var(--primary); color: var(--on-primary); display: grid; place-items: center; font: 700 10px/1 Archivo, sans-serif; flex: none; }
.navi.ghost { color: var(--bark); border: 1px dashed var(--rule-strong); }
.profile { margin-top: auto; display: grid; gap: 6px; }
.profile .who { border: 1px solid var(--rule); background: var(--paper); border-radius: 2px; padding: 9px 10px; font-size: 13px; margin: 0; }
.profile details summary { list-style: none; cursor: pointer; }
.profile details summary::-webkit-details-marker { display: none; }
.profile .more { display: grid; gap: 2px; padding: 4px; background: var(--paper); border: 1px solid var(--rule); border-radius: 2px; margin-bottom: 6px; }
.frame { background: var(--paper); border: 1px solid var(--rule); border-radius: 2px; min-width: 0; display: flex; flex-direction: column; }
.topbar { display: flex; align-items: center; gap: 10px; padding: 10px 18px; border-bottom: 1px solid var(--rule); position: sticky; top: 0; background: var(--paper); z-index: 2; }
.topbar h1 { flex: 1; font-size: 17px; }
.chip-now { display: inline-flex; align-items: center; gap: 8px; padding: 4px 10px; border: 1px solid var(--rule); border-radius: 999px; background: var(--sand); font: 500 12px "JetBrains Mono", monospace; white-space: nowrap; }
.chip-now::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--success); }
.page { max-width: none; padding: 20px 24px 40px; }
.board { display: grid; grid-template-columns: minmax(280px, 340px) 1fr; gap: 16px; align-items: start; }
.pane { background: var(--sand); border: 1px solid var(--rule); border-radius: 2px; min-width: 0; }
.pane > .ph { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 9px 12px; font: 500 11px/1.4 "JetBrains Mono", monospace; letter-spacing: .06em; text-transform: uppercase; color: var(--bark); }
.pane > .pb { background: var(--paper); border-top: 1px solid var(--rule); padding: 6px; }
.pane > .pb.pad { padding: 14px 16px; }
.gt { padding: 12px 8px 6px; font: 500 10.5px/1.4 "JetBrains Mono", monospace; letter-spacing: .06em; text-transform: uppercase; color: var(--bark); }
.row { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; width: 100%; text-align: left; padding: 8px; border: 1px solid transparent; border-radius: 2px; background: none; color: var(--ink); cursor: pointer; font: inherit; }
.row:hover { background: var(--sand); }
.row.on { border-color: var(--ink); box-shadow: 0 1px 2px rgba(42, 22, 16, .08); }
.row .t { font-weight: 600; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.row .s { color: var(--bark); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.row > span { min-width: 0; }
.tag { display: inline-flex; align-items: center; gap: 6px; padding: 2px 7px; border-radius: 2px; font: 500 11.5px/1.4 "JetBrains Mono", monospace; white-space: nowrap; background: var(--clay); color: var(--bark); }
.tag.fix { background: var(--error-surface); color: var(--error); }
.tag.late { background: var(--verify-surface); color: var(--verify); }
.tag.proposed { background: var(--info-surface); color: var(--info); }
.detail { display: grid; gap: 16px; min-width: 0; }
.subject h2 { font-size: 19px; margin: 2px 0 4px; }
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chip { display: inline-flex; gap: 6px; align-items: center; padding: 3px 8px; border: 1px solid var(--rule); border-radius: 2px; font-size: 12.5px; text-decoration: none; color: var(--ink); background: var(--paper); }
.chip small { color: var(--bark); font: 500 11px "JetBrains Mono", monospace; }
.dayband { position: relative; height: 70px; margin: 6px 4px 4px; }
.dayband .hrs { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(17, 1fr); }
.dayband .hrs span { border-left: 1px dotted var(--rule); font: 500 10px "JetBrains Mono", monospace; color: var(--bark); padding-left: 3px; }
.dayband .blk { position: absolute; top: 18px; height: 44px; border-radius: 2px; padding: 4px 6px; overflow: hidden; font-size: 11.5px; line-height: 1.2; border: 1px solid var(--rule-strong); background: var(--sand); color: var(--ink); text-decoration: none; }
.dayband .blk.ev { background: var(--paper); border-color: var(--ink); }
.dayband .blk.proposed { background: var(--info-surface); border: 1px dashed var(--info); color: var(--info); }
.dayband .blk.focus { box-shadow: 0 0 0 2px var(--primary); }
.dayband .nowl { position: absolute; top: 10px; bottom: 0; width: 2px; background: var(--primary); }
.choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.choice { border: 1px solid var(--rule); border-radius: 2px; padding: 12px 14px; display: grid; gap: 8px; background: var(--paper); align-content: start; }
.choice.main { border: 1.5px solid var(--ink); }
.choice p { margin: 0; color: var(--bark); font-size: 13px; }
.drawer { position: fixed; top: 12px; right: 12px; bottom: 12px; width: min(440px, calc(100vw - 24px)); background: var(--paper); border: 1px solid var(--rule); border-radius: 2px; z-index: 20; transform: translateX(calc(100% + 24px)); transition: transform .2s; display: flex; flex-direction: column; box-shadow: 0 4px 24px rgba(0, 0, 0, .15); }
.drawer.open { transform: none; }
.drawer .dh { display: flex; justify-content: space-between; gap: 10px; align-items: center; padding: 14px 16px; border-bottom: 1px solid var(--rule); }
.drawer .db { padding: 16px; overflow-y: auto; display: grid; gap: 12px; align-content: start; flex: 1; }
.drawer .df { padding: 12px 16px; border-top: 1px solid var(--rule); display: flex; gap: 8px; }
.drawer img, .drawer iframe { width: 100%; border: 1px solid var(--rule); border-radius: 2px; background: var(--sand); }
.drawer iframe { height: 60vh; }
.drawer pre { background: var(--sand); border: 1px solid var(--rule); padding: 10px; max-height: 50vh; overflow: auto; font-size: 12px; }
.form-field { display: grid; gap: 4px; }
.form-field label { font: 500 11px "JetBrains Mono", monospace; letter-spacing: .05em; text-transform: uppercase; color: var(--bark); }
.form-field input, .form-field select { font: 14px "Instrument Sans", sans-serif; padding: 8px 10px; border: 1px solid var(--rule-strong); border-radius: 2px; background: var(--paper); color: var(--ink); }
.toast { position: fixed; left: 50%; bottom: 20px; transform: translate(-50%, 120px); opacity: 0; transition: .2s; background: var(--ink); color: var(--paper); padding: 10px 14px; border-radius: 2px; display: flex; gap: 14px; align-items: center; z-index: 30; font-size: 13px; max-width: calc(100vw - 32px); }
.toast.show { transform: translate(-50%, 0); opacity: 1; }
.toast button { background: none; border: 0; color: inherit; font-weight: 600; text-decoration: underline; cursor: pointer; padding: 0; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; margin: 6px 0 14px; }
.kpi-card { background: var(--paper); border: 1px solid var(--rule); border-radius: 2px; padding: 12px 14px; min-width: 0; }
.kpi-card .kpi { margin-top: 6px; } .kpi-card small { font-size: 13px; color: var(--bark); }
.stack { display: flex; height: 10px; gap: 2px; margin-top: 10px; border-radius: 1px; overflow: hidden; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 12px; margin-top: 8px; font-size: 12px; color: var(--bark); }
.legend i { display: inline-block; width: 9px; height: 9px; border-radius: 1px; margin-right: 4px; vertical-align: -1px; }
.kpi-card .spark { display: flex; align-items: flex-end; gap: 3px; height: 38px; margin-top: 10px; }
.kpi-card .spark span { flex: 1; background: var(--ink); border-radius: 1px 1px 0 0; }
.tag { display: inline-block; padding: 1px 7px; border-radius: 2px; font-size: 12px; margin: 1px 3px 1px 0; background: var(--clay); }
.stars { color: var(--ochre); letter-spacing: 1px; white-space: nowrap; } .stars .off { color: var(--rule-strong); }
.pbar { height: 6px; background: var(--clay); border-radius: 1px; overflow: hidden; min-width: 70px; } .pbar i { display: block; height: 100%; background: var(--ink); }
.vmap { height: 420px; border: 1px solid var(--rule); background: var(--clay); }
.gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
.gcard { display: block; background: var(--paper); border: 1px solid var(--rule); color: var(--ink); text-decoration: none; }
.gimg { position: relative; aspect-ratio: 4 / 3; background: var(--clay); display: grid; place-items: center; overflow: hidden; }
.gimg span { font: 700 26px Archivo, sans-serif; color: var(--bark); } .gimg img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.gmeta { padding: 8px 10px; font-weight: 600; }
.tl { display: grid; gap: 4px; overflow-x: auto; }
.tl-head, .tl-row { display: grid; grid-template-columns: minmax(120px, 22%) 1fr; gap: 10px; align-items: center; min-width: 560px; }
.tl-scale { position: relative; height: 20px; border-bottom: 1px solid var(--rule-strong); }
.tl-scale span { position: absolute; top: 0; font-size: 11px; color: var(--bark); white-space: nowrap; }
.tl-now { position: absolute; top: 0; bottom: -400px; width: 2px; background: var(--primary); opacity: 0.6; }
.tl-track { position: relative; height: 22px; background: var(--sand); }
.tl-bar { position: absolute; top: 3px; bottom: 3px; background: var(--ink); border-radius: 2px; }
.checks { display: grid; gap: 2px; } .loc { display: grid; grid-template-columns: 1fr 90px 90px auto; gap: 6px; }
button.mini { padding: 4px 8px; font-size: 12px; }
@media (max-width: 640px) { .loc { grid-template-columns: 1fr 1fr; } .vmap { height: 320px; } }
.vbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }
.vbar .grow { flex: 1; }
.vbar .vsel { display: inline-flex; gap: 6px; align-items: center; font-size: 12.5px; color: var(--bark); }
.vbar select { padding: 5px 6px; }
.seg { display: inline-flex; border: 1px solid var(--rule-strong); border-radius: 2px; overflow: hidden; }
.seg button { border: 0; border-radius: 0; padding: 6px 10px; }
.chip .x { border: 0; background: transparent; color: var(--bark); padding: 0 2px; cursor: pointer; font-size: 12px; }
th.sortable { cursor: pointer; user-select: none; }
.kanban { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(170px, 1fr); gap: 10px; overflow-x: auto; padding-bottom: 6px; }
.kcol { background: var(--sand); border: 1px solid var(--rule); padding: 8px; min-height: 90px; }
.kcol.over { outline: 2px dashed var(--primary); }
.kcard { display: block; background: var(--paper); border: 1px solid var(--rule); padding: 7px 9px; margin-top: 6px; color: var(--ink); text-decoration: none; cursor: grab; }
.cal { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 3px; }
.cday { min-height: 78px; border: 1px solid var(--rule); padding: 4px; display: flex; flex-direction: column; gap: 3px; overflow: hidden; }
.cday.off { border-color: transparent; }
.cday.today { outline: 2px solid var(--primary); }
.cev { font-size: 12px; background: var(--clay); color: var(--ink); padding: 1px 4px; text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
label.check { display: flex; gap: 8px; align-items: center; padding: 5px 0; }
@media (max-width: 640px) { .cday { min-height: 54px; } .cev { font-size: 10.5px; } }
details.area summary { cursor: pointer; list-style: none; margin: 8px 0 2px; }
details.area summary::-webkit-details-marker { display: none; }
.tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--rule); overflow-x: auto; margin-bottom: 14px; }
.tabs a { padding: 8px 12px; text-decoration: none; color: var(--bark); border-bottom: 2px solid transparent; margin-bottom: -1px; white-space: nowrap; font-size: 13.5px; }
.tabs a.on { color: var(--ink); border-color: var(--primary); font-weight: 600; }
tr.group td { background: var(--sand); font: 500 11px "JetBrains Mono", monospace; text-transform: uppercase; color: var(--bark); }
tr.total td { border-top: 1px solid var(--rule-strong); font-weight: 600; background: var(--sand); }
.neg { color: var(--error); } .pos { color: var(--success); }
.ficon { display: inline-grid; place-items: center; width: 34px; height: 40px; border: 1px solid var(--rule-strong); border-radius: 2px; font: 600 9px "JetBrains Mono", monospace; color: var(--bark); flex: none; }
.fname { display: flex; gap: 10px; align-items: center; min-width: 0; }
.back { display: none; }
@media (max-width: 980px) {
  .board { grid-template-columns: 1fr; }
  .board.reading > .pane { display: none; }
  .board:not(.reading) > .detail { display: none; }
  .back { display: inline-flex; }
}
@media (max-width: 860px) {
  .shell { grid-template-columns: 1fr; padding: 0; gap: 0; }
  .frame { border: 0; border-radius: 0; }
  .sidebar { position: fixed; inset: 0 auto 0 0; width: 270px; height: 100vh; z-index: 15; transform: translateX(-100%); transition: transform .2s; background: var(--clay); padding: 12px; top: 0; }
  .shell.open .sidebar { transform: none; box-shadow: 0 0 0 100vmax rgba(0, 0, 0, .35); }
  .page { padding: 16px; }
  .chip-now { display: none; }
}
`;

const icon = (path: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

const ICONS = {
  home: icon('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'),
  now: icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  files: icon('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/>'),
  plus: icon('<path d="M12 5v14M5 12h14"/>'),
  more: icon('<path d="M6 12h.01M12 12h.01M18 12h.01"/>'),
  agenda: icon(
    '<rect x="3" y="5" width="18" height="16" rx="1"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  ),
  life: icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  documents: icon('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>'),
  dashboards: icon('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  reminders: icon(
    '<path d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 004 0"/>',
  ),
  journal: icon('<path d="M3 12a9 9 0 109-9"/><path d="M3 4v5h5M12 8v4l3 3"/>'),
  spaces: icon('<circle cx="9" cy="9" r="4"/><circle cx="16" cy="15" r="4"/>'),
  connections: icon('<path d="M10 14l4-4M8 8l-2 2a4 4 0 006 6l1-1M16 16l2-2a4 4 0 00-6-6l-1 1"/>'),
  data: icon('<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>'),
  account: icon('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>'),
};

const script = `
const W = WORDS;
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
// Technical names stay English; what she reads comes from the models' labels, in her language.
const tr = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v[LANG] || v.en || v.fr || '' : v);
const kindLabel = (k) => (k && k.model && k.model.label ? tr(k.model.label) : k.kind);
const fieldLabelOf = (model, name) => { const f = model && model.fields.find((c) => c.name === name); return f && f.label ? tr(f.label) : name; };
const optionLabelOf = (model, name, v) => { const f = model && model.fields.find((c) => c.name === name); return f && f.optionLabels && typeof v === 'string' && f.optionLabels[v] ? tr(f.optionLabels[v]) : v; };
const say = (t, v) => String(t).replace(/\\{(\\w+)\\}/g, (_, k) => (v && v[k] != null ? v[k] : ''));
const locale = LANG === 'en' ? 'en' : 'fr';
const day = (iso) => iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const time = (iso) => iso ? new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : '';
const num = (n) => new Intl.NumberFormat(locale).format(n || 0);
let me = null; let space = null;
try { space = localStorage.getItem('jarvis.space'); } catch {}

async function api(path, options) {
  const opts = Object.assign({ credentials: 'same-origin' }, options || {});
  if (opts.body && typeof opts.body !== 'string' && !(opts.body instanceof FormData)) {
    opts.headers = Object.assign({ 'content-type': 'application/json' }, opts.headers || {});
    opts.body = JSON.stringify(opts.body);
  }
  const response = await fetch('/api' + path, opts);
  if (response.status === 401) { location.href = '/connexion'; throw new Error('401'); }
  const data = response.headers.get('content-type')?.includes('json') ? await response.json() : null;
  if (!response.ok) {
    // A refusal she can read (spec 015): its kind in her language, the model's sentence as the detail.
    const known = data && data.code && W['err_' + data.code];
    throw new Error(known ? known + ' — ' + data.error : (data && data.error) || response.status);
  }
  return data;
}
const inSpace = (path) => path + (path.includes('?') ? '&' : '?') + 'space=' + encodeURIComponent(space);
const page = () => document.getElementById('page');
const fail = (error) => { page().innerHTML = '<p class="error-text">' + esc(say(W.failed, { reason: error.message })) + '</p>'; };
const card = (title, body, wide) => '<article class="card' + (wide ? ' wide' : '') + '">' + (title ? '<h2>' + esc(title) + '</h2>' : '') + body + '</article>';
const empty = (text) => '<p class="empty">' + esc(text || W.empty) + '</p>';
const originBadge = (o) => '<span class="badge ' + esc(o) + '">' + esc(W[o] || o) + '</span>';
const said = (command) => W['c.' + command] || command;
const spaceName = () => (me.spaces.find((s) => s.id === space) || {}).name || '';

function frame(src) {
  const id = 'f' + Math.random().toString(36).slice(2);
  setTimeout(() => {
    const el = document.getElementById(id); if (!el) return;
    const fit = () => { try { el.style.height = (el.contentDocument.documentElement.scrollHeight + 4) + 'px'; } catch {} };
    el.addEventListener('load', () => { fit(); try { new ResizeObserver(fit).observe(el.contentDocument.body); } catch {} });
  });
  return '<iframe class="view" id="' + id + '" src="' + esc(src) + '"></iframe>';
}


// The drawer, the toast and an undo for what was just done (spec 013).
const drawer = () => document.getElementById('drawer');
function openDrawer(title, body, foot) {
  drawer().innerHTML = '<div class="dh"><h2>' + esc(title) + '</h2><button class="quiet" data-close>✕</button></div><div class="db">' + body + '</div>' + (foot ? '<div class="df">' + foot + '</div>' : '');
  drawer().classList.add('open');
  drawer().querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeDrawer));
}
function closeDrawer() { drawer().classList.remove('open'); }
let toastTimer; let lastDone = null;
function toast(text, undoable) {
  document.getElementById('toast-text').textContent = text;
  document.getElementById('toast-undo').style.display = undoable ? '' : 'none';
  lastDone = undoable || null;
  const t = document.getElementById('toast'); t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 6000);
}
document.getElementById('toast-undo').addEventListener('click', async () => {
  if (!lastDone) return;
  const { id, spaceId } = lastDone; lastDone = null;
  const hist = await api('/history?limit=1&target=' + encodeURIComponent(id) + '&space=' + encodeURIComponent(spaceId));
  if (hist[0]) await api('/undo?space=' + encodeURIComponent(spaceId), { method: 'POST', body: { journalId: hist[0].id } });
  toast(W.undoneToast, null); show();
});
// « 2026-10-29 » or « 2026-10-29T14:00 », a day later, as she wrote it.
function dayLater(text) {
  const d = String(text).slice(0, 10).split('-').map(Number);
  const next = new Date(Date.UTC(d[0], d[1] - 1, d[2] + 1)).toISOString().slice(0, 10);
  return next + String(text).slice(10);
}
const clock = () => { const el = document.getElementById('clock'); if (el) el.textContent = new Date().toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).toUpperCase(); };
setInterval(clock, 30000);
let pick = null;
// The views she is exploring, by kind or kept view; the one on screen.
const explorers = {};
let explorerNow = null;
let reading = false;
// The kinds of her space, kept by drawApps: a kind shows its label, not its technical name.
let knownKinds = [];
const kindName = (name) => { const k = knownKinds.find((one) => one.kind === name); return k ? kindLabel(k) : name; };
const areaOfApp = (kinds, app) => { const k = kinds.find((one) => one.model && one.model.app === app && one.model.area); return k ? k.model.area : ''; };
async function drawApps() {
  const kinds = await api(inSpace('/kinds'));
  knownKinds = kinds;
  const appPages = await api(inSpace('/pages'));
  const apps = [...new Set(kinds.filter((k) => k.model && k.model.app).map((k) => k.model.app).concat(appPages.filter((p) => p.app).map((p) => p.app)))];
  // Apps grouped by the area she files them in (spec 015); those not filed last.
  const groups = {};
  for (const a of apps) (groups[areaOfApp(kinds, a) || ''] = groups[areaOfApp(kinds, a) || ''] || []).push(a);
  const names = Object.keys(groups).sort((x, y) => (x === '') - (y === '') || x.localeCompare(y));
  const link = (a) => '<a class="navi" data-app="' + esc(encodeURIComponent(a)) + '" href="#/app/' + esc(encodeURIComponent(a)) + '"><span class="app-dot">' + esc(a.slice(0, 1).toUpperCase()) + '</span><span>' + esc(a) + '</span></a>';
  document.getElementById('apps').innerHTML = '<div class="caps">' + esc(W.navApps) + '</div>' +
    (names.length === 1 && names[0] === '' ? groups[''].map(link).join('') : names.map((n) => '<details class="area" open><summary class="caps">' + esc(n || W.unfiled) + '</summary>' + groups[n].map(link).join('') + '</details>').join('')) +
    '<a class="navi ghost" href="#/app">' + ICON_PLUS + '<span>' + esc(W.newApp) + '</span></a>';
}

// A kind whose model links it, or that other models link to (spec 014): its record page shows them.
async function hasRelations(kind) {
  const fold = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const models = (await api(inSpace('/kinds'))).filter((k) => k.model);
  return models.some((k) => k.model.fields.some((f) => f.type === 'link' && (fold(k.kind) === fold(kind) || (f.inverse && f.target && fold(f.target) === fold(kind)))));
}

// Her day in one band, 6:00 to 23:00: the template, the events, the proposals; now marked.
function dayBand(occ, focus) {
  const from = 6, to = 23;
  const at = (iso) => { const d = new Date(iso); return d.getHours() + d.getMinutes() / 60; };
  const pct = (h) => Math.max(0, Math.min(100, (h - from) / (to - from) * 100));
  const blocks = occ.filter((o) => !o.allDay).map((o) => {
    const a = at(o.start); const b = o.end ? at(o.end) || 24 : a + 0.5;
    return '<a class="blk' + (o.proposed ? ' proposed' : o.repeated ? '' : ' ev') + (o.id === focus ? ' focus' : '') + '" href="#/entree/' + esc(o.id) + '" title="' + esc(o.title) + '" style="left:' + pct(a) + '%;width:calc(' + (pct(b) - pct(a)) + '% - 2px)">' + esc(o.title) + '</a>';
  }).join('');
  const n = at(new Date().toISOString());
  return '<section class="pane"><div class="ph"><span>' + esc(W.yourDay) + '</span><a class="link" href="#/agenda">' + esc(W.navAgenda) + ' →</a></div><div class="pb"><div class="dayband"><div class="hrs">' +
    Array.from({ length: to - from }, (_, i) => '<span>' + (i % 2 ? '' : String(from + i).padStart(2, '0')) + '</span>').join('') + '</div>' + blocks +
    (n >= from && n <= to ? '<div class="nowl" style="left:' + pct(n) + '%"></div>' : '') + '</div></div></section>';
}

// Her views (specs 015, 016): the entries of a kind, filtered, sorted, as a table, a kanban, a
// calendar, a map, a gallery, a timeline or a tree. Shared by an app and a collection opened alone.
async function explore(key, st, ctx) {
  const r = await api(inSpace('/views/run'), { method: 'POST', body: { id: st.id || undefined, view: st.view } });
  explorerNow = { key, st, r, name: ctx.app, kind: ctx.kind, model: ctx.model };
  const fieldAt = (path) => r.fields.find((x) => x.path === path);
  const fl = (path) => {
    const f = fieldAt(path);
    if (path === 'title') return W.title;
    if (!f) return path;
    if (f.via && path.indexOf('.') > 0) {
      const link = fieldAt(path.split('.')[0]);
      const head = link && link.label ? tr(link.label) : path.split('.')[0];
      return path.endsWith('.title') ? head : head + ' › ' + (f.label ? tr(f.label) : path.split('.').slice(1).join('.'));
    }
    return f.label ? tr(f.label) : path;
  };
  const ol = (path, v) => { const f = fieldAt(path); return f && f.optionLabels && typeof v === 'string' && f.optionLabels[v] ? tr(f.optionLabels[v]) : v; };
  const show = (path, v, row) => {
    const f = fieldAt(path) || {};
    if (f.type === 'button') return '<button class="quiet mini" data-press="' + esc(path) + '" data-id="' + esc(row.id) + '">' + esc(fl(path)) + '</button>';
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return '<span class="muted">—</span>';
    switch (f.type) {
      case 'url': return '<a class="link" target="_blank" rel="noopener" href="' + esc(v) + '">' + esc(String(v).replace(/^https?:\\/\\//, '').split('/')[0]) + ' ↗</a>';
      case 'email': return '<a class="link" href="mailto:' + esc(v) + '">' + esc(v) + '</a>';
      case 'phone': return '<a class="link" href="tel:' + esc(String(v).replace(/[^+\\d]/g, '')) + '">' + esc(v) + '</a>';
      case 'multi_choice': case 'list': return [v].flat().map((one) => '<span class="tag">' + esc(ol(path, one)) + '</span>').join('');
      case 'rating': return '<span class="stars">' + '★'.repeat(v) + '<span class="off">' + '★'.repeat(Math.max(0, (typeof f.max === 'number' ? f.max : 5) - v)) + '</span></span>';
      case 'progress': return '<div class="pbar" title="' + esc(v) + ' %"><i style="width:' + Math.max(0, Math.min(100, v)) + '%"></i></div>';
      case 'file': return [v].flat().map((one) => '<a class="link" href="#" data-file="' + esc(one) + '">' + esc(W.fileShort) + '</a>').join(' ');
      case 'location': return '<a class="link" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=' + esc(v.lat) + '&mlon=' + esc(v.lng) + '#map=15/' + esc(v.lat) + '/' + esc(v.lng) + '">' + esc(v.address || (v.lat.toFixed(3) + ', ' + v.lng.toFixed(3))) + ' ↗</a>';
      case 'long_text': return '<span class="muted">' + esc(String(v).slice(0, 80)) + (String(v).length > 80 ? '…' : '') + '</span>';
    }
    if (typeof v === 'number') return '<span class="num ' + (v < 0 ? 'neg' : '') + '">' + esc(num(v)) + '</span>';
    if (typeof v === 'boolean') return v ? '✓' : '—';
    if (typeof v === 'object' && !Array.isArray(v)) return '<span class="muted">' + esc(v.address || JSON.stringify(v)) + '</span>';
    return esc(Array.isArray(v) ? v.join(', ') : ol(path, v));
  };
  const v = r.view;
  const isNum = (c) => c in r.totals || r.rows.some((row) => typeof row[c] === 'number');
  const types = '<div class="seg">' + r.types.map((t) => '<button class="' + (t === r.type ? 'on' : 'quiet') + '" data-vtype="' + t + '">' + esc(W['vt_' + t]) + '</button>').join('') + '</div>';
  const chips = v.filters.map((f, i) => '<span class="chip">' + esc(fl(f.field)) + ' <small>' + esc(W['op_' + f.op]) + '</small> ' + (['empty', 'not_empty', 'this_month'].includes(f.op) ? '' : esc(ol(f.field, f.value))) + ' <button class="x" data-vdel="' + i + '" aria-label="' + esc(W.remove) + '">✕</button></span>').join('');
  const sortField = v.sort[0] ? v.sort[0].field : '';
  const options = (sel, withNone) => (withNone ? '<option value="">' + esc(W.none) + '</option>' : '') + r.fields.filter((f) => !(f.via && f.path.endsWith('.title')) && f.type !== 'button').map((f) => '<option value="' + esc(f.path) + '"' + (f.path === sel ? ' selected' : '') + '>' + esc(fl(f.path)) + '</option>').join('');
  const bar = '<div class="vbar">' + types +
    '<button class="quiet" data-vfilter>+ ' + esc(W.filter) + '</button>' + chips +
    '<label class="vsel">' + esc(W.sortBy) + ' <select data-vsort>' + options(sortField, true) + '</select></label>' +
    (sortField ? '<button class="quiet" data-vdir>' + (v.sort[0].desc ? '↓' : '↑') + '</button>' : '') +
    (r.type === 'table' ? '<label class="vsel">' + esc(W.groupBy) + ' <select data-vgroup>' + options(v.groupBy || '', true) + '</select></label><button class="quiet" data-vcols>' + esc(W.columns) + '</button>' : '') +
    '<span class="grow"></span>' +
    (st.id ? '<button class="quiet" data-vupdate>' + esc(W.updateView) + '</button>' : '') + '<button class="quiet" data-vsave>' + esc(W.saveView) + '</button></div>';
  const cols = r.columns;
  const line = (row, depth) => '<tr data-go="#/entree/' + esc(row.id) + '">' + cols.map((c) => '<td class="' + (isNum(c) ? 'n' : '') + '">' + (c === 'title' ? '<span style="padding-left:' + ((depth || 0) * 18) + 'px">' + (depth ? '└ ' : '') + esc(row.title) + '</span>' : show(c, row[c], row)) + '</td>').join('') + '</tr>';
  const head = '<tr>' + cols.map((c) => '<th class="sortable ' + (isNum(c) ? 'n' : '') + '" data-vhead="' + esc(c) + '">' + esc(fl(c)) + (c === sortField ? (v.sort[0].desc ? ' ↓' : ' ↑') : '') + '</th>').join('') + '</tr>';
  let body = '';
  if (r.type === 'table' || r.type === 'tree') {
    const total = (rows, label) => Object.keys(r.totals).length ? '<tr class="total">' + cols.map((c, i) => '<td class="' + (isNum(c) ? 'n num' : '') + '">' + (i === 0 ? esc(label) : c in r.totals ? esc(num(rows.reduce((t, x) => t + (typeof x[c] === 'number' ? x[c] : 0), 0))) : '') + '</td>').join('') + '</tr>' : '';
    const rowsHtml = r.type === 'tree' ? r.tree.rows.map((row) => line(row, row.depth)).join('')
      : r.groups ? r.groups.map((g) => '<tr class="group"><td colspan="' + cols.length + '">' + esc(ol(v.groupBy, g.name)) + ' · ' + g.rows.length + '</td></tr>' + g.rows.map((row) => line(row)).join('') + total(g.rows, say(W.subtotal, { group: ol(v.groupBy, g.name) }))).join('')
      : r.rows.map((row) => line(row)).join('');
    body = r.rows.length ? '<div class="scroll"><table class="rows"><thead>' + head + '</thead><tbody>' + rowsHtml + (r.type === 'table' ? total(r.rows, W.total) : '') + '</tbody></table></div>' + (r.truncated ? '<p class="muted">' + esc(W.more) + '</p>' : '') : empty();
  } else if (r.type === 'kanban') {
    body = '<div class="kanban">' + r.kanban.columns.map((c) => '<div class="kcol" data-vdrop="' + esc(c.name) + '"><div class="caps">' + esc(ol(r.kanban.by, c.name)) + ' · ' + c.items.length + '</div>' +
      c.items.map((i) => '<a class="kcard" draggable="true" data-vcard="' + esc(i.id) + '" href="#/entree/' + esc(i.id) + '">' + esc(i.title) + '</a>').join('') + '</div>').join('') + '</div><p class="muted">' + esc(W.dragHint) + '</p>';
  } else if (r.type === 'calendar') {
    const [y, m] = st.month.split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const lead = (first.getUTCDay() + 6) % 7;
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<div class="cday off"></div>');
    for (let d = 1; d <= days; d++) {
      const day = st.month + '-' + String(d).padStart(2, '0');
      const items = r.calendar.items.filter((i) => i.day === day);
      cells.push('<div class="cday' + (day === new Date().toISOString().slice(0, 10) ? ' today' : '') + '"><span class="num muted">' + d + '</span>' + items.map((i) => '<a class="cev" href="#/entree/' + esc(i.id) + '">' + esc(i.title) + '</a>').join('') + '</div>');
    }
    body = '<div class="vbar"><button class="quiet" data-vmonth="-1">←</button><b>' + esc(first.toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })) + '</b><button class="quiet" data-vmonth="1">→</button></div>' +
      '<div class="cal">' + W.weekdays.split(',').map((d) => '<div class="caps">' + esc(d) + '</div>').join('') + cells.join('') + '</div>';
  } else if (r.type === 'map') {
    body = r.map.items.length ? '<div id="vmap" class="vmap"></div><p class="muted">' + esc(say(W.mapCount, { n: r.map.items.length, of: r.rows.length })) + '</p>' : empty(W.mapEmpty);
  } else if (r.type === 'gallery') {
    body = '<div class="gallery">' + r.gallery.items.map((i) => '<a class="gcard" href="#/entree/' + esc(i.id) + '"><div class="gimg">' + (i.file ? '<img alt="" loading="lazy" src="/api/files/' + esc(encodeURIComponent(i.file)) + '?space=' + esc(encodeURIComponent(space)) + '" onerror="this.remove()">' : '') + '<span>' + esc(i.title.slice(0, 2).toUpperCase()) + '</span></div><div class="gmeta">' + esc(i.title) + '</div></a>').join('') + '</div>';
  } else if (r.type === 'timeline') {
    const items = r.timeline.items;
    if (!items.length) body = empty();
    else {
      const dayN = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000;
      const lo = Math.min(...items.map((i) => dayN(i.start))), hi = Math.max(...items.map((i) => dayN(i.end))) + 1;
      const span = Math.max(1, hi - lo);
      const pct = (n) => ((n - lo) / span) * 100;
      const months = [];
      for (let n = lo; n < hi; n++) { const d = new Date(n * 86400000); if (d.getUTCDate() === 1 || n === lo) months.push('<span style="left:' + pct(n) + '%">' + esc(d.toLocaleDateString(locale, { month: 'short', year: '2-digit', timeZone: 'UTC' })) + '</span>'); }
      const today = dayN(new Date().toISOString().slice(0, 10));
      body = '<div class="tl"><div class="tl-head"><span></span><div class="tl-scale">' + months.join('') + (today >= lo && today < hi ? '<i class="tl-now" style="left:' + pct(today) + '%"></i>' : '') + '</div></div>' +
        items.map((i) => '<div class="tl-row"><a class="link" href="#/entree/' + esc(i.id) + '">' + esc(i.title) + '</a><div class="tl-track"><a class="tl-bar" href="#/entree/' + esc(i.id) + '" title="' + esc(i.start + ' → ' + i.end) + '" style="left:' + pct(dayN(i.start)) + '%;width:' + Math.max(0.8, pct(dayN(i.end) + 1) - pct(dayN(i.start))) + '%"></a></div></div>').join('') + '</div>';
    }
  }
  return { r, html: bar + body };
}

// The map of a view: OpenStreetMap tiles through Leaflet, loaded the first time a map is opened.
let leaflet = null;
function ensureLeaflet() {
  if (leaflet) return leaflet;
  leaflet = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    js.onload = () => resolve(window.L); js.onerror = reject;
    document.head.appendChild(js);
  });
  return leaflet;
}
async function drawMap() {
  const el = document.getElementById('vmap');
  if (!el || !explorerNow || !explorerNow.r.map) return;
  const L = await ensureLeaflet();
  const map = L.map(el, { scrollWheelZoom: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
  const items = explorerNow.r.map.items;
  const marks = items.map((i) => L.circleMarker([i.lat, i.lng], { radius: 7, color: '#b83a1b', weight: 2, fillOpacity: 0.8 })
    .bindPopup('<b>' + esc(i.title) + '</b>' + (i.address ? '<br>' + esc(i.address) : '') + '<br><a href="#/entree/' + esc(i.id) + '">' + esc(W.open) + ' →</a>').addTo(map));
  map.fitBounds(L.featureGroup(marks).getBounds().pad(0.2), { maxZoom: 14 });
}

// The statistics of a list (spec 017): how many, the streak, the active days, twelve weeks day by
// day, the hours, the splits and the figures. Shared by the Entries page and a collection.
const SERIES = ['var(--primary)', 'var(--info)', 'var(--ochre)', 'var(--success)', 'var(--bark)', 'var(--error)'];
function statsHtml(s) {
  const optionLabel = (o) => (o.label ? tr(o.label) : o.option);
  const max = Math.max(1, ...s.weeks.points.map((p) => p.n));
  const top = Math.max(1, ...s.days.map((d) => d.n));
  const today = s.days.length ? s.days[s.days.length - 1].day : '';
  const level = (n) => (n === 0 ? '' : n >= top * 0.75 ? 'l3' : n >= top * 0.4 ? 'l2' : 'l1');
  const hmax = s.hours ? Math.max(1, ...s.hours) : 1;
  return '<section class="stats">' +
    '<div class="kpi-card"><div class="caps">' + esc(W.total) + '</div><div class="kpi">' + num(s.total) + '</div><div class="muted">' + esc(say(W.thisMonthN, { n: s.thisMonth })) + '</div></div>' +
    (s.streak.best > 1 ? '<div class="kpi-card"><div class="caps">' + esc(W.streak) + '</div><div class="kpi">' + esc(say(W.streakN, { n: s.streak.current })) + '</div><div class="muted">' + esc(say(W.streakBest, { n: s.streak.best })) + '</div></div>' +
      '<div class="kpi-card"><div class="caps">' + esc(W.active30) + '</div><div class="kpi">' + esc(say(W.active30N, { n: s.active30 })) + '</div></div>' +
      '<div class="kpi-card"><div class="caps">' + esc(W.daysGrid) + '</div><div class="heat">' + s.days.map((d) => '<i class="' + level(d.n) + (d.day === today ? ' today' : '') + '" title="' + esc(day(d.day + 'T12:00:00') + ' : ' + d.n) + '"></i>').join('') + '</div></div>' : '') +
    (s.hours ? '<div class="kpi-card"><div class="caps">' + esc(W.hoursTitle) + '</div><div class="spark">' + s.hours.map((n, h) => '<span title="' + esc(String(h).padStart(2, '0') + ' h : ' + n) + '" style="height:' + Math.max(3, Math.round(n / hmax * 100)) + '%"></span>').join('') + '</div></div>' : '') +
    s.splits.filter((sp) => sp.counts.some((c) => c.n)).map((sp) => {
      return '<div class="kpi-card"><div class="caps">' + esc(say(W.byField, { field: tr(sp.label) || sp.field })) + '</div><div class="stack">' +
        sp.counts.filter((c) => c.n).map((c, i) => '<span title="' + esc(optionLabel(c) + ' : ' + c.n) + '" style="flex:' + c.n + ';background:' + SERIES[i % SERIES.length] + '"></span>').join('') + '</div><div class="legend">' +
        sp.counts.filter((c) => c.n).map((c, i) => '<span><i style="background:' + SERIES[i % SERIES.length] + '"></i>' + esc(optionLabel(c)) + ' ' + c.n + '</span>').join('') + '</div></div>';
    }).join('') +
    '<div class="kpi-card"><div class="caps">' + esc(say(W.perWeek, { field: tr(s.weeks.label) || (s.weeks.field === 'day' ? W.dayWord : s.weeks.field) })) + '</div><div class="spark">' +
      s.weeks.points.map((p) => '<span title="' + esc(p.week + ' : ' + p.n) + '" style="height:' + Math.max(3, Math.round(p.n / max * 100)) + '%"></span>').join('') + '</div></div>' +
    s.figures.map((f) => '<div class="kpi-card"><div class="caps">' + esc(say(f.kind === 'sum' ? W.sumOf : W.avgOf, { field: tr(f.label) || f.field })) + '</div><div class="kpi">' + num(f.value) + (f.unit ? '<small> ' + esc(f.unit) + '</small>' : '') + '</div></div>').join('') +
    '</section>';
}
// An entry's own day: « 31 août 2026 », or « août 2026 » when only the month is known.
const ownDay = (d) => d.length === 7 ? new Date(d + '-15T12:00:00').toLocaleDateString(locale, { month: 'long', year: 'numeric' }) : day(d + 'T12:00:00');
// How she shows her kinds (flat or in groups), kept on this device only.
const kindsMode = () => { try { return localStorage.getItem('jos.kinds') || 'grouped'; } catch { return 'grouped'; } };

// Pages, by the hash: #/vie?kind=…, #/entree/<id>, …
const pages = {
  // « Maintenant » (spec 013): what needs her, the chosen thing, her day, what she can do.
  async '' () {
    const now = await api('/now');
    const groups = ['fix', 'late', 'proposed', 'today', 'week'];
    const items = now.items;
    const sel = items.find((i) => i.id === pick) || items[0];
    const when = (i) => i.when ? (i.allDay ? day(i.when) : time(i.when)) : '';
    const list = items.length ? groups.map((g) => {
      const rows = items.filter((i) => i.group === g);
      return rows.length ? '<div class="gt">' + esc(W['g_' + g]) + ' · ' + rows.length + '</div>' + rows.map((i) =>
        '<button class="row' + (sel && i.id === sel.id ? ' on' : '') + '" data-pick="' + esc(i.id) + '"><span><div class="t">' + esc(i.title) + '</div><div class="s">' + esc(kindName(i.kind) + ' · ' + i.space + (i.when ? ' · ' + when(i) : '')) + '</div></span><span class="tag ' + esc(g) + '">' + esc(W['r_' + i.reason] || i.reason) + '</span></button>').join('') : '';
    }).join('') : '<p class="empty">' + esc(W.allClear) + '</p>';
    let detail = '<div class="pane"><div class="pb pad"><p class="empty">' + esc(W.allClear) + '</p></div></div>';
    if (sel) {
      const e = await api('/entries/' + encodeURIComponent(sel.id) + '?space=' + encodeURIComponent(sel.spaceId));
      const fields = Object.keys(e.data).filter((f) => !['text', 'source'].includes(f)).slice(0, 8);
      const value = (v) => v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v);
      const links = e.links.out.concat(e.links.in);
      const acts = [];
      if (sel.group === 'proposed') acts.push(['accept', W.a_accept, W.a_acceptWhy, true], ['refuse', W.a_refuse, W.a_refuseWhy]);
      else if (sel.group === 'fix') acts.push(['retry', W.a_retry, W.a_retryWhy, true], ['done', W.a_done, W.a_doneWhy]);
      else {
        acts.push(['done', W.a_done, W.a_doneWhy, sel.group === 'late']);
        if (e.data.at || e.data.due || e.data.start) acts.push(['later', W.a_later, W.a_laterWhy, sel.group !== 'late']);
        acts.push(['cancel', W.a_cancel, W.a_cancelWhy]);
      }
      detail = '<button class="quiet back" data-back>← ' + esc(W.back) + '</button>' +
        '<section class="pane"><div class="ph"><span>' + esc(kindName(sel.kind) + ' · ' + W['g_' + sel.group]) + '</span><span class="tag ' + esc(sel.group) + '">' + esc(W['r_' + sel.reason] || sel.reason) + '</span></div><div class="pb pad subject">' +
        '<div class="caps">' + esc(sel.space) + '</div><h2>' + esc(e.title) + '</h2>' + (sel.when ? '<p class="muted" style="margin:0 0 10px">' + esc(when(sel)) + '</p>' : '') +
        (typeof e.data.text === 'string' ? '<p style="margin:0 0 10px">' + esc(e.data.text.slice(0, 400)) + (e.data.text.length > 400 ? '…' : '') + '</p>' : '') +
        fields.map((f) => '<div class="field-row"><span class="caps">' + esc(f) + '</span><span>' + esc(value(e.data[f])) + '</span>' + originBadge(e.origin[f] || 'said') + '</div>').join('') +
        (links.length ? '<div class="chips" style="margin-top:12px">' + links.map((l) => '<a class="chip" href="#/entree/' + esc(l.entry.id) + '">' + esc(l.entry.title) + '<small>' + esc(l.role) + '</small></a>').join('') + '</div>' : '') +
        '<div class="actions" style="margin-top:12px"><a class="link" href="#/entree/' + esc(e.id) + '">' + esc(W.fullEntry) + ' →</a></div></div></section>' +
        dayBand(now.day, sel.id) +
        '<div class="choices">' + acts.map((a) => '<div class="choice' + (a[3] ? ' main' : '') + '"><b>' + esc(a[1]) + '</b><p>' + esc(a[2]) + '</p><button class="' + (a[3] ? '' : 'quiet') + '" data-act="' + a[0] + '" data-id="' + esc(sel.id) + '" data-space="' + esc(sel.spaceId) + '">' + esc(a[1]) + '</button></div>').join('') + '</div>';
    }
    const counts = groups.map((g) => items.filter((i) => i.group === g).length);
    return '<p class="lead">' + esc(say(W.nowLead, { fix: counts[0], late: counts[1], proposed: counts[2], today: counts[3] })) + '</p>' +
      '<div class="board' + (reading ? ' reading' : '') + '"><section class="pane"><div class="ph"><span>' + esc(W.navNow) + '</span><span>' + items.length + '</span></div><div class="pb">' + list + '</div></section>' +
      '<div class="detail">' + detail + '</div></div>';
  },

  // An app (spec 013): the kinds whose model names it, each a table with its columns and total.
  async app (params, name) {
    const kinds = await api(inSpace('/kinds'));
    if (!name) {
      const apps = [...new Set(kinds.filter((k) => k.model && k.model.app).map((k) => k.model.app))];
      const shipped = await api('/apps');
      return '<p class="lead">' + esc(W.appsLead) + '</p>' +
        (apps.length ? '<section class="grid">' + apps.map((a) => card(a, '<p class="muted">' + esc(areaOfApp(kinds, a) || W.unfiled) + '</p><div class="actions"><a class="link" href="#/app/' + esc(encodeURIComponent(a)) + '">' + esc(W.open) + ' →</a><button class="quiet" data-area="' + esc(a) + '">' + esc(W.fileIn) + '</button></div>')).join('') + '</section>' : '') +
        '<h2 style="margin:22px 0 10px">' + esc(W.shippedApps) + '</h2><section class="grid">' + shipped.map((a) => card(a.app, '<p class="muted">' + esc(tr(a.description)) + '</p><div class="actions">' +
          (apps.includes(a.app) ? '<span class="badge said">' + esc(W.installed) + '</span>' : '<button data-install="' + esc(a.app) + '">' + esc(W.install) + '</button>') + '</div>')).join('') + '</section>' +
        card(W.newApp, '<p class="muted">' + esc(W.newAppHow) + '</p>', true);
    }
    const models = kinds.filter((k) => k.model && k.model.app === name);
    const appPages = await api(inSpace('/pages?app=' + encodeURIComponent(name)));
    if (!models.length && !appPages.length) return empty(W.noApp);
    const pageTabs = appPages.map((p) => '<a class="' + (p.id === params.get('page') || (!params.get('page') && !params.get('kind') && !params.get('view') && p === appPages[0]) ? 'on' : '') + '" href="#/app/' + esc(encodeURIComponent(name)) + '?page=' + esc(encodeURIComponent(p.id)) + '">' + esc(tr(p.label) || p.title) + '</a>').join('');
    const kindTabs = (on) => models.map((k) => '<a class="' + (k.kind === on ? 'on' : '') + '" href="#/app/' + esc(encodeURIComponent(name)) + '?kind=' + esc(encodeURIComponent(k.kind)) + '">' + esc(kindLabel(k)) + ' <span class="muted num">' + k.count + '</span></a>').join('');
    const shownPage = params.get('page') ? appPages.find((p) => p.id === params.get('page')) : !params.get('kind') && !params.get('view') ? appPages[0] : null;
    if (shownPage) {
      const q = new URLSearchParams(params); q.delete('page'); q.set('space', space);
      return '<nav class="tabs">' + pageTabs + kindTabs(null) + (await api(inSpace('/views?app=' + encodeURIComponent(name)))).map((v) => '<a href="#/app/' + esc(encodeURIComponent(name)) + '?view=' + esc(encodeURIComponent(v.id)) + '">' + esc(tr(v.label) || v.title) + '</a>').join('') + '</nav>' + frame('/app/frame/page/' + encodeURIComponent(shownPage.id) + '?' + q.toString());
    }
    // Her views (spec 015): the entries of a kind, filtered, sorted, as a table, a kanban or a calendar.
    const views = await api(inSpace('/views?app=' + encodeURIComponent(name)));
    const viewTabs = (on) => views.map((v) => '<a class="' + (v.id === on ? 'on' : '') + '" href="#/app/' + esc(encodeURIComponent(name)) + '?view=' + esc(encodeURIComponent(v.id)) + '">' + esc(tr(v.label) || v.title) + '</a>').join('');
    const saved = params.get('view') ? views.find((v) => v.id === params.get('view')) : null;
    const current = saved ? models.find((k) => k.kind === saved.kind) || models[0] : models.find((k) => k.kind === params.get('kind')) || models[0];
    const fallback = !saved && !params.get('kind') ? null : views.find((v) => v.kind === current.kind && v.default);
    const key = saved ? 'v:' + saved.id : 'k:' + current.kind;
    const st = explorers[key] || (explorers[key] = { id: saved ? saved.id : fallback ? fallback.id : null, view: saved || fallback ? {} : { kind: current.kind }, month: new Date().toISOString().slice(0, 7) });
    const { r, html } = await explore(key, st, { app: name, kind: current.kind, model: current.model });
    const tabs = '<nav class="tabs">' + pageTabs + kindTabs(saved ? null : current.kind) + viewTabs(saved ? saved.id : null) + '</nav>';
    return '<div class="head"><div><p class="lead" style="margin:0">' + esc(saved ? tr(saved.label) || saved.title : kindLabel(current)) + ' · ' + r.rows.length + '</p></div><div class="actions"><button class="quiet" data-model="' + esc(current.kind) + '">' + esc(W.seeModel) + '</button><button data-add="' + esc(current.kind) + '">' + esc(say(W.addOne, { kind: kindLabel(current) })) + '</button></div></div>' + tabs +
      card('', html, true);
  },

  // Her files (spec 013): what each is, what Jarvis read of it, what it is linked to.
  async fichiers (params) {
    const files = await api(inSpace('/files'));
    const typeOf = (f) => f.mediaType.startsWith('image/') ? 'img' : f.mediaType === 'application/pdf' ? 'pdf' : f.mediaType.startsWith('text/') || f.mediaType.includes('json') || f.mediaType.includes('csv') ? 'text' : 'other';
    const t = params.get('t') || '';
    const shown = files.filter((f) => !t || typeOf(f) === t);
    const size = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + ' Mo' : Math.max(1, Math.round(n / 1024)) + ' Ko';
    const filters = ['', 'pdf', 'img', 'text', 'other'].map((k) => '<a class="badge' + (k === t ? ' primary' : '') + '" href="#/fichiers' + (k ? '?t=' + k : '') + '">' + esc(W['ft_' + (k || 'all')]) + ' ' + files.filter((f) => !k || typeOf(f) === k).length + '</a>').join(' ');
    return '<p class="lead">' + esc(say(W.filesLead, { n: files.length, size: size(files.reduce((a, f) => a + f.size, 0)) })) + '</p><div class="actions" style="margin-bottom:12px">' + filters + '</div>' +
      card('', shown.length ? '<div class="scroll"><table><thead><tr><th>' + esc(W.fileName) + '</th><th>' + esc(W.links) + '</th><th>' + esc(W.added) + '</th><th class="n">' + esc(W.size) + '</th><th></th></tr></thead><tbody>' +
        shown.map((f) => '<tr><td><div class="fname"><span class="ficon">' + esc(typeOf(f).toUpperCase()) + '</span><span style="min-width:0"><a class="link" href="#" data-file="' + esc(f.entryId) + '" style="overflow-wrap:anywhere">' + esc(f.name) + '</a><div class="muted" style="font-size:12px">' + esc(f.title !== f.name ? f.title : f.mediaType) + (f.read ? ' · ' + esc(W.fileRead) : '') + '</div></span></div></td>' +
          '<td><div class="chips">' + f.links.map((l) => '<a class="chip" href="#/entree/' + esc(l.id) + '">' + esc(l.title) + '<small>' + esc(l.role) + '</small></a>').join('') + '</div></td><td class="muted">' + esc(day(f.createdAt)) + '</td><td class="n num">' + esc(size(f.size)) + '</td>' +
          '<td style="text-align:right;white-space:nowrap"><button class="quiet" data-file="' + esc(f.entryId) + '">' + esc(W.preview) + '</button> <a class="badge primary" href="/api/files/' + esc(f.entryId) + '?download=1&space=' + esc(encodeURIComponent(space)) + '">' + esc(W.download) + '</a></td></tr>').join('') +
        '</tbody></table></div>' : empty(W.noFiles), true);
  },

  async accueil () { return pages.__home(); },

  async __home () {
    const o = await api('/overview');
    const here = o.spaces.find((s) => s.id === space) || o.spaces[0];
    const max = Math.max(1, ...o.changes.map((c) => c.n));
    const total = o.changes.reduce((sum, c) => sum + c.n, 0);
    return '<p class="lead">' + esc(W.homeLead) + '</p>' +
      '<section class="kpis">' +
      card('', '<div class="caps">' + esc(W.entries) + '</div><div class="kpi">' + num(here.entries) + '</div>') +
      card('', '<div class="caps">' + esc(W.documents) + '</div><div class="kpi">' + num(here.documents) + '</div>') +
      card('', '<div class="caps">' + esc(W.reminders) + '</div><div class="kpi">' + num(here.reminders) + '</div>') +
      card('', '<div class="caps">' + esc(W.changes) + '</div><div class="kpi">' + num(total) + '</div><div class="spark">' +
        o.changes.map((c) => '<span title="' + esc(c.day + ' : ' + c.n) + '" style="height:' + Math.round(c.n / max * 100) + '%"></span>').join('') + '</div>') +
      '</section><section class="grid">' +
      card(W.upcoming, o.upcoming.length ? '<ul class="list">' + o.upcoming.map((u) =>
        '<li><span><a class="link" href="#/entree/' + esc(u.id) + '">' + esc(u.title) + '</a> <span class="muted">' + esc(u.kind) + ' · ' + esc(u.space) + '</span></span><span class="num">' + esc(time(u.when)) + '</span></li>').join('') + '</ul>' : empty(W.noUpcoming)) +
      card(W.recent, o.recent.length ? '<ul class="list">' + o.recent.map((r) => {
        const what = (r.after && r.after.title) || (r.before && r.before.title) || said(r.command);
        return '<li><span>' + esc(what) + ' <span class="muted">' + esc(said(r.command)) + ' · ' + esc(r.space) + '</span></span><span class="muted">' + esc(time(r.at)) + '</span></li>';
      }).join('') + '</ul>' : empty()) +
      '</section>';
  },

  // Her collections (spec 016): every kind with a model, opened on its own, its statistics on top.
  async collections (params, kind) {
    if (!kind) {
      const list = await api(inSpace('/collections'));
      if (!list.length) return '<p class="lead">' + esc(W.collectionsLead) + '</p>' + card('', empty(W.noCollections), true);
      const groups = {};
      for (const c of list) (groups[c.area || ''] = groups[c.area || ''] || []).push(c);
      const names = Object.keys(groups).sort((x, y) => (x === '') - (y === '') || x.localeCompare(y));
      return '<p class="lead">' + esc(W.collectionsLead) + '</p>' + names.map((n) => '<h2 style="margin:18px 0 8px">' + esc(n || W.unfiled) + '</h2><section class="grid">' +
        groups[n].map((c) => card(tr(c.label) || c.kind, '<div class="kpi">' + num(c.count) + '</div><p class="muted">' + esc(c.app ? say(W.inApp, { app: c.app }) : W.noAppYet) + '</p><a class="link" href="#/collections/' + esc(encodeURIComponent(c.kind)) + '">' + esc(W.open) + ' →</a>')).join('') + '</section>').join('');
    }
    const name = decodeURIComponent(kind);
    const k = knownKinds.find((one) => one.kind === name) || (await api(inSpace('/kinds'))).find((one) => one.kind === name);
    if (!k || !k.model) return empty(W.noCollections);
    const s = await api(inSpace('/collections/' + encodeURIComponent(name) + '/stats'));
    const stats = statsHtml(s);
    const views = await api(inSpace('/views?kind=' + encodeURIComponent(name)));
    const saved = params.get('view') ? views.find((v) => v.id === params.get('view')) : null;
    const fallback = saved ? null : views.find((v) => v.default);
    const key = saved ? 'v:' + saved.id : 'c:' + name;
    const st = explorers[key] || (explorers[key] = { id: saved ? saved.id : fallback ? fallback.id : null, view: saved || fallback ? {} : { kind: name }, month: new Date().toISOString().slice(0, 7) });
    const { html } = await explore(key, st, { app: k.model.app || null, kind: name, model: k.model });
    const tabs = '<nav class="tabs"><a class="' + (saved ? '' : 'on') + '" href="#/collections/' + esc(encodeURIComponent(name)) + '">' + esc(W.allEntries) + '</a>' +
      views.map((v) => '<a class="' + (saved && v.id === saved.id ? 'on' : '') + '" href="#/collections/' + esc(encodeURIComponent(name)) + '?view=' + esc(encodeURIComponent(v.id)) + '">' + esc(tr(v.label) || v.title) + '</a>').join('') + '</nav>';
    return '<div class="head"><div><div class="caps">' + esc(k.model.area || W.unfiled) + (k.model.app ? ' · ' + esc(k.model.app) : '') + '</div><h1>' + esc(kindLabel(k)) + '</h1></div><div class="actions">' +
      '<button class="quiet" data-model="' + esc(name) + '">' + esc(W.seeModel) + '</button><button class="quiet" data-share="' + esc(name) + '">' + esc(W.share) + '</button><button data-add="' + esc(name) + '">' + esc(say(W.addOne, { kind: kindLabel(k) })) + '</button></div></div>' +
      stats + tabs + card('', html, true);
  },

  // Her entries (spec 017): the kinds flat or in her groups; the list searched, filtered by period
  // and folder, flat, by period or by folder; entries selected and filed at once; its statistics.
  async vie (params) {
    const kinds = await api(inSpace('/kinds'));
    knownKinds = kinds;
    const kind = params.get('kind') || ''; const q = params.get('q') || '';
    const from = params.get('from') || ''; const to = params.get('to') || ''; const folder = params.get('folder') || '';
    const sort = params.get('sort') || 'day'; const desc = params.get('desc') !== 'false';
    const mode = params.get('mode') || 'flat';
    const qs = new URLSearchParams();
    for (const [k, v] of [['kind', kind], ['text', q], ['from', from], ['to', to], ['folder', folder], ['sort', sort], ['desc', String(desc)]]) if (v) qs.set(k, v);
    qs.set('limit', '1000');
    const list = await api(inSpace('/list?' + qs.toString()));
    const stats = kind ? await api(inSpace('/list/stats?' + qs.toString())) : null;
    const link = (over) => { const p = new URLSearchParams(params); for (const [k, v] of Object.entries(over)) { if (v === null || v === '') p.delete(k); else p.set(k, v); } const t = p.toString(); return '#/vie' + (t ? '?' + t : ''); };

    // The kinds: flat (the most used first) or in her groups, Jarvis's own last.
    const kmode = kindsMode();
    const SYS = '~system';
    const kindRow = (k) => '<a href="' + esc(link({ kind: k.kind, folder: null })) + '" data-kname="' + esc((kindLabel(k) + ' ' + k.kind).toLowerCase()) + '" class="' + (k.kind === kind ? 'on' : '') + '"><span>' + esc(kindLabel(k)) + '</span><span class="muted num">' + k.count + '</span></a>';
    let kindsHtml;
    if (kmode === 'flat') kindsHtml = kinds.filter((k) => k.count).map(kindRow).join('');
    else {
      const groups = {};
      for (const k of kinds.filter((one) => one.count)) { const g = k.system && !k.group ? SYS : k.group || ''; (groups[g] = groups[g] || []).push(k); }
      const names = Object.keys(groups).sort((x, y) => (x === SYS) - (y === SYS) || (x === '') - (y === '') || x.localeCompare(y));
      kindsHtml = names.map((n) => '<details' + (n === SYS ? '' : ' open') + '><summary class="caps"><span>' + esc(n === SYS ? W.systemGroup : n || W.noGroup) + '</span><span class="num">' + groups[n].reduce((t, k) => t + k.count, 0) + '</span></summary>' + groups[n].map(kindRow).join('') + '</details>').join('');
    }
    const nav = '<nav class="card facets ent-kinds"><div class="head" style="margin:0;align-items:center"><span class="caps">' + esc(W.kinds) + '</span>' +
      '<div class="seg"><button class="' + (kmode === 'flat' ? 'on' : 'quiet') + '" data-kmode="flat">' + esc(W.kindsFlat) + '</button><button class="' + (kmode === 'flat' ? 'quiet' : 'on') + '" data-kmode="grouped">' + esc(W.kindsGrouped) + '</button></div></div>' +
      '<input type="search" data-kq placeholder="' + esc(W.kindSearch) + '" style="margin-top:8px">' +
      '<div class="kscroll"><a href="' + esc(link({ kind: null, folder: null })) + '" class="' + (kind ? '' : 'on') + '"><span>' + esc(W.all) + '</span></a>' + kindsHtml + '</div></nav>';

    // The list: flat, by period (year › month) or by folder (a tree).
    const k = kinds.find((one) => one.kind === kind);
    const check = (e) => '<td class="pick"><input type="checkbox" data-row="' + esc(e.id) + '"></td>';
    const dayCell = (e) => '<td class="muted" style="white-space:nowrap"' + (e.dayFrom === 'made' ? ' title="' + esc(W.madeHint) + '"' : '') + '>' + esc(ownDay(e.day)) + (e.dayFrom === 'made' ? ' *' : '') + '</td>';
    const line = (e, withFolder) => '<tr data-go="#/entree/' + esc(e.id) + '">' + check(e) + '<td>' + esc(e.title) + '</td>' + (kind ? '' : '<td><span class="badge">' + esc(kindName(e.kind)) + '</span></td>') + dayCell(e) +
      (withFolder ? '<td class="muted">' + (e.folder ? '<a class="link" href="' + esc(link({ folder: e.folder })) + '">' + esc(e.folder.split('/').slice(-2).join('/')) + '</a>' : '') + '</td>' : '') + '</tr>';
    const headRow = (withFolder) => '<tr><th class="pick"><input type="checkbox" data-all></th><th>' + esc(W.title) + '</th>' + (kind ? '' : '<th>' + esc(W.kind) + '</th>') + '<th>' + esc(W.dayCol) + '</th>' + (withFolder ? '<th>' + esc(W.folderCol) + '</th>' : '') + '</tr>';
    const span = kind ? 3 : 4;
    let body = '';
    if (!list.rows.length) body = empty();
    else if (mode === 'period') {
      let year = null; let month = null; const out = [];
      for (const e of list.rows) {
        const y = e.day.slice(0, 4); const m = e.day.slice(0, 7);
        if (y !== year) { year = y; month = null; out.push('<tr class="period year"><td colspan="' + span + '">' + esc(y) + ' · ' + list.rows.filter((x) => x.day.slice(0, 4) === y).length + '</td></tr>'); }
        if (m !== month) { month = m; out.push('<tr class="period"><td colspan="' + span + '">' + esc(new Date(m + '-15T12:00:00').toLocaleDateString(locale, { month: 'long' })) + ' · ' + list.rows.filter((x) => x.day.slice(0, 7) === m).length + '</td></tr>'); }
        out.push(line(e, false));
      }
      body = '<div class="ent-scroll"><table class="rows"><thead>' + headRow(false) + '</thead><tbody>' + out.join('') + '</tbody></table></div>';
    } else if (mode === 'folder') {
      const root = { name: '', path: '', kids: {}, rows: [] };
      for (const e of list.rows) {
        let at = root;
        for (const part of (e.folder || '').split('/').filter(Boolean)) { const path = at.path ? at.path + '/' + part : part; at = at.kids[part] || (at.kids[part] = { name: part, path, kids: {}, rows: [] }); }
        at.rows.push(e);
      }
      const count = (n) => n.rows.length + Object.values(n.kids).reduce((t, c) => t + count(c), 0);
      const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });
      const entryRow = (e) => '<div class="fe"><input type="checkbox" data-row="' + esc(e.id) + '"><a href="#/entree/' + esc(e.id) + '">' + esc(e.title) + '</a><span class="muted" style="margin-left:auto;white-space:nowrap">' + esc(ownDay(e.day)) + '</span></div>';
      const node = (n, depth, only) => '<details' + (depth < 1 || only ? ' open' : '') + '><summary><span>' + esc(n.name) + '</span><span class="grow"></span><span class="muted num">' + count(n) + '</span><a class="link" href="' + esc(link({ folder: n.path, mode: null })) + '">→</a></summary>' +
        Object.values(n.kids).sort(byName).map((c, _, all) => node(c, depth + 1, all.length === 1)).join('') + n.rows.map(entryRow).join('') + '</details>';
      body = '<div class="ent-scroll ftree">' + Object.values(root.kids).sort(byName).map((c) => node(c, 0, false)).join('') +
        (root.rows.length ? '<details open><summary><span>' + esc(W.noFolder) + '</span><span class="grow"></span><span class="muted num">' + root.rows.length + '</span></summary>' + root.rows.map(entryRow).join('') + '</details>' : '') + '</div>';
    } else {
      body = '<div class="ent-scroll"><table class="rows"><thead>' + headRow(true) + '</thead><tbody>' + list.rows.map((e) => line(e, true)).join('') + '</tbody></table></div>';
    }
    const opt = (v, label, on) => '<option value="' + v + '"' + (v === on ? ' selected' : '') + '>' + esc(label) + '</option>';
    const tools = '<form class="ent-tools" data-entform>' +
      '<input type="search" name="q" value="' + esc(q) + '" placeholder="' + esc(W.listSearch) + '">' +
      '<label class="vsel">' + esc(W.fromDay) + ' <input type="date" name="from" value="' + esc(from) + '"></label><label class="vsel">' + esc(W.toDay) + ' <input type="date" name="to" value="' + esc(to) + '"></label>' +
      '<select name="sort">' + opt('day', W.sortDay, sort) + opt('title', W.sortTitle, sort) + opt('updated', W.sortUpdated, sort) + '</select>' +
      '<button type="button" class="quiet" data-desc="' + (desc ? 'false' : 'true') + '">' + (desc ? '↓' : '↑') + '</button><button>' + esc(W.apply) + '</button></form>' +
      '<div class="ent-tools"><div class="actions">' + [['flat', W.modeFlat], ['period', W.modePeriod], ['folder', W.modeFolder]].map(([m, label]) => '<a class="badge' + (m === mode ? ' primary' : '') + '" href="' + esc(link({ mode: m === 'flat' ? null : m })) + '">' + esc(label) + '</a>').join('') + '</div>' +
      (folder ? '<span class="chip">' + esc(say(W.inFolder, { folder })) + ' <a class="x" href="' + esc(link({ folder: null })) + '" aria-label="' + esc(W.remove) + '">✕</a></span>' : '') +
      '<span class="grow"></span><span class="muted">' + esc(list.truncated ? say(W.shownOf, { n: list.rows.length, total: list.total }) : String(list.total)) + '</span></div>';
    const sel = '<div class="ent-sel" id="entsel"><b id="entsel-n"></b><span class="grow"></span><button class="quiet" data-bulk="folder">' + esc(W.fileInFolder) + '</button><button class="quiet" data-bulk="kind">' + esc(W.retype) + '</button><button class="quiet" data-bulk="archive">' + esc(W.setAside) + '</button><button class="quiet" data-bulk="none">' + esc(W.unselect) + '</button></div>';
    const head = '<div class="head" style="margin:0"><div>' + (k && k.group ? '<div class="caps">' + esc(k.group) + '</div>' : '') + '<h2 style="margin:0">' + esc(kind ? kindName(kind) : q ? '« ' + q + ' »' : W.all) + '</h2></div>' +
      (kind ? '<div class="actions"><button class="quiet" data-kgroup="' + esc(kind) + '" data-current="' + esc((k && k.group) || '') + '">' + esc(W.groupKind) + '</button><button class="quiet" data-krename="' + esc(kind) + '">' + esc(W.renameKind) + '</button></div>' : '') + '</div>';
    return '<div class="ent">' + nav + '<section class="card ent-main">' + head + (stats ? statsHtml(stats) : '') + tools + sel + body + '</section></div>';
  },

  async entree (params, id) {
    const e = await api(inSpace('/entries/' + encodeURIComponent(id)));
    const hist = await api(inSpace('/history?limit=20&target=' + encodeURIComponent(id)));
    const fields = Object.keys(e.data).filter((f) => f !== 'text' && f !== 'source');
    const value = (v) => v !== null && typeof v === 'object' ? '<code>' + esc(JSON.stringify(v)) + '</code>' : esc(v);
    let text = '';
    if (typeof e.data.text === 'string') {
      const d = await api(inSpace('/documents/' + encodeURIComponent(id)));
      text = card(W.text, '<div class="actions" style="margin-bottom:8px"><a class="link" href="#/document/' + esc(id) + '">' + esc(W.open) + ' →</a></div><div class="doc">' + d.html + '</div>', true);
    }
    const link = (l, dir) => '<li><span>' + (dir === 'out' ? '→ ' : '← ') + '<span class="muted">' + esc(l.role) + '</span> <a class="link" href="#/entree/' + esc(l.entry.id) + '">' + esc(l.entry.title) + '</a></span><span class="badge">' + esc(l.entry.kind) + '</span></li>';
    const links = e.links.out.map((l) => link(l, 'out')).concat(e.links.in.map((l) => link(l, 'in')));
    return '<div class="head"><div><div class="caps">' + esc(kindName(e.kind)) + (e.archivedAt ? ' · ' + esc(W.archived) : '') + '</div><h1>' + esc(e.title) + '</h1>' +
      (e.data.source ? '<div class="meta muted">' + esc(say(W.source, { path: e.data.source })) + '</div>' : '') + '</div>' +
      '<div class="actions">' + (e.archivedAt ? '' : '<button class="quiet" id="aside">' + esc(W.setAside) + '</button>') + '</div></div>' +
      '<section class="grid">' +
      card(W.fields, fields.length || e.computed ? fields.map((f) => '<div class="field-row"><span class="caps">' + esc(f) + '</span><span>' + (f === 'status' ? esc(W['st_' + e.data[f]] || e.data[f]) : value(e.data[f])) + '</span>' + originBadge(e.origin[f] || 'said') + '</div>').join('') +
        Object.entries(e.computed || {}).map(([f, v]) => '<div class="field-row"><span class="caps">' + esc(f) + '</span><span class="num">' + esc(typeof v === 'number' ? num(v) : v === null ? '—' : String(v)) + '</span><span class="badge">' + esc(W.computedBadge) + '</span></div>').join('') : empty()) +
      card(W.links, links.length ? '<ul class="list">' + links.join('') + '</ul>' : empty()) +
      text +
      card(W.history, '<ul class="list">' + hist.map((h) => '<li><span>' + esc(said(h.command)) + ' <span class="muted">' + esc(say(W.by, { who: h.client || h.actor === me.person.id && me.person.name || h.actor, door: h.door })) + ' · ' + esc(time(h.at)) + '</span></span>' +
        (h.undoneBy ? '<span class="badge">' + esc(W.undone) + '</span>' : h.command === 'journal.undo' ? '' : '<button class="quiet" data-undo="' + h.id + '">' + esc(W.undo) + '</button>') + '</li>').join('') + '</ul>', true) +
      '</section>' + (await hasRelations(e.kind) ? '<h2 style="margin:20px 0 8px">' + esc(W.relations) + '</h2>' + frame('/app/frame/record/' + encodeURIComponent(id) + '?space=' + encodeURIComponent(space)) : '');
  },

  async documents () {
    const r = await api(inSpace('/query'), { method: 'POST', body: { sql: "select id, kind, title, length(data->>'text') as taille, updated_at from my_entries where length(data->>'text') > 400 and archived_at is null order by updated_at desc limit 300" } });
    return card('', r.rows.length ? '<div class="scroll"><table class="rows"><thead><tr><th>' + esc(W.title) + '</th><th>' + esc(W.kind) + '</th><th class="n">' + esc(W.size) + '</th><th>' + esc(W.updated) + '</th></tr></thead><tbody>' +
      r.rows.map((d) => '<tr data-go="#/document/' + esc(d.id) + '"><td>' + esc(d.title) + '</td><td><span class="badge">' + esc(d.kind) + '</span></td><td class="n num">' + esc(say(W.chars, { n: num(d.taille) })) + '</td><td class="muted">' + esc(day(d.updated_at)) + '</td></tr>').join('') +
      '</tbody></table></div>' : empty(), true);
  },

  async document (params, id) {
    return '<p><a class="link" href="#/entree/' + esc(id) + '">← ' + esc(W.fields) + ', ' + esc(W.links) + '</a></p>' + frame('/app/frame/document/' + encodeURIComponent(id) + '?space=' + encodeURIComponent(space));
  },

  async tableaux (params) {
    const id = params.get('id');
    if (id) return '<p><a class="link" href="#/tableaux">← ' + esc(W.back) + '</a></p>' + frame('/app/frame/dashboard/' + encodeURIComponent(id) + '?space=' + encodeURIComponent(space));
    const list = await api(inSpace('/entries?kind=' + encodeURIComponent('Dashboard')));
    return list.length ? '<section class="grid">' + list.map((d) => card(d.title, '<p class="muted">' + esc(day(d.updatedAt)) + '</p><a class="link" href="#/tableaux?id=' + esc(d.id) + '">' + esc(W.open) + ' →</a>')).join('') + '</section>' : card('', empty(W.noDashboards));
  },

  async agenda (params) {
    // The week of the hash (?w=<Monday ISO>), else this one; the server says where Monday starts.
    const from = params.get('w');
    const data = await api('/agenda' + (from ? '?from=' + encodeURIComponent(from) : ''));
    const start = new Date(data.from);
    const days = Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * 86400000 + 3600000));
    const key = (d) => d.toLocaleDateString('en-CA');
    const todayKey = key(new Date());
    const hourOf = (iso) => { const d = new Date(iso); return d.getHours() + d.getMinutes() / 60; };
    const timed = data.occurrences.filter((o) => !o.allDay);
    const lo = Math.max(0, Math.min(7, ...timed.map((o) => Math.floor(hourOf(o.start)))));
    const hi = Math.min(24, Math.max(22, ...timed.map((o) => Math.ceil(o.end ? (hourOf(o.end) || 24) : hourOf(o.start) + 1))));
    const H = 40;
    const hhmm = (iso) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    const href = (o) => '#/entree/' + esc(o.id);
    const cls = (o) => (o.proposed ? ' proposed' : '') + (o.repeated ? ' repeated' : '') + (o.type === 'moment' ? ' moment' : '');
    const label = (o) => (o.proposed ? W.proposed + ' · ' : '') + o.title;
    const onDay = (d) => data.occurrences.filter((o) => key(new Date(o.start)) === key(d));
    const shift = (n) => '#/agenda?w=' + encodeURIComponent(new Date(start.getTime() + n * 7 * 86400000).toISOString());
    const bar = '<div class="week-bar"><h2>' + esc(say(W.weekOf, { day: day(days[0].toISOString()) })) + '</h2>' +
      '<a class="badge" href="' + shift(-1) + '">‹ ' + esc(W.prevWeek) + '</a><a class="badge" href="#/agenda">' + esc(W.today) + '</a><a class="badge" href="' + shift(1) + '">' + esc(W.nextWeek) + ' ›</a></div>';
    let grid = '<div class="week"><div></div>' + days.map((d) => '<div class="wh' + (key(d) === todayKey ? ' today' : '') + '">' + esc(d.toLocaleDateString(locale, { weekday: 'short' })) + '<b>' + d.getDate() + '</b></div>').join('');
    grid += '<div class="gut"></div>' + days.map((d) => '<div class="allday">' + onDay(d).filter((o) => o.allDay).map((o) => '<a class="chip-ev' + (o.type === 'deadline' ? '' : ' day') + cls(o) + '" href="' + href(o) + '" title="' + esc(o.kind + ' · ' + o.space) + '">' + (o.type === 'deadline' ? '⚑ ' : '') + esc(label(o)) + '</a>').join('') + '</div>').join('');
    grid += '<div class="gut" style="height:' + (hi - lo) * H + 'px">' + Array.from({ length: hi - lo }, (_, i) => '<span style="top:' + i * H + 'px">' + String(lo + i).padStart(2, '0') + '</span>').join('') + '</div>';
    grid += days.map((d) => {
      const evs = onDay(d).filter((o) => !o.allDay).map((o) => {
        const a = hourOf(o.start);
        const b = o.end ? (key(new Date(o.end)) === key(d) ? hourOf(o.end) : hi) : a + 0.5;
        return '<a class="ev' + cls(o) + '" href="' + href(o) + '" title="' + esc(o.kind + ' · ' + o.space) + '" style="top:' + ((a - lo) * H + 1) + 'px;height:' + Math.max((Math.min(b, hi) - a) * H - 2, 20) + 'px"><b>' + esc(label(o)) + '</b><small>' + esc(hhmm(o.start) + (o.end ? '–' + hhmm(o.end) : '')) + '</small></a>';
      }).join('');
      const nowAt = hourOf(new Date().toISOString());
      const now = key(d) === todayKey && nowAt >= lo && nowAt <= hi ? '<div class="nowline" style="top:' + (nowAt - lo) * H + 'px"></div>' : '';
      return '<div class="col' + (key(d) === todayKey ? ' today' : '') + '" style="height:' + (hi - lo) * H + 'px">' + evs + now + '</div>';
    }).join('') + '</div>';
    const list = '<div class="days">' + days.map((d) => {
      const items = onDay(d);
      return card(d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }), items.length ? '<ul class="list">' + items.map((o) =>
        '<li><span><a class="link" href="' + href(o) + '">' + esc(label(o)) + '</a> <span class="muted">' + esc(o.kind + ' · ' + o.space) + '</span></span><span class="num">' + esc(o.allDay ? W.allDay : hhmm(o.start)) + '</span></li>').join('') + '</ul>' : empty(W.noEvents));
    }).join('') + '</div>';
    const legend = '<div class="legend"><span><i></i>' + esc(W.legendEvent) + '</span><span><i style="background:var(--clay);border-color:transparent"></i>' + esc(W.legendRepeated) + '</span><span><i style="border-color:var(--primary)"></i>' + esc(W.legendDeadline) + '</span><span><i style="background:var(--info-surface);border:1px dashed var(--info)"></i>' + esc(W.legendProposed) + '</span></div>';
    const phone = card(W.subscribe, '<p class="muted">' + esc(W.subscribeLead) + '</p><p class="badge ' + (data.linked ? 'said' : '') + '" style="white-space:normal">' + esc(data.linked ? W.subscribeOn : W.subscribeOff) + '</p><div id="address"></div><div class="actions" style="margin-top:10px"><button id="subscribe"' + (data.linked ? ' data-done="1"' : '') + '>' + esc(data.linked ? W.subscribeRenew : W.subscribe) + '</button></div>', true);
    return '<p class="lead">' + esc(W.agendaLead) + '</p>' + bar + grid + list + legend + '<div class="grid" style="margin-top:16px">' + phone + '</div>';
  },

  async rappels () {
    const list = await api(inSpace('/entries?limit=200&kind=Reminder'));
    const canal = await api('/entries?kind=Channel&limit=1&space=' + encodeURIComponent(me.space.id));
    return '<p class="badge ' + (canal.length ? 'said' : 'error') + '" style="white-space:normal;margin-bottom:14px">' + esc(canal.length ? W.channelOn : W.channelOff) + '</p>' +
      card('', list.length ? '<div class="scroll"><table class="rows"><thead><tr><th>' + esc(W.title) + '</th><th>' + esc(W.when) + '</th><th>' + esc(W.repeats) + '</th><th>' + esc(W.status) + '</th></tr></thead><tbody>' +
        list.map((r) => '<tr data-go="#/entree/' + esc(r.id) + '"><td>' + esc(r.title) + (r.data.message ? '<div class="muted">' + esc(r.data.message) + '</div>' : '') + '</td><td class="num">' + esc(time(r.data.next || r.data.at)) + '</td><td class="num">' + esc(r.data.repeat || '') + '</td><td><span class="badge">' + esc(r.data.status ? W['st_' + r.data.status] || r.data.status : '—') + '</span></td></tr>').join('') +
        '</tbody></table></div>' : empty(), true);
  },

  async journal () {
    const hist = await api(inSpace('/history?limit=100'));
    return card('', '<ul class="list">' + hist.map((h) => {
      const what = (h.after && (h.after.title || h.after.role || h.after.name)) || (h.before && (h.before.title || h.before.role)) || h.target;
      return '<li><span>' + esc(what) + ' <span class="muted">' + esc(said(h.command)) + ' · ' + esc(say(W.by, { who: h.client || (h.actor === me.person.id ? me.person.name : h.actor), door: h.door })) + ' · ' + esc(time(h.at)) + '</span></span>' +
        (h.undoneBy ? '<span class="badge">' + esc(W.undone) + '</span>' : h.command === 'journal.undo' || h.command.startsWith('space.') ? '' : '<button class="quiet" data-undo="' + h.id + '">' + esc(W.undo) + '</button>') + '</li>';
    }).join('') + '</ul>', true);
  },

  async espaces () {
    const spaces = await api('/spaces');
    const blocks = [];
    for (const s of spaces) {
      const mine = s.role === 'owner';
      let invites = '';
      if (mine && !s.personal) {
        const list = await api('/spaces/' + encodeURIComponent(s.id) + '/invitations');
        invites = list.filter((i) => i.state === 'open').map((i) => '<li><span>' + esc(i.email) + ' <span class="muted">' + esc(day(i.expiresAt)) + '</span></span><button class="quiet" data-withdraw="' + esc(s.id + '/' + i.id) + '">' + esc(W.withdraw) + '</button></li>').join('');
      }
      const charter = await api('/entries?kind=Charter&limit=5&space=' + encodeURIComponent(s.id));
      blocks.push(card(s.name, '<p class="muted" style="margin:0 0 8px">' + esc(s.personal ? W.own : W.shared) + ' · ' + esc(W[s.role] || s.role) + '</p>' +
        '<div class="caps">' + esc(W.members) + '</div><ul class="list">' + s.members.map((m) => '<li><span>' + esc(m.name || m.person) + '</span>' + (mine && !s.personal && m.person !== me.person.id ? '<select data-role="' + esc(s.id + '/' + m.person) + '">' + ['owner', 'member', 'viewer'].map((r) => '<option value="' + r + '"' + (r === m.role ? ' selected' : '') + '>' + esc(W['role_' + r]) + '</option>').join('') + '</select>' : '<span class="badge">' + esc(W['role_' + m.role] || W[m.role] || m.role) + '</span>') + '</li>').join('') + '</ul>' +
        '<div class="caps" style="margin-top:10px">' + esc(W.charter) + '</div>' + (charter.length ? '<ul class="list">' + charter.map((c) => '<li><a class="link" href="#/entree/' + esc(c.id) + '" data-space="' + esc(s.id) + '">' + esc(c.title) + '</a></li>').join('') + '</ul>' : '<p class="muted">' + esc(W.noCharter) + '</p>') +
        (invites ? '<div class="caps" style="margin-top:10px">' + esc(W.invitations) + '</div><ul class="list">' + invites + '</ul>' : '') +
        (mine && !s.personal ? '<form class="actions" data-invite="' + esc(s.id) + '" style="margin-top:10px"><input class="field" type="email" required placeholder="' + esc(W.inviteEmail) + '" style="flex:1;min-width:180px"><button>' + esc(W.invite) + '</button></form><div data-link="' + esc(s.id) + '"></div>' : '') +
        '<div class="actions" style="margin-top:12px">' + (mine ? '<button class="quiet" data-rename="' + esc(s.id) + '" data-name="' + esc(s.name) + '">' + esc(W.rename) + '</button>' : '') +
        (s.personal ? '' : '<button class="quiet" data-leave="' + esc(s.id) + '" data-name="' + esc(s.name) + '">' + esc(W.leave) + '</button>') + '</div>'));
    }
    return '<section class="grid">' + blocks.join('') + card(W.newSpace, '<form class="actions" id="new-space"><input class="field" required style="flex:1;min-width:160px" placeholder="Nous"><button>' + esc(W.create) + '</button></form>') + '</section>';
  },

  async connexions () {
    const list = await api('/connections');
    const spaces = me.spaces;
    return card('', '<p class="muted" style="margin:0 0 8px">' + esc(W.connectLead) + '</p><div class="actions"><code class="url">' + esc(location.origin + '/mcp') + '</code><button class="quiet" data-copy="' + esc(location.origin + '/mcp') + '">' + esc(W.copy) + '</button></div>', true) +
      '<h2 style="margin:20px 0 10px">' + esc(W.connections) + '</h2>' +
      (list.length ? '<section class="grid">' + list.map((c) => card(c.name || c.clientId,
        '<p class="muted" style="margin:0 0 8px">' + esc(say(W.since, { date: day(c.since) })) + (c.used ? ' · ' + esc(say(W.lastUsed, { date: time(c.used) })) : '') + '</p>' +
        '<form data-reach="' + esc(c.clientId) + '"><div class="caps">' + esc(W.reach) + '</div>' + spaces.map((s) => '<label style="display:flex;gap:8px;align-items:center;padding:4px 0"><input type="checkbox" value="' + esc(s.id) + '"' + (c.spaces.includes(s.id) ? ' checked' : '') + '> ' + esc(s.name) + '</label>').join('') +
        '<div class="actions" style="margin-top:8px"><button>' + esc(W.save) + '</button><button type="button" class="quiet" data-revoke="' + esc(c.clientId) + '" data-name="' + esc(c.name || c.clientId) + '">' + esc(W.revoke) + '</button></div></form>')).join('') + '</section>' : card('', empty(W.noConnections)));
  },

  async donnees () {
    return '<section class="grid">' +
      card(W.exportTitle, '<p class="muted">' + esc(W.exportLead) + '</p><a href="' + esc('/api/export?space=' + encodeURIComponent(space)) + '"><button>' + esc(say(W.exportButton, { space: spaceName() })) + '</button></a>') +
      card(W.importTitle, '<p class="muted">' + esc(W.importLead) + '</p><div class="stack"><label class="caps">' + esc(W.importKinds) + '<textarea class="field" id="kinds" placeholder=\\'{ "journal": "Journal" }\\'></textarea></label>' +
        '<label><span class="badge primary" style="cursor:pointer">' + esc(W.importChoose) + '</span><input type="file" id="folder" webkitdirectory multiple hidden></label>' +
        '<div class="actions"><button id="import" disabled>' + esc(say(W.importRun, { n: 0 })) + '</button></div><div id="report"></div></div>') +
      '</section>';
  },

  async compte () {
    // Her zone and her Telegram (spec 015), beside who she is.
    const { zone } = await api('/me/zone');
    const channel = (await api('/entries?kind=Channel&limit=1&space=' + encodeURIComponent(me.space.id)))[0];
    const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [zone];
    const keys = await api('/me/keys');
    return '<section class="grid">' + card(W.accountTitle, '<div class="field-row"><span class="caps">' + esc(W.name) + '</span><span>' + esc(me.person.name) + '</span><span></span></div>' +
      '<div class="field-row"><span class="caps">' + esc(W.email) + '</span><span>' + esc(me.person.email) + '</span><span></span></div>' +
      '<div class="actions" style="margin-top:14px"><button class="quiet" id="sign-out">' + esc(W.signOut) + '</button></div>') +
      card(W.zoneTitle, '<p class="muted">' + esc(W.zoneLead) + '</p><div class="form-field"><select id="zone">' + zones.map((z) => '<option' + (z === zone ? ' selected' : '') + '>' + esc(z) + '</option>').join('') + '</select></div>') +
      card(W.telegramTitle, '<p class="badge ' + (channel && channel.data.telegram ? 'said' : 'error') + '" style="white-space:normal">' + esc(channel && channel.data.telegram ? W.channelOn : W.channelOff) + '</p><p class="muted">' + esc(W.telegramLead) + '</p><div id="tg"></div><div class="actions"><button id="tg-link">' + esc(channel && channel.data.telegram ? W.telegramAgain : W.telegramLink) + '</button></div>') +
      card(W.keysTitle, '<p class="muted">' + esc(W.keysLead) + '</p><div id="newkey"></div>' +
        (keys.length ? '<ul class="list">' + keys.map((k) => '<li><span>' + esc(k.name) + ' <span class="muted">· ' + esc(say(W.keyMade, { day: day(k.createdAt) })) + (k.lastUsedAt ? ' · ' + esc(say(W.keyUsed, { day: day(k.lastUsedAt) })) : '') + '</span></span><button class="quiet" data-revoke="' + esc(k.id) + '">' + esc(W.keyRevoke) + '</button></li>').join('') + '</ul>' : '') +
        '<div class="actions"><button id="key-new">' + esc(W.keyNew) + '</button></div>') +
      '</section>';
  },
};

const titles = { '': 'navNow', accueil: 'navHome', collections: 'navCollections', fichiers: 'navFiles', app: 'navApps', agenda: 'navAgenda', vie: 'navEntries', entree: 'navEntries', documents: 'navDocuments', document: 'navDocuments', tableaux: 'navDashboards',
  rappels: 'navReminders', journal: 'navJournal', espaces: 'navSpaces', connexions: 'navConnections', donnees: 'navData', compte: 'navAccount' };

let drawing = 0;
async function show() {
  const [path, query] = location.hash.replace(/^#\\/?/, '').split('?');
  const [name, id] = path.split('/');
  const params = new URLSearchParams(query || '');
  const key = pages[name] ? name : '';
  document.getElementById('title').textContent = key === 'app' && id ? decodeURIComponent(id) : key === 'collections' && id ? kindName(decodeURIComponent(id)) : W[titles[key]];
  document.querySelectorAll('a[data-page]').forEach((a) => a.classList.toggle('on', a.dataset.page === (titles[key] || 'navNow')));
  document.querySelectorAll('a[data-app]').forEach((a) => a.classList.toggle('on', key === 'app' && a.dataset.app === id));
  document.querySelector('.shell').classList.remove('open'); closeDrawer();
  page().innerHTML = '<p class="empty">' + esc(W.loading) + '</p>';
  // Only the latest navigation is drawn: a slower earlier one never overwrites it.
  const ticket = ++drawing;
  try {
    const html = await pages[key](params, id ? decodeURIComponent(id) : undefined);
    if (ticket !== drawing) return;
    page().innerHTML = html; bind(); window.scrollTo(0, 0);
  } catch (error) { if (ticket === drawing) fail(error); }
}

// The Entries page (spec 017): her kinds found as she types, the list's form, its selection.
function bindEntries(root) {
  const params = () => new URLSearchParams((location.hash.split('?')[1]) || '');
  const go = (over) => { const p = params(); for (const [k, v] of Object.entries(over)) { if (v === null || v === '') p.delete(k); else p.set(k, v); } location.hash = '#/vie' + (p.toString() ? '?' + p.toString() : ''); };
  root.querySelectorAll('[data-kmode]').forEach((b) => b.addEventListener('click', () => { try { localStorage.setItem('jos.kinds', b.dataset.kmode); } catch {} show(); }));
  const kq = root.querySelector('[data-kq]');
  if (kq) kq.addEventListener('input', () => {
    const t = kq.value.trim().toLowerCase();
    root.querySelectorAll('[data-kname]').forEach((a) => { a.style.display = !t || a.dataset.kname.includes(t) ? '' : 'none'; });
    root.querySelectorAll('.ent-kinds details').forEach((d) => { const any = [...d.querySelectorAll('[data-kname]')].some((a) => a.style.display !== 'none'); d.style.display = any ? '' : 'none'; if (t) d.open = true; });
  });
  const form = root.querySelector('[data-entform]');
  if (form) {
    form.addEventListener('submit', (event) => { event.preventDefault(); const f = new FormData(form); go({ q: f.get('q'), from: f.get('from'), to: f.get('to'), sort: f.get('sort') === 'day' ? null : f.get('sort') }); });
    form.querySelector('[data-desc]').addEventListener('click', (event) => go({ desc: event.target.dataset.desc === 'true' ? null : 'false' }));
  }
  root.querySelectorAll('[data-krename]').forEach((b) => b.addEventListener('click', async () => {
    const to = prompt(say(W.renameKindAsk, { kind: b.dataset.krename }), b.dataset.krename); if (!to || !to.trim() || to.trim() === b.dataset.krename) return;
    try { const r = await api(inSpace('/kinds/rename'), { method: 'POST', body: { from: b.dataset.krename, to: to.trim() } }); toast(say(W.renamedToast, { kind: r.kind }), { id: r.kind, spaceId: space }); go({ kind: r.kind }); } catch (error) { fail(error); }
  }));
  root.querySelectorAll('[data-kgroup]').forEach((b) => b.addEventListener('click', async () => {
    const g = prompt(say(W.groupKindAsk, { kind: b.dataset.kgroup }), b.dataset.current); if (g === null) return;
    try { await api(inSpace('/kinds/group'), { method: 'POST', body: { kind: b.dataset.kgroup, group: g.trim() || null } }); toast(say(W.groupedToast, { kind: b.dataset.kgroup, group: g.trim() || W.noGroup }), null); show(); } catch (error) { fail(error); }
  }));
  const bar = root.querySelector('#entsel');
  if (!bar) return;
  const picked = () => [...root.querySelectorAll('[data-row]:checked')].map((c) => c.dataset.row);
  const refresh = () => { const n = picked().length; bar.classList.toggle('on', n > 0); root.querySelector('#entsel-n').textContent = say(W.selectedN, { n }); };
  root.querySelectorAll('[data-row]').forEach((c) => c.addEventListener('change', refresh));
  const all = root.querySelector('[data-all]');
  if (all) all.addEventListener('change', () => { root.querySelectorAll('[data-row]').forEach((c) => { c.checked = all.checked; }); refresh(); });
  root.querySelectorAll('[data-bulk]').forEach((b) => b.addEventListener('click', async () => {
    const ids = picked(); const what = b.dataset.bulk;
    if (what === 'none') { root.querySelectorAll('[data-row], [data-all]').forEach((c) => { c.checked = false; }); refresh(); return; }
    let body; let said;
    if (what === 'folder') { const f = prompt(W.folderAsk, params().get('folder') || ''); if (f === null) return; body = { ids, folder: f.trim() || null }; said = W.filedToast; }
    else if (what === 'kind') { const k = prompt(W.kindAsk, params().get('kind') || ''); if (!k || !k.trim()) return; body = { ids, kind: k.trim() }; said = W.retypedToast; }
    else { if (!confirm(say(W.asideAsk, { n: ids.length }))) return; body = { ids, archive: true }; said = W.asideToast; }
    try { await api(inSpace('/entries/bulk'), { method: 'POST', body }); toast(say(said, { n: ids.length }), { id: ids[0], spaceId: space }); show(); } catch (error) { fail(error); }
  }));
}

function bind() {
  const root = page();
  root.querySelectorAll('[data-go]').forEach((row) => row.addEventListener('click', (event) => { if (event.target.closest('input, a, button')) return; location.hash = row.dataset.go; }));
  bindEntries(root);
  root.querySelectorAll('a[data-space]').forEach((a) => a.addEventListener('click', () => choose(a.dataset.space, false)));
  root.querySelectorAll('[data-undo]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    try { await api(inSpace('/undo'), { method: 'POST', body: { journalId: Number(b.dataset.undo) } }); show(); } catch (error) { fail(error); }
  }));
  const aside = document.getElementById('aside');
  if (aside) aside.addEventListener('click', async () => {
    const id = location.hash.split('/')[2];
    if (!confirm(say(W.setAsideAsk, { title: document.querySelector('.page h1').textContent }))) return;
    try { await api(inSpace('/entries/' + id + '/archive'), { method: 'POST' }); show(); } catch (error) { fail(error); }
  });
  root.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = W.copied; } catch {}
  }));
  root.querySelectorAll('form[data-invite]').forEach((f) => f.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = f.querySelector('input').value;
    try {
      const made = await api('/spaces/' + encodeURIComponent(f.dataset.invite) + '/invitations', { method: 'POST', body: { email } });
      root.querySelector('[data-link="' + f.dataset.invite + '"]').innerHTML = '<p class="muted">' + esc(say(W.inviteLink, { email })) + '</p><div class="actions"><code class="url">' + esc(made.link) + '</code><button class="quiet" id="copy-invite">' + esc(W.copy) + '</button></div>';
      document.getElementById('copy-invite').addEventListener('click', async (e) => { await navigator.clipboard.writeText(made.link); e.target.textContent = W.copied; });
    } catch (error) { alert(error.message); }
  }));
  root.querySelectorAll('[data-withdraw]').forEach((b) => b.addEventListener('click', async () => {
    const [s, i] = b.dataset.withdraw.split('/');
    try { await api('/spaces/' + s + '/invitations/' + i, { method: 'DELETE' }); show(); } catch (error) { alert(error.message); }
  }));
  root.querySelectorAll('[data-rename]').forEach((b) => b.addEventListener('click', async () => {
    const name = prompt(W.newName, b.dataset.name); if (!name) return;
    try { await api('/spaces/' + b.dataset.rename, { method: 'PATCH', body: { name } }); await load(); show(); } catch (error) { alert(error.message); }
  }));
  root.querySelectorAll('[data-leave]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(say(W.leaveAsk, { space: b.dataset.name }))) return;
    try { await api('/spaces/' + b.dataset.leave + '/members/me', { method: 'DELETE' }); await load(); show(); } catch (error) { alert(error.message); }
  }));
  const created = document.getElementById('new-space');
  if (created) created.addEventListener('submit', async (event) => {
    event.preventDefault();
    try { await api('/spaces', { method: 'POST', body: { name: created.querySelector('input').value } }); await load(); show(); } catch (error) { alert(error.message); }
  });
  root.querySelectorAll('form[data-reach]').forEach((f) => f.addEventListener('submit', async (event) => {
    event.preventDefault();
    const spaces = [...f.querySelectorAll('input:checked')].map((i) => i.value);
    try { await api('/clients/' + encodeURIComponent(f.dataset.reach) + '/spaces', { method: 'PUT', body: { spaces } }); f.querySelector('button').textContent = W.saved; } catch (error) { alert(error.message); }
  }));
  root.querySelectorAll('[data-revoke]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(say(W.revokeAsk, { client: b.dataset.name }))) return;
    try { await api('/connections/' + encodeURIComponent(b.dataset.revoke), { method: 'DELETE' }); show(); } catch (error) { alert(error.message); }
  }));
  const folder = document.getElementById('folder');
  if (folder) {
    let docs = [];
    folder.addEventListener('change', async () => {
      const files = [...folder.files].filter((f) => /\\.md$/i.test(f.name) && !/(^|\\/)(\\.|node_modules\\/)/.test(f.webkitRelativePath));
      docs = await Promise.all(files.map(async (f) => ({ path: f.webkitRelativePath.split('/').slice(1).join('/'), text: await f.text() })));
      const run = document.getElementById('import'); run.disabled = !docs.length; run.textContent = say(W.importRun, { n: docs.length });
    });
    document.getElementById('import').addEventListener('click', async (event) => {
      event.target.disabled = true;
      const report = document.getElementById('report');
      try {
        const raw = document.getElementById('kinds').value.trim();
        const done = await api(inSpace('/import'), { method: 'POST', body: Object.assign({ docs }, raw ? { kinds: JSON.parse(raw) } : {}) });
        report.innerHTML = '<p>' + esc(say(W.importDone, done)) + '</p>' + (done.journalId ? '<button class="quiet" data-undo="' + done.journalId + '">' + esc(W.importUndo) + '</button>' : '');
        bind();
      } catch (error) { report.innerHTML = '<p class="error-text">' + esc(say(W.failed, { reason: error.message })) + '</p>'; event.target.disabled = false; }
    });
  }
  // Her views (spec 015): each change runs the view again; saving keeps it as an entry « View ».
  const ex = explorerNow;
  const change = (patch) => { if (!ex) return; Object.assign(ex.st.view, patch(Object.assign({ filters: [], sort: [] }, ex.r.view))); show(); };
  root.querySelectorAll('[data-vtype]').forEach((b) => b.addEventListener('click', () => change(() => ({ type: b.dataset.vtype }))));
  root.querySelectorAll('[data-vdel]').forEach((b) => b.addEventListener('click', () => change((v) => ({ filters: v.filters.filter((_, i) => i !== Number(b.dataset.vdel)) }))));
  root.querySelectorAll('[data-vsort]').forEach((s) => s.addEventListener('change', () => change(() => ({ sort: s.value ? [{ field: s.value, desc: false }] : [] }))));
  root.querySelectorAll('[data-vdir]').forEach((b) => b.addEventListener('click', () => change((v) => ({ sort: v.sort.length ? [{ field: v.sort[0].field, desc: !v.sort[0].desc }] : [] }))));
  root.querySelectorAll('[data-vhead]').forEach((th) => th.addEventListener('click', () => change((v) => ({ sort: [{ field: th.dataset.vhead, desc: v.sort[0] && v.sort[0].field === th.dataset.vhead ? !v.sort[0].desc : false }] }))));
  root.querySelectorAll('[data-vgroup]').forEach((s) => s.addEventListener('change', () => change(() => ({ groupBy: s.value || undefined }))));
  root.querySelectorAll('[data-vmonth]').forEach((b) => b.addEventListener('click', () => {
    const [y, m] = ex.st.month.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + Number(b.dataset.vmonth), 1));
    ex.st.month = d.toISOString().slice(0, 7); show();
  }));
  root.querySelectorAll('[data-vfilter]').forEach((b) => b.addEventListener('click', () => {
    const fieldOf = (path) => ex.r.fields.find((f) => f.path === path) || { type: 'text' };
    const opsFor = (t) => ['amount', 'number', 'formula'].includes(t) ? ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'empty', 'not_empty']
      : ['date', 'datetime'].includes(t) ? ['eq', 'gt', 'lt', 'this_month', 'last_days', 'empty', 'not_empty']
      : t === 'choice' ? ['eq', 'ne', 'empty', 'not_empty'] : t === 'boolean' ? ['eq'] : ['contains', 'not_contains', 'eq', 'ne', 'empty', 'not_empty'];
    const label = (f) => { const path = f.via && f.path.endsWith('.title') ? f.path.slice(0, -6) : f.path; const o = document.querySelector('[data-vsort] option[value="' + CSS.escape(path) + '"]'); return o ? o.textContent : f.path; };
    openDrawer(W.filter, '<div class="form-field"><label>' + esc(W.field) + '</label><select id="vf_field">' + ex.r.fields.filter((f) => f.type !== 'link').map((f) => '<option value="' + esc(f.path) + '">' + esc(label(f)) + '</option>').join('') + '</select></div>' +
      '<div class="form-field"><label>' + esc(W.condition) + '</label><select id="vf_op"></select></div><div class="form-field" id="vf_valuebox"><label>' + esc(W.value) + '</label><span id="vf_value"></span></div>',
      '<button class="quiet" data-close>' + esc(W.cancel) + '</button><button id="vf_apply">' + esc(W.apply) + '</button>');
    const field = document.getElementById('vf_field'), op = document.getElementById('vf_op');
    const refresh = () => {
      const f = fieldOf(field.value);
      op.innerHTML = opsFor(f.type).map((o) => '<option value="' + o + '">' + esc(W['op_' + o]) + '</option>').join('');
      const value = () => {
        const box = document.getElementById('vf_value');
        document.getElementById('vf_valuebox').style.display = ['empty', 'not_empty', 'this_month'].includes(op.value) ? 'none' : '';
        box.innerHTML = f.type === 'choice' ? '<select id="vf_v">' + (f.options || []).map((o) => '<option value="' + esc(o) + '">' + esc(f.optionLabels && f.optionLabels[o] ? tr(f.optionLabels[o]) : o) + '</option>').join('') + '</select>'
          : f.type === 'boolean' ? '<select id="vf_v"><option value="true">✓</option><option value="false">—</option></select>'
          : '<input id="vf_v" type="' + (op.value === 'last_days' || ['amount', 'number', 'formula'].includes(f.type) ? 'number' : ['date', 'datetime'].includes(f.type) ? 'date' : 'text') + '" step="any">';
      };
      op.onchange = value; value();
    };
    field.onchange = refresh; refresh();
    document.getElementById('vf_apply').addEventListener('click', () => {
      const f = fieldOf(field.value); const el = document.getElementById('vf_v'); let value = el ? el.value : undefined;
      if (f.type === 'boolean') value = value === 'true';
      else if (value !== undefined && value !== '' && (op.value === 'last_days' || ['amount', 'number', 'formula'].includes(f.type))) value = Number(value);
      closeDrawer(); change((v) => ({ filters: v.filters.concat([{ field: field.value, op: op.value, ...(value === undefined || value === '' ? {} : { value }) }]) }));
    });
  }));
  root.querySelectorAll('[data-vcols]').forEach((b) => b.addEventListener('click', () => {
    const on = new Set(ex.r.columns);
    const label = (f) => { const o = document.querySelector('[data-vsort] option[value="' + CSS.escape(f.path) + '"]'); return o ? o.textContent : f.path; };
    openDrawer(W.columns, ex.r.fields.filter((f) => f.path !== 'title').map((f) => '<label class="check"><input type="checkbox" value="' + esc(f.path) + '"' + (on.has(f.path) ? ' checked' : '') + '> ' + esc(label(f)) + '</label>').join(''),
      '<button class="quiet" data-close>' + esc(W.cancel) + '</button><button id="vc_apply">' + esc(W.apply) + '</button>');
    document.getElementById('vc_apply').addEventListener('click', () => {
      const columns = [...document.querySelectorAll('.drawer input[type=checkbox]:checked, #drawer input[type=checkbox]:checked')].map((i) => i.value);
      closeDrawer(); change(() => ({ columns }));
    });
  }));
  const keep = async (id) => {
    const view = Object.assign({}, ex.r.view, { kind: ex.kind }, ex.name ? { app: ex.name } : {});
    delete view.limit;
    if (id) { await api(inSpace('/save'), { method: 'POST', body: { entries: [{ id, data: view }] } }); toast(W.viewUpdated, null); delete explorers[ex.key]; show(); return; }
    const title = prompt(W.viewName); if (!title) return;
    const saved = await api(inSpace('/save'), { method: 'POST', body: { entries: [{ kind: 'View', title, data: Object.assign(view, { label: { [LANG]: title } }) }] } });
    location.hash = '#/app/' + encodeURIComponent(ex.name) + '?view=' + encodeURIComponent(saved.entries[0].id);
  };
  root.querySelectorAll('[data-vsave]').forEach((b) => b.addEventListener('click', () => keep(null).catch((e) => alert(e.message))));
  root.querySelectorAll('[data-vupdate]').forEach((b) => b.addEventListener('click', () => keep(ex.st.id).catch((e) => alert(e.message))));
  if (ex && ex.r.type === 'map') drawMap().catch(() => undefined);
  root.querySelectorAll('[data-press]').forEach((b) => b.addEventListener('click', async (event) => {
    event.stopPropagation();
    b.disabled = true;
    try {
      await api(inSpace('/entries/' + encodeURIComponent(b.dataset.id) + '/press'), { method: 'POST', body: { field: b.dataset.press } });
      toast(W.pressed, { id: b.dataset.id, spaceId: space }); show();
    } catch (error) { b.disabled = false; alert(error.message); }
  }));
  root.querySelectorAll('[data-vcard]').forEach((c) => c.addEventListener('dragstart', (event) => { event.dataTransfer.setData('text/plain', c.dataset.vcard); }));
  root.querySelectorAll('[data-vdrop]').forEach((col) => {
    col.addEventListener('dragover', (event) => { event.preventDefault(); col.classList.add('over'); });
    col.addEventListener('dragleave', () => col.classList.remove('over'));
    col.addEventListener('drop', async (event) => {
      event.preventDefault(); col.classList.remove('over');
      const id = event.dataTransfer.getData('text/plain'); if (!id || col.dataset.vdrop === '—') return;
      try {
        await api(inSpace('/save'), { method: 'POST', body: { entries: [{ id, data: { [ex.r.kanban.by]: col.dataset.vdrop } }] } });
        toast(W.moved, { id, spaceId: space }); show();
      } catch (error) { alert(error.message); }
    });
  });
  root.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => { pick = b.dataset.pick; reading = true; show(); }));
  root.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => { reading = false; show(); }));
  root.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
    const id = b.dataset.id; const spaceId = b.dataset.space;
    try {
      const e = await api('/entries/' + encodeURIComponent(id) + '?space=' + encodeURIComponent(spaceId));
      const data = {};
      const act = b.dataset.act;
      if (act === 'done') data.status = 'done';
      if (act === 'cancel' || act === 'refuse') data.status = 'cancelled';
      if (act === 'accept' || act === 'retry') data.status = 'planned';
      if (act === 'retry' && e.data.error !== undefined) data.error = null;
      if (act === 'later') {
        for (const f of ['at', 'due', 'start', 'end']) if (typeof e.data[f] === 'string') data[f] = dayLater(e.data[f]);
      }
      await api('/save?space=' + encodeURIComponent(spaceId), { method: 'POST', body: { entries: [{ id, data }] } });
      pick = null; reading = false;
      toast(say(W.doneToast, { title: e.title, what: W['t_' + act] }), { id, spaceId });
      show();
    } catch (error) { alert(error.message); }
  }));
  root.querySelectorAll('[data-file]').forEach((b) => b.addEventListener('click', async (event) => {
    event.preventDefault();
    const id = b.dataset.file;
    const files = await api(inSpace('/files'));
    const f = files.find((one) => one.entryId === id); if (!f) return;
    const src = '/api/files/' + encodeURIComponent(id) + '?space=' + encodeURIComponent(space);
    let view = '';
    if (f.mediaType.startsWith('image/')) view = '<img alt="" src="' + esc(src) + '">';
    else if (f.mediaType === 'application/pdf') view = '<iframe src="' + esc(src) + '"></iframe>';
    else if (f.read) view = '<pre>' + esc((await (await fetch(src, { credentials: 'same-origin' })).text()).slice(0, 20000)) + '</pre>';
    else view = '<p class="muted">' + esc(W.noPreview) + '</p>';
    openDrawer(f.name, view + '<div class="field-row"><span class="caps">' + esc(W.added) + '</span><span>' + esc(time(f.createdAt)) + '</span><span></span></div>' +
      '<div class="field-row"><span class="caps">' + esc(W.kind) + '</span><span>' + esc(f.mediaType) + '</span><span></span></div>' +
      (f.links.length ? '<div class="chips">' + f.links.map((l) => '<a class="chip" href="#/entree/' + esc(l.id) + '">' + esc(l.title) + '<small>' + esc(l.role) + '</small></a>').join('') + '</div>' : ''),
      '<a class="badge" href="#/entree/' + esc(id) + '">' + esc(W.fullEntry) + '</a><a class="badge primary" href="' + esc(src) + '&download=1">' + esc(W.download) + '</a>');
  }));
  root.querySelectorAll('[data-area]').forEach((b) => b.addEventListener('click', async () => {
    const area = prompt(say(W.fileInAsk, { app: b.dataset.area }));
    if (area === null) return;
    try { await api(inSpace('/apps/area'), { method: 'POST', body: { app: b.dataset.area, area: area.trim() } }); await drawApps(); show(); }
    catch (error) { alert(error.message); }
  }));
  const zoneSelect = document.getElementById('zone');
  if (zoneSelect) zoneSelect.addEventListener('change', async () => {
    try { await api('/me/zone', { method: 'POST', body: { zone: zoneSelect.value } }); toast(say(W.zoneSaved, { zone: zoneSelect.value }), null); }
    catch (error) { alert(error.message); }
  });
  const keyNew = document.getElementById('key-new');
  if (keyNew) keyNew.addEventListener('click', async () => {
    const name = prompt(W.keyName); if (!name) return;
    try {
      const made = await api('/me/keys', { method: 'POST', body: { name } });
      await show();
      document.getElementById('newkey').innerHTML = '<p class="badge read" style="white-space:normal">' + esc(W.keyOnce) + '</p><p><code class="url">' + esc(made.key) + '</code></p>';
    } catch (error) { alert(error.message); }
  });
  root.querySelectorAll('[data-revoke]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(W.keyRevokeAsk)) return;
    try { await api('/me/keys/' + encodeURIComponent(b.dataset.revoke), { method: 'DELETE' }); show(); } catch (error) { alert(error.message); }
  }));
  const tgLink = document.getElementById('tg-link');
  if (tgLink) tgLink.addEventListener('click', async () => {
    try {
      const made = await api('/me/telegram', { method: 'POST', body: {} });
      document.getElementById('tg').innerHTML = '<p><a class="badge primary" target="_blank" rel="noopener" href="' + esc(made.link) + '">' + esc(W.telegramOpen) + '</a></p><p class="muted">' + esc(say(W.telegramThen, { minutes: made.minutes })) + '</p>';
    } catch (error) { alert(error.message); }
  });
  root.querySelectorAll('[data-role]').forEach((sel) => sel.addEventListener('change', async () => {
    const [spaceId, person] = sel.dataset.role.split('/');
    try { await api('/spaces/' + encodeURIComponent(spaceId) + '/members/' + encodeURIComponent(person) + '/role', { method: 'POST', body: { role: sel.value } }); toast(W.saved, null); }
    catch (error) { alert(error.message); show(); }
  }));
  root.querySelectorAll('[data-install]').forEach((b) => b.addEventListener('click', async () => {
    const name = b.dataset.install;
    try {
      const tried = await api(inSpace('/apps/install'), { method: 'POST', body: { name } });
      openDrawer(say(W.installWhat, { app: name }), '<ul class="list">' + tried.result.created.map((one) => '<li>' + esc(one) + '</li>').join('') + '</ul>' +
        (tried.result.kept.length ? '<p class="muted">' + esc(say(W.installKept, { n: tried.result.kept.length })) + '</p>' : '') + '<p class="error-text" id="i__error"></p>',
        '<button class="quiet" data-close>' + esc(W.cancel) + '</button><button id="i__go">' + esc(W.install) + '</button>');
      document.getElementById('i__go').addEventListener('click', async () => {
        try {
          await api(inSpace('/apps/install'), { method: 'POST', body: { name, dryRun: false } });
          closeDrawer(); toast(say(W.installedToast, { app: name }), null); await drawApps(); location.hash = '#/app/' + encodeURIComponent(name);
        } catch (error) { document.getElementById('i__error').textContent = error.message; }
      });
    } catch (error) { alert(error.message); }
  }));
  root.querySelectorAll('[data-model]').forEach((b) => b.addEventListener('click', async () => {
    const k = (await api(inSpace('/kinds'))).find((one) => one.kind === b.dataset.model);
    if (!k || !k.model) return;
    openDrawer(say(W.modelOf, { kind: kindLabel(k) }), '<p class="muted">' + esc(W.modelLead) + '</p>' + k.model.fields.map((c) =>
      '<div class="field-row"><span class="caps">' + esc(fieldLabelOf(k.model, c.name)) + '</span><span>' + esc((W['ty_' + c.type] || c.type) + (c.options ? ' : ' + c.options.map((o) => optionLabelOf(k.model, c.name, o)).join(', ') : '') + (c.target ? ' → ' + c.target : '') + (c.formula ? ' = ' + c.formula : '') + (c.unit ? ' (' + c.unit + ')' : '')) + '</span><span class="badge">' + esc(c.type === 'formula' ? W.computedBadge : c.required ? W.required : W.optional) + '</span></div>').join('') +
      (k.model.workflow ? '<p><span class="caps">' + esc(W.workflow) + '</span><br>' + k.model.workflow.transitions.map((t) => esc([t.from].flat().join(' | ') + ' → ' + t.to + (t.if ? ' (' + t.if + ')' : ''))).join('<br>') + '</p>' : '') +
      (k.model.path ? '<p><span class="caps">' + esc(W.rangement) + '</span><br><code class="url">' + esc(k.model.path) + '</code></p>' : ''),
      '<a class="badge" href="#/entree/' + esc(k.model.id) + '">' + esc(W.fullEntry) + '</a>');
  }));
  root.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', async () => {
    const k = (await api(inSpace('/kinds'))).find((one) => one.kind === b.dataset.add);
    if (!k || !k.model) return;
    const fields = k.model.fields.filter((c) => !['list', 'formula', 'lines', 'button'].includes(c.type));
    const targets = {};
    for (const c of fields) if (c.type === 'link' && c.target) targets[c.name] = await api(inSpace('/entries?limit=200&kind=' + encodeURIComponent(c.target)));
    const files = fields.some((c) => c.type === 'file') ? await api(inSpace('/files')) : [];
    const input = (c) => {
      const id = 'f_' + c.name;
      if (c.type === 'link') return '<select id="' + id + '"' + (c.cardinality === 'many' ? ' multiple' : '') + '><option value=""></option>' + (targets[c.name] || []).map((o) => '<option value="' + esc(o.id) + '">' + esc(o.title) + '</option>').join('') + '</select>';
      if (c.type === 'choice') return '<select id="' + id + '"><option value=""></option>' + c.options.map((o) => '<option value="' + esc(o) + '">' + esc(optionLabelOf(k.model, c.name, o)) + '</option>').join('') + '</select>';
      if (c.type === 'boolean') return '<select id="' + id + '"><option value=""></option><option value="true">✓</option><option value="false">—</option></select>';
      // The types of every day (spec 016).
      if (c.type === 'multi_choice') return '<div id="' + id + '" class="checks">' + c.options.map((o) => '<label class="check"><input type="checkbox" value="' + esc(o) + '"> ' + esc(optionLabelOf(k.model, c.name, o)) + '</label>').join('') + '</div>';
      if (c.type === 'rating') return '<select id="' + id + '"><option value=""></option>' + Array.from({ length: (typeof c.max === 'number' ? c.max : 5) + 1 }, (_, n) => '<option value="' + n + '">' + ('★'.repeat(n) || '0') + '</option>').join('') + '</select>';
      if (c.type === 'progress') return '<input id="' + id + '" type="number" min="0" max="100" step="1" placeholder="0–100">';
      if (c.type === 'long_text') return '<textarea id="' + id + '" rows="4"></textarea>';
      if (c.type === 'file') return '<select id="' + id + '"><option value=""></option>' + files.map((f) => '<option value="' + esc(f.entryId) + '">' + esc(f.name) + '</option>').join('') + '</select>';
      if (c.type === 'location') return '<div id="' + id + '" class="loc"><input data-part="address" placeholder="' + esc(W.address) + '"><input data-part="lat" type="number" step="any" placeholder="lat"><input data-part="lng" type="number" step="any" placeholder="lng"><button type="button" class="quiet mini" data-here>' + esc(W.here) + '</button></div>';
      const type = c.type === 'date' ? 'date' : c.type === 'datetime' ? 'datetime-local' : c.type === 'time' ? 'time' : c.type === 'url' ? 'url' : c.type === 'email' ? 'email' : c.type === 'phone' ? 'tel' : ['number', 'amount'].includes(c.type) ? 'number' : 'text';
      return '<input id="' + id + '" type="' + type + '"' + (type === 'number' ? ' step="any"' : '') + '>';
    };
    openDrawer(say(W.addOne, { kind: kindLabel(k) }), '<div class="form-field"><label>' + esc(W.title) + ' *</label><input id="f__title"></div>' +
      fields.map((c) => '<div class="form-field"><label>' + esc(fieldLabelOf(k.model, c.name) + (c.required ? ' *' : '') + (c.unit ? ' · ' + c.unit : '')) + '</label>' + input(c) + '</div>').join('') + '<p class="error-text" id="f__error"></p>',
      '<button class="quiet" data-close>' + esc(W.cancel) + '</button><button id="f__save">' + esc(W.save) + '</button>');
    document.querySelectorAll('[data-here]').forEach((b) => b.addEventListener('click', () => {
      const box = b.parentElement;
      navigator.geolocation.getCurrentPosition((p) => {
        box.querySelector('[data-part=lat]').value = p.coords.latitude.toFixed(6);
        box.querySelector('[data-part=lng]').value = p.coords.longitude.toFixed(6);
      }, (e) => alert(e.message));
    }));
    document.getElementById('f__save').addEventListener('click', async () => {
      const data = {};
      for (const c of fields) {
        const el = document.getElementById('f_' + c.name);
        if (c.type === 'multi_choice') {
          const picked = [...el.querySelectorAll('input:checked')].map((i) => i.value);
          if (picked.length) data[c.name] = picked;
          continue;
        }
        if (c.type === 'location') {
          const part = (n) => el.querySelector('[data-part=' + n + ']').value.trim();
          if (part('lat') && part('lng')) data[c.name] = Object.assign({ lat: Number(part('lat')), lng: Number(part('lng')) }, part('address') ? { address: part('address') } : {});
          continue;
        }
        if (c.type === 'link' && c.cardinality === 'many') {
          const picked = [...el.selectedOptions].map((o) => o.value).filter(Boolean);
          if (picked.length) data[c.name] = picked;
          continue;
        }
        const v = el.value;
        if (v === '') continue;
        data[c.name] = ['number', 'amount', 'rating', 'progress'].includes(c.type) ? Number(v) : c.type === 'boolean' ? v === 'true' : v;
      }
      try {
        await api(inSpace('/save'), { method: 'POST', body: { entries: [{ kind: k.kind, title: document.getElementById('f__title').value.trim(), data }] } });
        closeDrawer(); toast(say(W.added1, { kind: k.kind }), null); show();
      } catch (error) { document.getElementById('f__error').textContent = error.message; }
    });
  }));
  // Sharing a collection (spec 016): a public form, or a view to read; the link is shown once.
  root.querySelectorAll('[data-share]').forEach((b) => b.addEventListener('click', async () => {
    const kind = b.dataset.share;
    const k = (await api(inSpace('/kinds'))).find((one) => one.kind === kind);
    const shares = (await api(inSpace('/shares'))).filter((one) => one.kind === kind || (one.view && one.view.kind === kind));
    const askable = k.model.fields.filter((c) => !['link', 'formula', 'lines', 'button', 'file', 'location', 'list'].includes(c.type));
    openDrawer(W.share, '<p class="muted">' + esc(W.shareLead) + '</p>' +
      '<div class="form-field"><label>' + esc(W.shareName) + '</label><input id="sh_name" value="' + esc(kindLabel(k)) + '"></div>' +
      '<div class="form-field"><label>' + esc(W.shareMode) + '</label><select id="sh_mode"><option value="form">' + esc(W.shareForm) + '</option><option value="view">' + esc(W.shareView) + '</option></select></div>' +
      '<div class="form-field" id="sh_fields"><label>' + esc(W.shareFields) + '</label>' + askable.map((c) => '<label class="check"><input type="checkbox" value="' + esc(c.name) + '" checked> ' + esc(fieldLabelOf(k.model, c.name)) + '</label>').join('') + '</div>' +
      '<div id="sh_link"></div>' +
      (shares.length ? '<h3 style="margin:14px 0 6px">' + esc(W.shareOpen) + '</h3><ul class="list">' + shares.map((one) => '<li><span>' + esc(one.title) + ' <span class="muted">· ' + esc(one.mode === 'form' ? W.shareForm : W.shareView) + '</span></span><button class="quiet mini" data-unshare="' + esc(one.id) + '">' + esc(W.shareClose) + '</button></li>').join('') + '</ul>' : '') +
      '<p class="error-text" id="sh_error"></p>',
      '<button class="quiet" data-close>' + esc(W.cancel) + '</button><button id="sh_make">' + esc(W.shareMake) + '</button>');
    const mode = document.getElementById('sh_mode');
    mode.onchange = () => { document.getElementById('sh_fields').style.display = mode.value === 'form' ? '' : 'none'; };
    document.querySelectorAll('[data-unshare]').forEach((x) => x.addEventListener('click', async () => {
      await api(inSpace('/save'), { method: 'POST', body: { entries: [{ id: x.dataset.unshare, data: { active: false } }] } });
      x.closest('li').remove();
    }));
    document.getElementById('sh_make').addEventListener('click', async () => {
      const ex = explorerNow;
      const data = mode.value === 'form'
        ? { mode: 'form', kind, fields: [...document.querySelectorAll('#sh_fields input:checked')].map((i) => i.value) }
        : { mode: 'view', view: Object.assign({}, ex && ex.kind === kind ? ex.r.view : { kind }, { kind }) };
      try {
        const made = await api(inSpace('/shares'), { method: 'POST', body: { name: document.getElementById('sh_name').value, data } });
        document.getElementById('sh_link').innerHTML = '<p class="badge read" style="white-space:normal">' + esc(W.shareOnce) + '</p><p><code class="url">' + esc(made.link) + '</code></p>';
      } catch (error) { document.getElementById('sh_error').textContent = error.message; }
    });
  }));
  const sub = document.getElementById('subscribe');
  if (sub) sub.addEventListener('click', async () => {
    if (sub.dataset.done && !confirm(W.subscribeAsk)) return;
    try {
      const made = await api('/agenda/address', { method: 'POST', body: {} });
      document.getElementById('address').innerHTML = '<p><code class="url">' + esc(made.url) + '</code></p><div class="actions"><button class="quiet" id="copy-address">' + esc(W.copy) + '</button><a class="badge primary" href="' + esc(made.webcal) + '">' + esc(W.openPhone) + '</a></div>';
      document.getElementById('copy-address').addEventListener('click', async (e) => { await navigator.clipboard.writeText(made.url); e.target.textContent = W.copied; });
      sub.textContent = W.subscribeRenew; sub.dataset.done = '1';
    } catch (error) { alert(error.message); }
  });
  const out = document.getElementById('sign-out');
  if (out) out.addEventListener('click', async () => {
    await fetch('/auth/sign-out', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' });
    location.href = '/connexion';
  });
}

function choose(id, again) {
  space = id; try { localStorage.setItem('jarvis.space', id); } catch {}
  drawApps().catch(() => undefined);
  document.getElementById('space').value = id;
  if (again !== false) show();
}

async function load() {
  me = await api('/me');
  if (!space || !me.spaces.some((s) => s.id === space)) space = me.space.id;
  const select = document.getElementById('space');
  select.innerHTML = me.spaces.map((s) => '<option value="' + esc(s.id) + '">' + esc(s.name) + ' — ' + esc(s.personal ? W.own : W.shared) + '</option>').join('');
  select.value = space;
  document.getElementById('who').innerHTML = '<strong>' + esc(me.person.name) + '</strong><div class="muted" style="overflow-wrap:anywhere">' + esc(me.person.email) + '</div>';
}

document.getElementById('space').addEventListener('change', (event) => choose(event.target.value));
document.getElementById('search').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') location.hash = '#/vie?q=' + encodeURIComponent(event.target.value.trim());
});
document.getElementById('menu').addEventListener('click', () => document.querySelector('.shell').classList.toggle('open'));
window.addEventListener('hashchange', show);
load().then(() => { clock(); return drawApps(); }).then(show).catch(fail);
`;

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
<style>${brandCss}${css}${css2}${css3}</style></head>
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
