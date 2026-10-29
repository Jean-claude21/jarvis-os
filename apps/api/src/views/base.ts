// The base of Jarvis's views (spec 005, decision 0006): one design system — the author's brand,
// Kete (its earth reds, Archivo and Instrument Sans, sharp corners) — light and dark, following the
// host's theme; and the bridge that speaks MCP Apps with the host. Plain HTML and a small script:
// no build step, served by the server itself.

/** The MIME type of an MCP Apps view (extension `io.modelcontextprotocol/ui`, 2026-01-26). */
export const VIEW_MIME = 'text/html;profile=mcp-app';

/** Where the brand's fonts come from: declared in each view's content security policy. */
export const FONT_DOMAINS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

const css = `
:root {
  color-scheme: light;
  --paper: #fffdf9; --sand: #fbf6f0; --clay: #f4e6da; --rule: #d9c4b4; --rule-strong: #b9a294;
  --ink: #2a1610; --bark: #6b4e43; --primary: #b83a1b; --primary-strong: #962e14; --ember: #e2572d;
  --ochre: #c98a2b; --on-primary: #fffdf9;
  --success: #2f7d4f; --success-surface: #e3f1e8; --verify: #7a4a0b; --verify-surface: #fbebd0;
  --error: #9b1c3c; --error-surface: #f7e1e7; --info: #2b5c8a; --info-surface: #e2ecf5;
  --series: #b83a1b, #c98a2b, #2b5c8a, #2f7d4f, #6b4e43;
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --paper: #17100c; --sand: #221813; --clay: #2c2019; --rule: #4a382e; --rule-strong: #7a6356;
  --ink: #f4e6da; --bark: #bfa799; --primary: #f08a63; --primary-strong: #e2572d; --ember: #f08a63;
  --ochre: #d9a04a; --on-primary: #17100c;
  --success: #4fa873; --success-surface: #1c3025; --verify: #f2cc8a; --verify-surface: #3a2a12;
  --error: #d0546f; --error-surface: #3e1620; --info: #5c8fc2; --info-surface: #172a3d;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  color-scheme: dark;
  --paper: #17100c; --sand: #221813; --clay: #2c2019; --rule: #4a382e; --rule-strong: #7a6356;
  --ink: #f4e6da; --bark: #bfa799; --primary: #f08a63; --primary-strong: #e2572d; --ember: #f08a63;
  --ochre: #d9a04a; --on-primary: #17100c;
  --success: #4fa873; --success-surface: #1c3025; --verify: #f2cc8a; --verify-surface: #3a2a12;
  --error: #d0546f; --error-surface: #3e1620; --info: #5c8fc2; --info-surface: #172a3d;
} }
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--paper); color: var(--ink); }
body { font: 400 14px/1.5 "Instrument Sans", system-ui, -apple-system, "Segoe UI", sans-serif; padding: 16px; }
h1, h2, h3 { font-family: Archivo, "Instrument Sans", system-ui, sans-serif; margin: 0; letter-spacing: -0.01em; }
h1 { font-size: 20px; font-weight: 700; }
h2 { font-size: 15px; font-weight: 600; }
.caps { font: 600 11px/1.4 Archivo, system-ui, sans-serif; letter-spacing: 0.12em; text-transform: uppercase; color: var(--bark); }
.muted { color: var(--bark); }
.num { font-family: "JetBrains Mono", ui-monospace, monospace; font-variant-numeric: tabular-nums; }
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.head .meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 4px; }
.grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
.card { background: var(--paper); border: 1px solid var(--rule); border-radius: 2px; padding: 14px 16px; min-width: 0; }
.card.wide { grid-column: 1 / -1; }
.card h2 { margin-bottom: 10px; }
.badge { display: inline-flex; align-items: center; gap: 6px; padding: 1px 8px; border-radius: 2px; font-size: 12px;
  background: var(--clay); color: var(--ink); white-space: nowrap; }
.badge.primary { background: var(--primary); color: var(--on-primary); }
.badge.said { background: var(--success-surface); color: var(--success); }
.badge.read { background: var(--verify-surface); color: var(--verify); }
.badge.inferred { background: var(--info-surface); color: var(--info); }
.badge.error { background: var(--error-surface); color: var(--error); }
.kpi { font: 600 32px/1.1 "JetBrains Mono", ui-monospace, monospace; letter-spacing: -0.02em; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font: 600 11px/1.4 Archivo, system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--bark); padding: 6px 8px; border-bottom: 1px solid var(--rule-strong); }
td { padding: 7px 8px; border-bottom: 1px dotted var(--rule); vertical-align: top; overflow-wrap: anywhere; }
td.n, th.n { text-align: right; }
.scroll { overflow-x: auto; }
button { font: 600 13px/1 "Instrument Sans", system-ui, sans-serif; padding: 8px 12px; border-radius: 2px; cursor: pointer;
  border: 1px solid var(--ink); background: var(--ink); color: var(--paper); }
button.quiet { background: transparent; color: var(--ink); border-color: var(--rule-strong); }
button:disabled { opacity: 0.5; cursor: default; }
.error-text { color: var(--error); }
.list { list-style: none; margin: 0; padding: 0; }
.list li { display: flex; gap: 10px; align-items: baseline; justify-content: space-between; padding: 8px 0; border-bottom: 1px dotted var(--rule); }
.list li:last-child { border-bottom: 0; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); flex: none; margin-top: 6px; }
svg text { fill: var(--bark); font: 11px "Instrument Sans", system-ui, sans-serif; }
.empty { padding: 24px 0; text-align: center; color: var(--bark); }
@media (max-width: 420px) { body { padding: 12px; } .kpi { font-size: 26px; } }
`;

/**
 * The bridge to the host (MCP Apps): `ui/initialize`, then the tool's input and result, the host's
 * theme and locale, calling the server's tools, and the view's size. Outside a host (a plain page),
 * it renders `window.JARVIS_DATA` when given.
 */
const bridge = `
const host = (() => {
  let next = 0; const pending = new Map(); const handlers = {};
  window.addEventListener('message', (event) => {
    const m = event.data;
    if (!m || m.jsonrpc !== '2.0') return;
    if (m.id !== undefined && !m.method && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      if (m.error) p.reject(new Error(m.error.message || 'error')); else p.resolve(m.result);
      return;
    }
    if (m.method && handlers[m.method]) handlers[m.method](m.params || {});
    if (m.method && m.id !== undefined) parent.postMessage({ jsonrpc: '2.0', id: m.id, result: {} }, '*');
  });
  const request = (method, params) => new Promise((resolve, reject) => {
    const id = ++next; pending.set(id, { resolve, reject });
    parent.postMessage({ jsonrpc: '2.0', id, method, params }, '*');
  });
  const notify = (method, params) => parent.postMessage({ jsonrpc: '2.0', method, params }, '*');
  return { request, notify, on: (method, fn) => { handlers[method] = fn; }, inside: window.parent !== window };
})();
let words = WORDS.fr;
function context(ctx) {
  if (!ctx) return;
  if (ctx.theme) document.documentElement.dataset.theme = ctx.theme;
  if (ctx.locale) words = String(ctx.locale).toLowerCase().startsWith('en') ? WORDS.en : WORDS.fr;
}
async function callTool(name, args) {
  const result = await host.request('tools/call', { name, arguments: args || {} });
  if (result && result.isError) {
    const text = result.content && result.content[0] && result.content[0].text;
    let message = text; try { message = JSON.parse(text).error || text; } catch {}
    throw new Error(message);
  }
  return result && result.structuredContent;
}
function tellModel(text, data) {
  host.request('ui/update-model-context', { content: [{ type: 'text', text }], structuredContent: data }).catch(() => {});
}
function start(render) {
  host.on('ui/notifications/tool-result', (result) => render(result.structuredContent || null));
  host.on('ui/notifications/host-context-changed', (ctx) => context(ctx));
  new ResizeObserver(() => host.notify('ui/notifications/size-changed', {
    width: Math.ceil(document.documentElement.scrollWidth), height: Math.ceil(document.documentElement.scrollHeight) })).observe(document.body);
  if (!host.inside) { render(window.JARVIS_DATA || null); return; }
  host.request('ui/initialize', { protocolVersion: '2026-01-26', capabilities: {},
    clientInfo: { name: 'jarvis-os-view', version: '0.5.0' }, appCapabilities: { availableDisplayModes: ['inline'] } })
    .then((init) => { context(init && init.hostContext); host.notify('ui/notifications/initialized', {}); })
    .catch(() => {});
}
const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
const say = (text, values) => String(text).replace(/\\{(\\w+)\\}/g, (_, key) => (values && values[key] != null ? values[key] : ''));
`;

const escape = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)}`);

/** A view's page: the brand, the bridge, its words in French and English, its own script. */
export function viewPage(input: {
  title: string;
  words: { fr: Record<string, string>; en: Record<string, string> };
  script: string;
  /** For a plain page outside a host: what the view shows at once. */
  data?: unknown;
}): string {
  const data =
    input.data === undefined
      ? ''
      : `window.JARVIS_DATA = ${JSON.stringify(input.data).replace(/</g, '\\u003c')};`;
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(input.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700&family=Instrument+Sans:wght@400;600&family=JetBrains+Mono:wght@600&display=swap">
<style>${css}</style></head>
<body><main id="root"><p class="empty">…</p></main>
<script>
${data}
const WORDS = ${JSON.stringify(input.words)};
${bridge}
${input.script}
</script></body></html>`;
}
