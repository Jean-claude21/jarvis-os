// The pages of her settings: journal, spaces, connections, data, account.
// Part of the script of her web account (see `../page.ts`): plain browser JavaScript inside a
// template literal — no `${`, and every backslash written twice.

export const settingsPages = `
const settingsPages = {
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

  async connexions (params) {
    // Two directions (spec 025): assistants come to Jarvis; Jarvis goes to her tools for them.
    const list = await api('/connections');
    const tools = await api('/connectors');
    const catalog = await api('/connectors/catalog');
    const spaces = me.spaces;
    const tab = params.get('tab') || (tools.length ? 'outils' : 'decouvrir');
    const logo = (l) => '<span class="logo" style="background:#' + esc(l.hex) + ';color:' + esc(l.fg) + '">' +
      (l.path ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + esc(l.path) + '"/></svg>' : esc(l.initial)) + '</span>';
    const known = (t) => catalog.find((e) => e.url && e.url === t.url);
    const logoOfTool = (t) => { const e = known(t); return logo(e ? e.logo : { hex: '6B4E43', fg: '#ffffff', path: null, initial: (t.name || '?').slice(0, 1) }); };
    const tabs = '<nav class="tabs" role="tablist">' + [['assistants', W.conTabAssistants, list.length], ['outils', W.conTabTools, tools.length], ['decouvrir', W.conTabDiscover, null]]
      .map(([id, label, n]) => '<a href="#/connexions?tab=' + id + '" class="' + (tab === id ? 'on' : '') + '" role="tab">' + esc(label) + (n === null ? '' : ' <span class="n">' + n + '</span>') + '</a>').join('') + '</nav>';
    const flow = '<div class="flow" aria-label="' + esc(W.conFlowLabel) + '"><span class="flow-node">' + esc(W.conFlowAssistants) + '</span><span class="flow-arrow" aria-hidden="true">→</span><span class="flow-node main">Jarvis</span><span class="flow-arrow" aria-hidden="true">→</span><span class="flow-node">' + esc(W.conFlowTools) + '</span></div>' +
      '<p class="muted flow-lead">' + esc(W.conFlowLead) + '</p>';

    let body = '';
    if (tab === 'assistants') {
      body = card('', '<p class="muted" style="margin:0 0 8px">' + esc(W.connectLead) + '</p><div class="actions"><code class="url">' + esc(location.origin + '/mcp') + '</code><button class="quiet" data-copy="' + esc(location.origin + '/mcp') + '">' + esc(W.copy) + '</button></div>', true) +
        (list.length ? '<section class="grid">' + list.map((c) => card(c.name || c.clientId,
          '<p class="muted" style="margin:0 0 8px">' + esc(say(W.since, { date: day(c.since) })) + (c.used ? ' · ' + esc(say(W.lastUsed, { date: time(c.used) })) : '') + '</p>' +
          '<p class="state ' + (c.contextReadAt ? 'connected' : 'needs_sign_in') + '" style="margin:0 0 10px">' + esc(c.contextReadAt ? say(W.contextRead, { date: time(c.contextReadAt) }) : W.contextNotRead) + '</p>' +
          '<form data-reach="' + esc(c.clientId) + '"><div class="caps">' + esc(W.reach) + '</div>' + spaces.map((s) => '<label style="display:flex;gap:8px;align-items:center;padding:4px 0"><input type="checkbox" value="' + esc(s.id) + '"' + (c.spaces.includes(s.id) ? ' checked' : '') + '> ' + esc(s.name) + '</label>').join('') +
          '<div class="actions" style="margin-top:8px"><button>' + esc(W.save) + '</button><button type="button" class="quiet" data-revoke="' + esc(c.clientId) + '" data-name="' + esc(c.name || c.clientId) + '">' + esc(W.revoke) + '</button></div></form>')).join('') + '</section>' : card('', empty(W.noConnections)));
    } else if (tab === 'outils') {
      body = tools.length ? '<section class="tools">' + tools.map((t) => '<article class="tool">' +
        '<div class="tool-head">' + logoOfTool(t) + '<div class="tool-title"><h3>' + esc(t.name) + '</h3><span class="state ' + esc(t.state) + '">' + esc(W['con_' + t.state] || t.state) + '</span></div></div>' +
        (t.reason && t.state !== 'needs_sign_in' && t.state !== 'connected' ? '<p class="tool-reason">' + esc(t.reason) + '</p>' : '') +
        '<p class="tool-meta">' + esc(t.serverName || t.url) + (t.checkedAt ? ' · ' + esc(say(W.conChecked, { date: time(t.checkedAt) })) : '') + '</p>' +
        (t.tools.length ? '<details class="tool-list"><summary>' + esc(say(W.conTools, { n: t.tools.length })) + '</summary><ul>' + t.tools.map((o) => '<li><b>' + esc(o.name) + '</b>' + (o.description ? ' — ' + esc(String(o.description).split('\\n')[0]) : '') + '</li>').join('') + '</ul></details>' : '') +
        '<div class="tool-go">' + (t.state === 'needs_sign_in' ? '<button data-con-signin="' + esc(t.id) + '">' + esc(W.conSignIn) + '</button>' : '') +
        '<button class="quiet" data-con-check="' + esc(t.id) + '">' + esc(W.conCheck) + '</button><button type="button" class="quiet" data-con-cut="' + esc(t.id) + '" data-name="' + esc(t.name) + '">' + esc(W.conCut) + '</button></div></article>').join('') + '</section>'
        : card('', empty(W.conNone) + '<div class="actions"><a href="#/connexions?tab=decouvrir"><button type="button">' + esc(W.conTabDiscover) + '</button></a></div>');
    } else {
      const groups = ['everyday', 'files', 'money', 'work', 'design'];
      const shown = catalog.filter((e) => !tools.some((t) => e.url && t.url === e.url));
      body = groups.map((g) => {
        const here = shown.filter((e) => e.group === g);
        if (!here.length) return '';
        return '<h2 class="caps tools-group">' + esc(W['conGroup_' + g] || g) + '</h2><section class="tools">' + here.map((e) => '<article class="tool">' +
          '<div class="tool-head">' + logo(e.logo) + '<div class="tool-title"><h3>' + esc(e.name) + '</h3><span class="way">' + esc(e.url ? W['conWay_' + e.auth] : W.conWay_url) + '</span></div></div>' +
          '<p class="tool-text">' + esc(LANG === 'en' ? e.en : e.fr) + '</p>' +
          (e.ready
            ? '<form class="tool-form" data-con-pick="' + esc(e.id) + '" data-name="' + esc(e.name) + '" data-url="' + esc(e.url) + '" data-auth="' + esc(e.auth) + '">' +
              (e.url ? '' : '<input class="field" name="url" type="url" required placeholder="https://…" aria-label="' + esc(W.conUrl) + '">') +
              (e.auth === 'bearer' ? '<input class="field" name="secret" type="password" required autocomplete="off" placeholder="' + esc(W.conKey) + '" aria-label="' + esc(W.conKey) + '">' : '') +
              '<div class="tool-go"><button>' + esc(e.auth === 'oauth' ? W.conPickSignIn : W.conPick) + '</button>' +
              (e.help ? '<a class="tool-help" href="' + esc(e.help) + '" target="_blank" rel="noopener">' + esc(e.url ? W.conWhereKey : W.conWhereUrl) + '</a>' : '') + '</div></form>'
            : '<p class="tool-wait">' + esc(W.conNeedsGoogle) + '</p>') +
          '</article>').join('') + '</section>';
      }).join('') +
      '<div class="actions" style="margin:20px 0 8px"><button class="quiet" id="con-custom">' + esc(W.conCustom) + '</button></div>' +
      '<div id="con-custom-box" hidden>' +
      card(W.conAdd, '<p class="muted">' + esc(W.conLead) + '</p><form id="con-add" class="tool-form wide">' +
        '<label class="caps">' + esc(W.conName) + '<input class="field" name="name" required maxlength="80"></label>' +
        '<label class="caps">' + esc(W.conUrl) + '<input class="field" name="url" type="url" required placeholder="https://…/mcp"></label>' +
        '<label class="caps">' + esc(W.conAuth) + '<select class="field" name="auth"><option value="none">' + esc(W.conAuthNone) + '</option><option value="oauth">' + esc(W.conAuthOauth) + '</option><option value="bearer">' + esc(W.conAuthBearer) + '</option><option value="header">' + esc(W.conAuthHeader) + '</option></select></label>' +
        '<label class="caps">' + esc(W.conHeader) + '<input class="field" name="headerName" placeholder="x-api-key"></label>' +
        '<label class="caps">' + esc(W.conKey) + '<input class="field" name="secret" type="password" autocomplete="off"></label>' +
        '<div class="tool-go"><button>' + esc(W.conConnect) + '</button></div></form>', true) +
      '</div>';
    }
    return flow + tabs + body;
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
    const pref = await prefsNow();
    const linked = Boolean(channel && channel.data.telegram);
    return '<section class="grid">' + card(W.accountTitle, '<div class="field-row"><span class="caps">' + esc(W.name) + '</span><span>' + esc(me.person.name) + '</span><span></span></div>' +
      '<div class="field-row"><span class="caps">' + esc(W.email) + '</span><span>' + esc(me.person.email) + '</span><span></span></div>' +
      '<div class="actions" style="margin-top:14px"><button class="quiet" id="sign-out">' + esc(W.signOut) + '</button></div>') +
      card(W.zoneTitle, '<p class="muted">' + esc(W.zoneLead) + '</p><div class="form-field"><select id="zone">' + zones.map((z) => '<option' + (z === zone ? ' selected' : '') + '>' + esc(z) + '</option>').join('') + '</select></div>') +
      card(W.telegramTitle, '<p class="badge ' + (channel && channel.data.telegram ? 'said' : 'error') + '" style="white-space:normal">' + esc(channel && channel.data.telegram ? W.channelOn : W.channelOff) + '</p><p class="muted">' + esc(W.telegramLead) + '</p><div id="tg"></div><div class="actions"><button id="tg-link">' + esc(channel && channel.data.telegram ? W.telegramAgain : W.telegramLink) + '</button></div>') +
      card(W.briefTitle, '<p class="muted">' + esc(W.briefLead) + '</p><div class="form-field"><label class="caps" for="brief-at">' + esc(W.briefAt) + '</label> <input type="time" class="field" id="brief-at" value="' + esc(pref.brief || '') + '"> <button class="quiet" id="brief-off"' + (pref.brief ? '' : ' disabled') + '>' + esc(W.briefNone) + '</button></div>' +
        (linked ? '' : '<p class="muted">' + esc(W.briefNeedsTelegram) + '</p>') +
        '<div class="actions"><button class="quiet" id="brief-show">' + esc(W.briefShow) + '</button>' + (linked ? '<button id="brief-send">' + esc(W.briefSend) + '</button>' : '') + '</div>') +
      card(W.keysTitle, '<p class="muted">' + esc(W.keysLead) + '</p><div id="newkey"></div>' +
        (keys.length ? '<ul class="list">' + keys.map((k) => '<li><span>' + esc(k.name) + ' <span class="muted">· ' + esc(say(W.keyMade, { day: day(k.createdAt) })) + (k.lastUsedAt ? ' · ' + esc(say(W.keyUsed, { day: day(k.lastUsedAt) })) : '') + '</span></span><button class="quiet" data-revoke="' + esc(k.id) + '">' + esc(W.keyRevoke) + '</button></li>').join('') + '</ul>' : '') +
        '<div class="actions"><button id="key-new">' + esc(W.keyNew) + '</button></div>') +
      '</section>';
  },
};
`;
