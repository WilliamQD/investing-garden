// Register hook to stub out 'server-only' for test environment.
// server-only throws when imported outside Next.js server context,
// but our validation tests need to import modules that use it.
import { register } from 'node:module';

register('./test-loader.mjs', import.meta.url);
