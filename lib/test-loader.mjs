import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Custom loader that resolves 'server-only' to an empty module.
// This allows tests to import server-side modules without Next.js.
export function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') {
    return { shortCircuit: true, url: 'data:text/javascript,' };
  }
  if (specifier.startsWith('@/')) {
    const target = path.join(projectRoot, specifier.slice(2));
    const resolvedTarget = existsSync(target)
      ? target
      : ['.ts', '.tsx', '.js', '.mjs']
        .map(extension => `${target}${extension}`)
        .find(candidate => existsSync(candidate)) ?? target;
    return {
      shortCircuit: true,
      url: pathToFileURL(resolvedTarget).href,
    };
  }
  if (specifier === 'next/server') {
    return nextResolve('next/server.js', context);
  }
  if (specifier === 'next/headers') {
    return nextResolve('next/headers.js', context);
  }
  return nextResolve(specifier, context);
}
