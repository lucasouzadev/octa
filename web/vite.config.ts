import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ fallback: '200.html' }),
			// Strict policy (ARCHITECTURE §6). The app is static, so Kit emits it as a <meta> tag with
			// hashes for its own inline bootstrap; frame-ancestors lives in vercel.json (meta ignores it).
			// connect-src allows https: only because hls.js fetches playlists from whatever host the
			// user's .m3u8 lives on; scripts, frames and objects stay on an allowlist.
			csp: {
				mode: 'hash',
				directives: {
					'default-src': ['none'],
					'script-src': ['self', 'https://www.youtube.com'],
					'style-src': ['self'],
					'style-src-attr': ['unsafe-inline'],
					'img-src': ['self', 'https:', 'data:', 'blob:'],
					'media-src': ['self', 'https:', 'blob:'],
					'connect-src': ['self', 'https:'],
					'frame-src': ['https://www.youtube-nocookie.com', 'https://www.instagram.com', 'https://www.tiktok.com'],
					'worker-src': ['self', 'blob:'],
					'manifest-src': ['self'],
					'font-src': ['self', 'data:'],
					'object-src': ['none'],
					'base-uri': ['self'],
					'form-action': ['self']
				}
			}
		})
	],
	// Dev and preview forward /api to the Go API (`cd api && go run ./cmd/api`).
	server: { proxy: { '/api': { target: 'http://localhost:8080', rewrite: (p) => p.replace(/^\/api/, '') } } },
	preview: { proxy: { '/api': { target: 'http://localhost:8080', rewrite: (p) => p.replace(/^\/api/, '') } } },
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
