// Spec 083 — « Bilans »: her reviews of any kind and any period. Each is an entry « Bilan » (its type,
// its days, its text in Markdown) read in the document reader (tables, callouts, diagrams). A new one
// is prepared here — a type (her skills that make a « Bilan »), a period — and the assistant writes
// it (base routine « Les bilans »).
// Part of the script of her web account (see `../page.ts`): plain browser JavaScript inside a
// template literal — no backticks, no dollar-brace, and no backslashes.

export const v2Bilans = `
let blType = 'all';
let blPeriod = 'all';
const blDay = (d) => d.toLocaleDateString('en-CA');
const blSpan = (e) => {
  const f = e.data.from; const t = e.data.to;
  const fmt = (x, year) => new Date(x + 'T12:00:00').toLocaleDateString(locale, year ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' });
  return f && t ? say(W.blFromTo, { from: fmt(f, false), to: fmt(t, true) }) : f ? fmt(f, true) : day(e.createdAt);
};
Object.assign(v2Pages, {
  async bilans () {
    const lists = await Promise.all(me.spaces.map((s) => api('/entries?kind=Bilan&limit=200&space=' + encodeURIComponent(s.id)).then((l) => l.map((e) => Object.assign(e, { spaceId: s.id }))).catch(() => [])));
    const typeOf = (e) => String(e.data.type || e.data.skill || W.blFree);
    const endOf = (e) => String(e.data.to || e.data.from || e.createdAt).slice(0, 10);
    const all = lists.flat().sort((a, b) => endOf(b).localeCompare(endOf(a)));
    const types = [...new Set(all.map(typeOf))];
    const since = blPeriod === 'all' ? '' : blDay(new Date(Date.now() - Number(blPeriod) * 86400000));
    const shown = all.filter((e) => (blType === 'all' || typeOf(e) === blType) && (!since || endOf(e) >= since));
    const row = (e) => {
      const todo = e.data.status === 'to_write';
      const size = String(e.data.text || '').length;
      return '<a class="bl-row" href="#/document/' + esc(e.id) + '" data-space="' + esc(e.spaceId) + '"><span class="bl-ic">' + ic('i-doc') + '</span>' +
        '<span class="bl-main"><span class="t">' + esc(e.title) + '</span><span class="s">' + esc(blSpan(e)) + (size ? ' · ' + esc(say(W.chars, { n: num(size) })) : '') + '</span></span>' +
        '<span class="bl-meta"><span class="dt-tag">' + esc(typeOf(e)) + '</span>' + (todo ? '<span class="tag info">' + esc(W.blToWrite) + '</span>' : '') +
        '<span class="sk-space"><span class="space-dot" style="background:' + spaceColorOf(e.spaceId) + '"></span></span></span></a>';
    };
    const periods = [['all', W.blAll], ['30', W.bl30], ['90', W.bl90], ['365', W.bl365]];
    const bar = '<div class="nw-head"><div class="bl-chips"><button class="chip" data-bl-type="all" aria-pressed="' + (blType === 'all') + '">' + esc(W.blAllTypes) + ' <span class="n">' + all.length + '</span></button>' +
      types.map((t) => '<button class="chip" data-bl-type="' + esc(t) + '" aria-pressed="' + (blType === t) + '">' + esc(t) + ' <span class="n">' + all.filter((e) => typeOf(e) === t).length + '</span></button>').join('') + '</div>' +
      '<div class="segmented">' + periods.map((p) => '<button data-bl-period="' + p[0] + '" aria-pressed="' + (blPeriod === p[0]) + '">' + esc(p[1]) + '</button>').join('') + '</div></div>';
    const body = shown.length ? '<div class="sk-list">' + shown.map(row).join('') + '</div>'
      : '<div class="sk-empty"><b>' + esc(all.length ? W.blNoneHere : W.blNoneTitle) + '</b><p>' + esc(W.blNoneLead) + '</p><button class="btn solid" data-bl-new>' + ic('i-plus') + esc(W.blNew) + '</button></div>';
    return v2head(esc(W.navBilans), esc(W.blLead), '<a class="btn" href="#/skills">' + ic('i-spark') + esc(W.navSkills) + '</a><button class="btn solid" data-bl-new>' + ic('i-plus') + esc(W.blNew) + '</button>') +
      '<section class="panel sk-panel">' + bar + body + '</section>';
  },
});

function bindBilans(root) {
  root.querySelectorAll('[data-bl-type]').forEach((b) => b.addEventListener('click', () => { blType = b.dataset.blType; show(); }));
  root.querySelectorAll('[data-bl-period]').forEach((b) => b.addEventListener('click', () => { blPeriod = b.dataset.blPeriod; show(); }));
  root.querySelectorAll('[data-bl-new]').forEach((b) => b.addEventListener('click', () => blNew()));
}

// A new review: its type (her skills that make a « Bilan »), its period; the assistant writes it.
async function blNew() {
  let skills = [];
  try { skills = (await api('/skills')).mine.filter((s) => String(s.result || '').toLowerCase() === 'bilan'); } catch {}
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const add = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const presets = {
    week: [monday, add(monday, 6)],
    lastweek: [add(monday, -7), add(monday, -1)],
    month: [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 0)],
    lastmonth: [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 0)],
  };
  const f = (label, html) => '<label style="display:grid;gap:6px;font-weight:600;font-size:13px">' + esc(label) + html + '</label>';
  openDrawer(W.blNew,
    f(W.blType, '<select class="field" id="bl-type">' + skills.map((s) => '<option value="' + esc(s.title) + '">' + esc(s.title) + '</option>').join('') + '<option value="">' + esc(W.blFree) + '</option></select>' + (skills.length ? '' : '<small class="muted" style="font-weight:400">' + esc(W.blNoSkill) + '</small>')) +
    f(W.blPeriodL, '<div class="segmented" id="bl-presets">' + [['week', W.blWeek], ['lastweek', W.blLastWeek], ['month', W.blMonth], ['lastmonth', W.blLastMonth]].map((p, i) => '<button type="button" data-preset="' + p[0] + '" aria-pressed="' + (i === 1) + '">' + esc(p[1]) + '</button>').join('') + '</div>') +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' + f(W.blFrom, '<input class="field" type="date" id="bl-from" value="' + blDay(presets.lastweek[0]) + '">') + f(W.blTo, '<input class="field" type="date" id="bl-to" value="' + blDay(presets.lastweek[1]) + '">') + '</div>' +
    '<div class="hint">' + ic('i-spark') + '<span>' + esc(W.blHow) + '</span></div>',
    '<button class="btn solid" id="bl-save">' + ic('i-check') + esc(W.blPrepare) + '</button>');
  drawer().classList.add('pk');
  drawer().querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    const p = presets[b.dataset.preset];
    document.getElementById('bl-from').value = blDay(p[0]); document.getElementById('bl-to').value = blDay(p[1]);
    drawer().querySelectorAll('[data-preset]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  document.getElementById('bl-save').addEventListener('click', async () => {
    const type = document.getElementById('bl-type').value;
    const from = document.getElementById('bl-from').value; const to = document.getElementById('bl-to').value;
    if (!from || !to || to < from) { alert(W.blBadPeriod); return; }
    const e = { data: { from, to } };
    const title = (type || W.blFree) + ' — ' + blSpan(e);
    const data = { type: type || W.blFree, from, to, status: 'to_write' };
    if (type) data.skill = type;
    try {
      const saved = await api(inSpace('/save'), { method: 'POST', body: { entries: [{ kind: 'Bilan', title, data, origin: 'said' }] } });
      const ask = say(W.blAsk, { type: type || W.blFree, from: blSpan(e) });
      toast(W.blSaved, { id: saved.entries[0].id, spaceId: space });
      await show();
      openDrawer(W.blReady, '<p>' + esc(W.blReadyLead) + '</p><div class="pk-body" style="max-height:none">' + esc(ask) + '</div>', '<button class="btn solid" id="bl-copy">' + ic('i-link') + esc(W.blCopy) + '</button>');
      drawer().classList.add('pk');
      document.getElementById('bl-copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(ask); toast(W.pkCopied, null); } catch {} });
    } catch (error) { alert(error.message); }
  });
}
`;
