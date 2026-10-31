// The styles of her web account, over the brand (`../../views/base`).

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
pre.brief { white-space: pre-wrap; font-family: inherit; font-size: 14px; line-height: 1.6; margin: 0; }
.drop-on { outline: 2px dashed var(--primary); outline-offset: -2px; background: var(--clay); }
[draggable=true] { cursor: grab; }
.habit .kpi small { font-size: 14px; }
.habit .bar { height: 6px; background: var(--clay); border-radius: 1px; margin-top: 8px; overflow: hidden; }
.habit .bar i { display: block; height: 100%; background: var(--success); }
.linkpick { display: grid; gap: 4px; margin-top: 10px; }
.linkpick button { text-align: left; }
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

export const appCss = css + css2 + css3;
