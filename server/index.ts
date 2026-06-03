import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiRequest } from './api';

const PORT = Number(process.env.PORT ?? 3000);
const BUILD_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'build');

createServer(async (request, response) => {
	try {
		const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

		if (url.pathname.startsWith('/api/')) {
			const body = await parseBody(request);
			const result = await handleApiRequest({ method: request.method ?? 'GET', url: `${url.pathname}${url.search}`, body });
			sendJson(response, result.status, result.body, result.headers);
			return;
		}

		const filePath = await resolveStaticPath(url.pathname);
		const content = await readFile(filePath);
		response.writeHead(200, {
			'Content-Type': contentType(filePath),
			'Cache-Control': filePath.endsWith('index.html') ? 'no-store' : 'public, max-age=31536000, immutable'
		});
		response.end(request.method === 'HEAD' ? undefined : content);
	} catch (error) {
		sendJson(response, 500, { error: error instanceof Error ? error.message : 'server error' });
	}
}).listen(PORT);

console.log(`Solitaire running on http://localhost:${PORT}`);

async function parseBody(request: IncomingMessage): Promise<unknown> {
	if (request.method === 'GET' || request.method === 'HEAD') return undefined;
	const type = request.headers['content-type'] ?? '';
	const raw = await new Promise<string>((resolve, reject) => {
		const chunks: Buffer[] = [];
		request.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
		request.on('error', reject);
		request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
	});
	if (!raw) return undefined;
	if (type.includes('application/json')) {
		try {
			return JSON.parse(raw);
		} catch {
			return undefined;
		}
	}
	return raw;
}

async function resolveStaticPath(pathname: string): Promise<string> {
	const requested = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
	const safePath = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, '');
	const fullPath = join(BUILD_DIR, safePath);
	try {
		await readFile(fullPath);
		return fullPath;
	} catch {}
	return join(BUILD_DIR, 'index.html');
}

function sendJson(response: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
	response.writeHead(status, {
		'Content-Type': 'application/json',
		...headers
	});
	response.end(JSON.stringify(body));
}

function contentType(filePath: string): string {
	if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
	if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
	if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
	if (filePath.endsWith('.svg')) return 'image/svg+xml';
	if (filePath.endsWith('.png')) return 'image/png';
	if (filePath.endsWith('.webp')) return 'image/webp';
	if (filePath.endsWith('.ico')) return 'image/x-icon';
	return 'application/octet-stream';
}
