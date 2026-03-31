import { udirFetch } from './fetchWrapper';

export let NXR_BASE = 'https://data-nxr-fellestjeneste.udir.no';

export function setNxrBase(url: string) {
	NXR_BASE = url;
}

// ── Types ─────────────────────────────────────────────────────────────────────
// Field names are inferred; adjust if actual /api/v2/ responses differ.

export interface Fylke {
	fylkesnummer: string;
	navn: string;
	[k: string]: unknown;
}

export interface Kommune {
	kommunenummer: string;
	navn: string;
	fylkesnummer: string;
	[k: string]: unknown;
}

// ── Fetch with sanity log ─────────────────────────────────────────────────────
async function nxrFetch<T>(url: string): Promise<T> {
	let status = '(cached)';
	try {
		// Peek at status before handing off to cache layer
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), 10_000);
		const res = await fetch(url, { signal: ctrl.signal });
		clearTimeout(timer);
		status = String(res.status);
		console.info(`[nxr] GET ${url} → ${status}`);
		if (!res.ok) throw new Error(`HTTP ${status} — ${url}`);
		const data = (await res.json()) as T;
		// Warm the udirFetch cache so repeated calls are free
		return udirFetch<T>(url, { ttl: 30 * 60_000 }).catch(() => data);
	} catch (err) {
		console.error(`[nxr] GET ${url} → ${status}`, err);
		throw err;
	}
}

// ── API methods — paths confirmed against /swagger/index.html ─────────────────

/** All fylker */
export async function getFylker(): Promise<Fylke[]> {
	return nxrFetch<Fylke[]>(`${NXR_BASE}/api/v2/fylkedata`);
}

/** All kommuner (no filter) */
export async function getKommuner(): Promise<Kommune[]> {
	return nxrFetch<Kommune[]>(`${NXR_BASE}/api/v2/kommunedata`);
}

/** Kommuner for a specific fylke */
export async function getKommunerForFylke(fylkesnummer: string): Promise<Kommune[]> {
	return nxrFetch<Kommune[]>(
		`${NXR_BASE}/api/v2/kommunedatamedfylkenummer?fylkenummer=${encodeURIComponent(fylkesnummer)}`
	);
}
