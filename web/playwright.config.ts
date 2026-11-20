import { defineConfig, devices } from '@playwright/test';

// Same layout on every screen (DESIGN §1.4): every flow runs at phone, tablet and desktop width.
export default defineConfig({
	webServer: { command: 'pnpm build && pnpm preview --port 4173 --strictPort', port: 4173, reuseExistingServer: false },
	testMatch: '**/*.e2e.{ts,js}',
	reporter: [['list'], ['junit', { outputFile: 'test-results/junit.xml' }]],
	// Service workers are blocked so page.route keeps seeing every request; pwa.e2e.ts opts in.
	use: { baseURL: 'http://localhost:4173', serviceWorkers: 'block', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
	projects: [
		{ name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true } },
		{ name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 834, height: 1194 }, hasTouch: true } },
		{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }
	]
});
