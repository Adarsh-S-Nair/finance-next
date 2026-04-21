const fs = require('fs');
const path = require('path');

const DEFAULT_PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const HOST = process.env.HOST || 'localhost';
const BASE_URL = process.env.WARMUP_BASE_URL || `http://${HOST}:${DEFAULT_PORT}`;
const APP_DIR = path.join(process.cwd(), 'src', 'app');

function isDirectory(filePath) {
	try {
		return fs.statSync(filePath).isDirectory();
	} catch (e) {
		return false;
	}
}

function isFile(filePath) {
	try {
		return fs.statSync(filePath).isFile();
	} catch (e) {
		return false;
	}
}

function hasPageFile(dir) {
	const candidates = ['page.js', 'page.jsx', 'page.ts', 'page.tsx'];
	return candidates.some((filename) => isFile(path.join(dir, filename)));
}

function containsDynamicSegment(segment) {
	return segment.includes('[') && segment.includes(']');
}

function collectPageRoutes(appDir) {
	const routes = new Set();

	// Root page
	if (hasPageFile(appDir)) {
		routes.add('/');
	}

	function walk(currentDir, segments) {
		// Skip API routes entirely
		if (segments.includes('api')) return;

		// Skip dynamic segments for warmup (we don't know sample params)
		if (segments.some(containsDynamicSegment)) return;

		if (hasPageFile(currentDir)) {
			const routePath = '/' + segments.filter(Boolean).join('/');
			routes.add(routePath);
		}

		const entries = fs.readdirSync(currentDir, { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const name = entry.name;
			// Ignore Next.js special route groups like (group)
			if (name.startsWith('(') && name.endsWith(')')) {
				walk(path.join(currentDir, name), segments);
				continue;
			}
			// Ignore underscore-prefixed folders just in case
			if (name.startsWith('_')) continue;
			walk(path.join(currentDir, name), [...segments, name]);
		}
	}

	walk(appDir, []);
	return Array.from(routes).sort((a, b) => a.localeCompare(b));
}

async function waitForServer(baseUrl, timeoutMs = 120000) {
	const start = Date.now();
	const backoffMs = 500;
	while (Date.now() - start < timeoutMs) {
		try {
			const res = await fetch(baseUrl, { method: 'GET' });
			if (res.ok || res.status === 404) {
				return true;
			}
		} catch (e) {
			// ignore until server is up
		}
		await new Promise((r) => setTimeout(r, backoffMs));
	}
	return false;
}

async function warmRoute(route) {
	const url = new URL(route, BASE_URL).toString();
	const start = Date.now();
	try {
		const res = await fetch(url, { method: 'GET' });
		const ms = Date.now() - start;
		if (!res.ok) {
			console.warn(`[warmup] ${route} -> ${res.status} in ${ms}ms`);
			return;
		}
		console.log(`[warmup] ${route} -> 200 in ${ms}ms`);
	} catch (err) {
		const ms = Date.now() - start;
		console.warn(`[warmup] ${route} -> error in ${ms}ms:`, err?.message || err);
	}
}

async function run() {
	if (!isDirectory(APP_DIR)) {
		console.log('[warmup] No src/app directory found; nothing to warm.');
		process.exit(0);
	}

	const routes = collectPageRoutes(APP_DIR);
	if (routes.length === 0) {
		console.log('[warmup] No page routes discovered.');
		process.exit(0);
	}

	console.log(`[warmup] Waiting for dev server at ${BASE_URL} ...`);
	const up = await waitForServer(BASE_URL);
	if (!up) {
		console.warn('[warmup] Dev server did not become ready in time. Skipping warmup.');
		process.exit(0);
	}

	console.log(`[warmup] Warming ${routes.length} routes...`);
	// Limit concurrency to avoid overwhelming dev server
	const concurrency = 3;
	let index = 0;
	async function worker() {
		while (index < routes.length) {
			const i = index++;
			await warmRoute(routes[i]);
		}
	}
	await Promise.all(Array.from({ length: concurrency }, worker));
	console.log('[warmup] Done.');
}

run().catch((err) => {
	console.error('[warmup] Unexpected error:', err);
	process.exit(0);
});


