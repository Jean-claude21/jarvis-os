// The test database migrated before the server starts (the server checks the accounts' tables when
// it starts): `tsx migrate.ts`, first in the web server's command.
import setup from './setup';

await setup();
console.info('[e2e] test database migrated');
