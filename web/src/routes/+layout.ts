// The library lives in IndexedDB, so every page renders in the browser.
// adapter-static serves 200.html as the SPA fallback (vite.config.ts).
export const ssr = false;
export const prerender = false;
