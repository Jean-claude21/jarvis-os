import { fill, type Lang, type Words } from './i18n';

// Jarvis's own sign-in and consent pages (spec 003): small, server-rendered, no framework. The
// script only calls Better Auth's endpoints and follows the address they answer with.

const escape = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

const style = `
  :root { color-scheme: light dark; --ink: #2a1610; --soft: #6b4e43; --line: #d9c4b4; --bg: #fbf6f0; --paper: #fffdf9;
          --accent: #b83a1b; }
  @media (prefers-color-scheme: dark) { :root { --ink: #f4e6da; --soft: #bfa799; --line: #4a382e; --bg: #17100c;
          --paper: #221813; --accent: #f08a63; } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--ink);
         font: 16px/1.6 "Instrument Sans", system-ui, -apple-system, "Segoe UI", sans-serif; padding: 16px; }
  main { width: 100%; max-width: 420px; display: grid; gap: 16px; background: var(--paper); border: 1px solid var(--line);
         border-radius: 2px; padding: 28px 24px; }
  main::before { content: "J"; width: 32px; height: 32px; display: grid; place-items: center; background: var(--accent);
         color: var(--paper); font: 700 17px/1 Archivo, system-ui, sans-serif; border-radius: 2px; }
  h1 { font: 700 22px/1.25 Archivo, system-ui, sans-serif; margin: 0; letter-spacing: -0.01em; }
  p { margin: 0; color: var(--soft); }
  form { display: grid; gap: 12px; }
  label { display: grid; gap: 4px; font-size: 14px; font-weight: 600; }
  [hidden] { display: none; }
  input { font: inherit; font-weight: 400; padding: 10px 12px; border: 1px solid var(--line); border-radius: 2px;
          background: transparent; color: var(--ink); }
  input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
  button { font: 600 15px/1 "Instrument Sans", system-ui, sans-serif; padding: 12px 14px; border-radius: 2px;
           border: 1px solid var(--ink); background: var(--ink); color: var(--paper); cursor: pointer; }
  button.quiet { background: transparent; color: var(--ink); }
  .row { display: flex; gap: 8px; } .row button { flex: 1; }
  .error { color: var(--accent); min-height: 1.6em; }
  .done { color: var(--ink); }
  fieldset { border: 1px solid var(--line); border-radius: 2px; padding: 8px 12px; margin: 0; display: grid; gap: 6px; }
  legend { font-size: 14px; padding: 0 4px; }
  label.check { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 400; }
  label.check input { width: 18px; height: 18px; accent-color: var(--accent); }
  a { color: var(--accent); }
`;

const page = (lang: Lang, title: string, body: string, script: string) => `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@700&family=Instrument+Sans:wght@400;600&display=swap">
<style>${style}</style></head>
<body><main>${body}</main><script>${script}</script></body></html>`;

/**
 * Follows the address Better Auth answers with; shows its message otherwise. `done` runs after a
 * success that names no address (by default, home).
 */
const follow = (words: Words, done = "location.href = '/';") => `
  const error = document.getElementById('error');
  async function call(path, body) {
    const response = await fetch(path, { method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (data && data.url) { location.href = data.url; return; }
    if (!response.ok) {
      error.textContent = response.status === 401 ? ${JSON.stringify(words.wrong)}
        : ${JSON.stringify(words.failed)}.replace('{reason}', (data && data.message) || response.status);
      return;
    }
    ${done}
  }
`;

/** A page that only says one thing (an expired link). */
export const messagePage = (lang: Lang, message: string) =>
  page(lang, message, `<p class="error">${escape(message)}</p>`, '');

/** Signing in, or creating an account: the same form on every page that needs her. */
const accountForm = (words: Words) => `
     <form id="form">
       <label id="name-field" hidden>${escape(words.name)}<input name="name" autocomplete="given-name"></label>
       <label>${escape(words.email)}<input name="email" type="email" autocomplete="email" required></label>
       <label>${escape(words.password)}<input name="password" type="password" autocomplete="current-password" minlength="10" required></label>
       <button id="submit">${escape(words.signIn)}</button>
     </form>
     <p class="error" id="error" role="alert"></p>
     <p id="switch-row"><span id="switch-lead">${escape(words.noAccount)}</span> <a href="#" id="switch">${escape(words.signUp)}</a></p>`;

/** The form's script; `extra` is added to the body sent (the OAuth request, when there is one). */
const accountScript = (words: Words, extra: string) => `
     let creating = false;
     document.getElementById('switch').addEventListener('click', (event) => {
       event.preventDefault(); creating = !creating;
       document.getElementById('name-field').hidden = !creating;
       document.getElementById('submit').textContent = creating ? ${JSON.stringify(words.signUp)} : ${JSON.stringify(words.signIn)};
       document.getElementById('switch-lead').textContent = creating ? ${JSON.stringify(words.haveAccount)} : ${JSON.stringify(words.noAccount)};
       document.getElementById('switch').textContent = creating ? ${JSON.stringify(words.signIn)} : ${JSON.stringify(words.signUp)};
     });
     document.getElementById('form').addEventListener('submit', (event) => {
       event.preventDefault(); error.textContent = '';
       const form = new FormData(event.target);
       const body = { email: form.get('email'), password: form.get('password'), ${extra} };
       if (creating) call('/auth/sign-up/email', { ...body, name: form.get('name') || form.get('email') });
       else call('/auth/sign-in/email', body);
     });`;

export function signInPage(lang: Lang, words: Words, client: string | null): string {
  const lead = client ? fill(words.signInLead, { client }) : words.signInLeadPlain;
  return page(
    lang,
    words.signInTitle,
    `<h1>${escape(words.signInTitle)}</h1><p>${escape(lead)}</p>${accountForm(words)}`,
    `${follow(words)}
     const query = location.search.slice(1);
     ${accountScript(words, 'oauth_query: query')}`,
  );
}

/**
 * An invitation into a shared space (spec 004). The secret is the link's fragment: the page shows
 * the space, has her sign in (or create her account) with the invited address, then accepts.
 */
export function invitationPage(lang: Lang, words: Words): string {
  return page(
    lang,
    words.inviteTitle,
    `<h1 id="title">${escape(words.inviteTitle)}</h1>
     <p id="lead"></p>
     <div id="account" hidden><p>${escape(words.inviteSignIn)}</p>${accountForm(words)}</div>
     <div id="join" hidden><button id="accept">${escape(words.inviteAccept)}</button>
       <p class="error" id="join-error" role="alert"></p></div>
     <p class="done" id="done" hidden></p>`,
    `${follow(words, 'show();')}
     const token = location.hash.slice(1);
     const words = ${JSON.stringify({
       lead: words.inviteLead,
       used: words.inviteUsed,
       expired: words.inviteExpired,
       withdrawn: words.inviteWithdrawn,
       missing: words.inviteMissing,
       joined: words.inviteJoined,
       failed: words.failed,
     })};
     const lead = document.getElementById('lead');
     let invited = null;
     async function show() {
       document.getElementById('account').hidden = true;
       const session = await fetch('/auth/get-session', { credentials: 'same-origin' }).then((r) => r.json()).catch(() => null);
       if (session && session.user) { document.getElementById('join').hidden = false; return; }
       document.getElementById('account').hidden = false;
       document.querySelector('#form input[name=email]').value = invited.email;
     }
     async function start() {
       const response = token ? await fetch('/invitation/preview', { method: 'POST',
         headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) }) : null;
       if (!response || !response.ok) { lead.textContent = words.missing; return; }
       invited = await response.json();
       if (invited.state !== 'open') { lead.textContent = words[invited.state]; return; }
       lead.textContent = words.lead.replace('{space}', invited.spaceName).replace('{email}', invited.email);
       await show();
     }
     document.getElementById('accept').addEventListener('click', async () => {
       const failure = document.getElementById('join-error');
       const response = await fetch('/api/invitations/accept', { method: 'POST', credentials: 'same-origin',
         headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) });
       const data = await response.json().catch(() => ({}));
       if (!response.ok) { failure.textContent = words.failed.replace('{reason}', data.error || response.status); return; }
       document.getElementById('join').hidden = true;
       const done = document.getElementById('done');
       done.textContent = words.joined.replace('{space}', invited.spaceName);
       done.hidden = false;
     });
     ${accountScript(words, '')}
     start();`,
  );
}

export function consentPage(
  lang: Lang,
  words: Words,
  request: {
    valid: boolean;
    client: string;
    clientId: string;
    scopes: string;
    /** Her spaces: she chooses which this client reaches (spec 004). */
    spaces: { id: string; name: string; personal: boolean }[];
  },
): string {
  if (!request.valid) {
    return page(lang, words.expired, `<p class="error">${escape(words.expired)}</p>`, '');
  }
  const client = request.client;
  return page(
    lang,
    fill(words.consentTitle, { client }),
    `<h1>${escape(fill(words.consentTitle, { client }))}</h1>
     <p>${escape(fill(words.consentLead, { client }))}</p>
     <p>${escape(fill(words.consentScopes, { scopes: request.scopes }))}</p>
     <fieldset><legend>${escape(words.consentSpaces)}</legend>${request.spaces
       .map(
         (space) =>
           `<label class="check"><input type="checkbox" name="space" value="${escape(space.id)}" checked>${escape(
             space.personal ? fill(words.consentOwn, { space: space.name }) : space.name,
           )}</label>`,
       )
       .join('')}</fieldset>
     <p>${escape(words.consentNote)}</p>
     <div class="row"><button class="quiet" id="refuse">${escape(words.refuse)}</button>
       <button id="accept">${escape(words.accept)}</button></div>
     <p class="error" id="error" role="alert"></p>`,
    `${follow(words)}
     const query = location.search.slice(1);
     const clientId = ${JSON.stringify(request.clientId)};
     document.getElementById('accept').addEventListener('click', async () => {
       const spaces = [...document.querySelectorAll('input[name=space]:checked')].map((box) => box.value);
       if (spaces.length === 0) { error.textContent = ${JSON.stringify(words.consentNone)}; return; }
       const allowed = await fetch('/api/clients/' + encodeURIComponent(clientId) + '/spaces', {
         method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
         body: JSON.stringify({ spaces }) });
       if (!allowed.ok) { error.textContent = ${JSON.stringify(words.failed)}.replace('{reason}', allowed.status); return; }
       call('/auth/oauth2/consent', { accept: true, oauth_query: query });
     });
     document.getElementById('refuse').addEventListener('click', () => call('/auth/oauth2/consent', { accept: false, oauth_query: query }));`,
  );
}
