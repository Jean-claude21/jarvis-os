import { fill, type Lang, type Words } from './i18n';

// Jarvis's own sign-in and consent pages (spec 003): small, server-rendered, no framework. The
// script only calls Better Auth's endpoints and follows the address they answer with.

const escape = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

const style = `
  :root { color-scheme: light dark; --ink: #1d1d1b; --soft: #6b6a66; --line: #d9d6cf; --bg: #faf8f4; --accent: #b4441f; }
  @media (prefers-color-scheme: dark) { :root { --ink: #eceae4; --soft: #a5a29a; --line: #3b3a36; --bg: #1b1a18; } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--ink);
         font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; padding: 16px; }
  main { width: 100%; max-width: 400px; display: grid; gap: 16px; }
  h1 { font-size: 22px; font-weight: 600; margin: 0; }
  p { margin: 0; color: var(--soft); }
  form { display: grid; gap: 12px; }
  label { display: grid; gap: 4px; font-size: 14px; }
  input { font: inherit; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: transparent; color: var(--ink); }
  button { font: inherit; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--ink); background: var(--ink); color: var(--bg); cursor: pointer; }
  button.quiet { background: transparent; color: var(--ink); }
  .row { display: flex; gap: 8px; } .row button { flex: 1; }
  .error { color: var(--accent); min-height: 1.6em; }
  a { color: var(--ink); }
`;

const page = (lang: Lang, title: string, body: string, script: string) => `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title><style>${style}</style></head>
<body><main>${body}</main><script>${script}</script></body></html>`;

/** Follows the address Better Auth answers with; shows its message otherwise. */
const follow = (words: Words) => `
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
    location.href = '/';
  }
`;

export function signInPage(lang: Lang, words: Words, client: string | null): string {
  const lead = client ? fill(words.signInLead, { client }) : words.signInLeadPlain;
  return page(
    lang,
    words.signInTitle,
    `<h1>${escape(words.signInTitle)}</h1><p>${escape(lead)}</p>
     <form id="form">
       <label id="name-field" hidden>${escape(words.name)}<input name="name" autocomplete="given-name"></label>
       <label>${escape(words.email)}<input name="email" type="email" autocomplete="email" required></label>
       <label>${escape(words.password)}<input name="password" type="password" autocomplete="current-password" minlength="10" required></label>
       <button id="submit">${escape(words.signIn)}</button>
     </form>
     <p class="error" id="error" role="alert"></p>
     <p><span id="switch-lead">${escape(words.noAccount)}</span> <a href="#" id="switch">${escape(words.signUp)}</a></p>`,
    `${follow(words)}
     const query = location.search.slice(1);
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
       const body = { email: form.get('email'), password: form.get('password'), oauth_query: query };
       if (creating) call('/auth/sign-up/email', { ...body, name: form.get('name') || form.get('email') });
       else call('/auth/sign-in/email', body);
     });`,
  );
}

export function consentPage(
  lang: Lang,
  words: Words,
  request: { valid: boolean; client: string; scopes: string },
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
     <p>${escape(words.consentNote)}</p>
     <div class="row"><button class="quiet" id="refuse">${escape(words.refuse)}</button>
       <button id="accept">${escape(words.accept)}</button></div>
     <p class="error" id="error" role="alert"></p>`,
    `${follow(words)}
     const query = location.search.slice(1);
     document.getElementById('accept').addEventListener('click', () => call('/auth/oauth2/consent', { accept: true, oauth_query: query }));
     document.getElementById('refuse').addEventListener('click', () => call('/auth/oauth2/consent', { accept: false, oauth_query: query }));`,
  );
}
