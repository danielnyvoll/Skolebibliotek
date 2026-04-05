import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import net from 'node:net';

function parseConnectionUrl(url: string) {
	try {
		const u = new URL(url);
		return { host: u.hostname, port: parseInt(u.port || '5432'), user: u.username };
	} catch {
		return null;
	}
}

/** Raw TCP reachability test — does not require postgres driver. */
function tcpProbe(host: string, port: number, timeoutMs = 5000): Promise<'ok' | string> {
	return new Promise(resolve => {
		const sock = new net.Socket();
		const timer = setTimeout(() => {
			sock.destroy();
			resolve(`TIMEOUT after ${timeoutMs}ms`);
		}, timeoutMs);

		sock.connect(port, host, () => {
			clearTimeout(timer);
			sock.destroy();
			resolve('ok');
		});

		sock.on('error', (err: Error) => {
			clearTimeout(timer);
			resolve(`ERROR: ${err.message}`);
		});
	});
}

export const GET: RequestHandler = async () => {
	const dbUrl = env.DATABASE_URL ?? '';
	const parsed = parseConnectionUrl(dbUrl);

	// ── Step 1: TCP probe on configured port ─────────────────────────────────
	let tcpResult: string = 'skipped (could not parse DATABASE_URL)';
	let tcp5432: string = 'skipped';
	if (parsed) {
		[tcpResult, tcp5432] = await Promise.all([
			tcpProbe(parsed.host, parsed.port),
			parsed.port !== 5432 ? tcpProbe(parsed.host, 5432) : Promise.resolve('same as configured')
		]);
	}

	// ── Step 2: postgres query ────────────────────────────────────────────────
	let queryResult: string = 'skipped';
	let queryError: string | null = null;
	if (tcpResult === 'ok') {
		try {
			// Dynamic import so a TCP failure above doesn't crash at module load
			const { default: db } = await import('$lib/server/db');
			const rows = await db<{ now: string }[]>`SELECT NOW()::text AS now`;
			queryResult = rows[0]?.now ?? 'no rows';
		} catch (e: unknown) {
			queryError = e instanceof Error ? e.message : String(e);
		}
	}

	return json({
		databaseUrl: dbUrl ? `${dbUrl.slice(0, 30)}…` : '(not set)',
		parsedHost: parsed?.host ?? null,
		parsedPort: parsed?.port ?? null,
		parsedUser: parsed?.user ?? null,
		tcp: {
			[`port_${parsed?.port ?? '?'}`]: tcpResult,
			port_5432: tcp5432
		},
		query: queryResult,
		queryError
	});
};
