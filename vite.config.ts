import preact from '@preact/preset-vite';
import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import type { IncomingMessage } from 'node:http';

function readBody(req: IncomingMessage): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
		req.on('error', reject);
		req.on('end', () => {
			const raw = Buffer.concat(chunks).toString('utf8');
			if (!raw) return resolve(undefined);
			try {
				resolve(JSON.parse(raw));
			} catch {
				resolve(raw);
			}
		});
	});
}

function apiPlugin(): Plugin {
	return {
		name: 'solitaire-api',
		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				if (!req.url?.startsWith('/api/')) return next();
				try {
					const { handleApiRequest } = await import('./server/api');
					const result = await handleApiRequest({
						method: req.method ?? 'GET',
						url: req.url,
						body: await readBody(req)
					});
					res.statusCode = result.status;
					for (const [key, value] of Object.entries(result.headers ?? {})) {
						res.setHeader(key, value);
					}
					res.setHeader('Content-Type', 'application/json');
					res.end(JSON.stringify(result.body));
				} catch (error) {
					res.statusCode = 500;
					res.setHeader('Content-Type', 'application/json');
					res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'server error' }));
				}
			});
		}
	};
}

export default defineConfig({
	plugins: [preact(), apiPlugin()],
	publicDir: 'static',
	build: {
		outDir: 'build',
		emptyOutDir: true
	},
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url))
		}
	}
});
