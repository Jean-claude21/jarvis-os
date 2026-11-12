// Netlify's door to Jarvis OS (spec 010): every request goes to the same Hono app as `pnpm dev`,
// on the branch named by JARVIS_BRANCH and at the address named by JARVIS_PUBLIC_URL.
import { makeApp } from '../../src/app';
import { settingsFor, type Branch } from '../../src/settings';

const branch = (process.env.JARVIS_BRANCH ?? 'dev') as Branch;
const { app } = makeApp(settingsFor(branch, process.env.JARVIS_PUBLIC_URL));

export default (request: Request) => app.fetch(request);

// The page's script, style and words are files of the site (written by `pnpm deploy:*`), served by
// the CDN without waking this function.
export const config = { path: '/*', excludedPath: ['/assets/*'], preferStatic: false };
