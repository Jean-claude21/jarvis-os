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

  async connexions () {
    const list = await api('/connections');
    const tools = await api('/connectors');
    const catalog = await api('/connectors/catalog');
    const spaces = me.spaces;
    return card('', '<p class="muted" style="margin:0 0 8px">' + esc(W.connectLead) + '</p><div class="actions"><code class="url">' + esc(location.origin + '/mcp') + '</code><button class="quiet" data-copy="' + esc(location.origin + '/mcp') + '">' + esc(W.copy) + '</button></div>', true) +
      '<h2 style="margin:20px 0 10px">' + esc(W.connections) + '</h2>' +
      (list.length ? '<section class="grid">' + list.map((c) => card(c.name || c.clientId,
        '<p class="muted" style="margin:0 0 8px">' + esc(say(W.since, { date: day(c.since) })) + (c.used ? ' · ' + esc(say(W.lastUsed, { date: time(c.used) })) : '') + '</p>' +
        '<form data-reach="' + esc(c.clientId) + '"><div class="caps">' + esc(W.reach) + '</div>' + spaces.map((s) => '<label style="display:flex;gap:8px;align-items:center;padding:4px 0"><input type="checkbox" value="' + esc(s.id) + '"' + (c.spaces.includes(s.id) ? ' checked' : '') + '> ' + esc(s.name) + '</label>').join('') +
        '<div class="actions" style="margin-top:8px"><button>' + esc(W.save) + '</button><button type="button" class="quiet" data-revoke="' + esc(c.clientId) + '" data-name="' + esc(c.name || c.clientId) + '">' + esc(W.revoke) + '</button></div></form>')).join('') + '</section>' : card('', empty(W.noConnections))) +
      // What Jarvis reaches for her (spec 025): any MCP server, its key or sign-in kept sealed.
      '<h2 style="margin:20px 0 10px">' + esc(W.conTitle) + '</h2>' +
      (tools.length ? '<section class="grid">' + tools.map((t) => card(t.name,
        '<p class="badge ' + (t.state === 'connected' ? 'said' : 'error') + '" style="white-space:normal">' + esc(W['con_' + t.state] || t.state) + (t.reason && t.state !== 'needs_sign_in' ? ' · ' + esc(t.reason) : '') + '</p>' +
        '<p class="muted" style="margin:6px 0">' + esc(t.url) + (t.serverName ? ' · ' + esc(t.serverName) : '') + (t.checkedAt ? ' · ' + esc(say(W.conChecked, { date: time(t.checkedAt) })) : '') + '</p>' +
        (t.tools.length ? '<div class="caps">' + esc(say(W.conTools, { n: t.tools.length })) + '</div><ul class="list">' + t.tools.map((o) => '<li><span>' + esc(o.name) + (o.description ? ' <span class="muted">· ' + esc(o.description) + '</span>' : '') + '</span></li>').join('') + '</ul>' : '') +
        '<div class="actions" style="margin-top:8px">' + (t.state === 'needs_sign_in' ? '<button data-con-signin="' + esc(t.id) + '">' + esc(W.conSignIn) + '</button>' : '') + '<button class="quiet" data-con-check="' + esc(t.id) + '">' + esc(W.conCheck) + '</button><button type="button" class="quiet" data-con-cut="' + esc(t.id) + '" data-name="' + esc(t.name) + '">' + esc(W.conCut) + '</button></div>')).join('') + '</section>' : card('', empty(W.conNone))) +
      // « Discover »: the servers their makers host, one click away; her own below.
      '<h2 style="margin:20px 0 6px">' + esc(W.conDiscover) + '</h2><p class="muted" style="margin:0 0 10px">' + esc(W.conDiscoverLead) + '</p>' +
      '<section class="grid">' + catalog.filter((e) => !tools.some((t) => e.url && t.url === e.url)).map((e) => card(e.name,
        '<p class="muted" style="margin:0 0 8px">' + esc(LANG === 'en' ? e.en : e.fr) + '</p>' +
        '<p class="caps" style="margin:0 0 8px">' + esc(W['conCat_' + e.category] || e.category) + ' · ' + esc(e.url ? W['conWay_' + e.auth] : W.conWay_url) + '</p>' +
        '<form class="stack" data-con-pick="' + esc(e.id) + '" data-name="' + esc(e.name) + '" data-url="' + esc(e.url) + '" data-auth="' + esc(e.auth) + '">' +
        (e.url ? '' : '<input class="field" name="url" type="url" required placeholder="https://…">') +
        (e.auth === 'bearer' ? '<input class="field" name="secret" type="password" required autocomplete="off" placeholder="' + esc(W.conKey) + '">' : '') +
        (e.help ? '<a class="muted" href="' + esc(e.help) + '" target="_blank" rel="noopener">' + esc(e.url ? W.conWhereKey : W.conWhereUrl) + '</a>' : '') +
        '<div class="actions"><button>' + esc(W.conPick) + '</button></div></form>')).join('') + '</section>' +
      '<div class="actions" style="margin:16px 0"><button class="quiet" id="con-custom">' + esc(W.conCustom) + '</button></div>' +
      '<section class="grid" id="con-custom-box" hidden>' +
      card(W.conAdd, '<p class="muted">' + esc(W.conLead) + '</p><form id="con-add" class="stack">' +
        '<label class="caps">' + esc(W.conName) + '<input class="field" name="name" required maxlength="80"></label>' +
        '<label class="caps">' + esc(W.conUrl) + '<input class="field" name="url" type="url" required placeholder="https://…/mcp"></label>' +
        '<label class="caps">' + esc(W.conAuth) + '<select class="field" name="auth"><option value="none">' + esc(W.conAuthNone) + '</option><option value="oauth">' + esc(W.conAuthOauth) + '</option><option value="bearer">' + esc(W.conAuthBearer) + '</option><option value="header">' + esc(W.conAuthHeader) + '</option></select></label>' +
        '<label class="caps">' + esc(W.conHeader) + '<input class="field" name="headerName" placeholder="x-api-key"></label>' +
        '<label class="caps">' + esc(W.conKey) + '<input class="field" name="secret" type="password" autocomplete="off"></label>' +
        '<div class="actions"><button>' + esc(W.conConnect) + '</button></div></form>') +
      '</section>';
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
