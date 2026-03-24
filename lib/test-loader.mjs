// Custom loader that resolves 'server-only' to an empty module.
// This allows tests to import server-side modules without Next.js.
export function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') {
    return { shortCircuit: true, url: 'data:text/javascript,' };
  }
  return nextResolve(specifier, context);
}
