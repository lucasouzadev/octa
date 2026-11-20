/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
// Offline shell only (ARCHITECTURE §3): the app's own files, so the Library opens without a
// network. It never touches another origin (videos, thumbnails, embeds), `/api`, or range
// requests, so nothing the person watches is ever stored.
import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `octa-shell-${version}`;
const SHELL = '/'; // served by the static fallback (200.html): boots the client router for any path
// The manifest paths come without the leading slash; the app is served from the root.
const abs = (path: string) => '/' + path.replace(/^\//, '');
const PRECACHE = [...immutable.map((f) => abs(f.path)), ...assets.map((f) => abs(f.path)), SHELL];
const PRECACHED = new Set(PRECACHE);

sw.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET' || request.headers.has('range')) return;
	const url = new URL(request.url);
	if (url.origin !== sw.location.origin || url.pathname.startsWith('/api/')) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			if (PRECACHED.has(url.pathname)) {
				const hit = await cache.match(url.pathname);
				if (hit) return hit;
			}
			try {
				return await fetch(request);
			} catch (error) {
				// Offline: a page request gets the shell (the router and IndexedDB do the rest).
				if (request.mode === 'navigate') {
					const shell = await cache.match(SHELL);
					if (shell) return shell;
				}
				throw error;
			}
		})()
	);
});
