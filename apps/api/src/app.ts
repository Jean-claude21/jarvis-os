import { pool } from '@jarvis-os/core';
import { Hono } from 'hono';
import { makeAuth } from './auth';
import { apiRoutes } from './routes';
import type { Settings } from './settings';
import { objectStorage } from './storage';

/** The Jarvis OS server: accounts (`/auth`), the REST API (`/api`), its health. */
export function makeApp(settings: Settings) {
  const db = pool(settings.appUrl);
  const blobs = objectStorage(settings.storage);
  const auth = makeAuth({ db, secret: settings.authSecret, publicUrl: settings.publicUrl });
  const app = new Hono();
  app.get('/health', (c) => c.json({ status: 'healthy' }));
  app.on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw));
  app.route('/api', apiRoutes({ auth, db, blobs }));
  return { app, auth, db, blobs, close: () => db.end() };
}
