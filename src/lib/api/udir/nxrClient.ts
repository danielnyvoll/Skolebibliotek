import { udirFetch } from './fetchWrapper';

export let NXR_BASE = 'https://data-nxr-fellestjeneste.udir.no';

export function setNxrBase(url: string) {
	NXR_BASE = url;
}

// ── Raw API shape (NXR returns numbers for id fields) ─────────────────────────
interface RawFylke {
	fylkenummer?: number | string | null;
	fylkesnummer?: number | string | null; // alt. field name
	fylkenavn?: unknown;
	navn?: unknown;
	[k: string]: unknown;
}

interface RawKommune {
	kommunenummer?: number | string | null;
	kommunenavn?: unknown;
	navn?: unknown;
	fylkenummer?: number | string | null;
	fylkesnummer?: number | string | null;
	[k: string]: unknown;
}

// ── Normalised view-model (always strings) ────────────────────────────────────
export interface Fylke {
	fylkesnummer: string; // zero-padded, e.g. "03"
	navn: string;
}

export interface Kommune {
	kommunenummer: string; // zero-padded, e.g. "0301"
	navn: string;
	fylkesnummer: string;
}

// ── Safe string helper ────────────────────────────────────────────────────────
function str(v: unknown): string {
	return typeof v === 'string' ? v.trim() : v?.toString() ?? '';
}

// ── Normalise raw API rows ────────────────────────────────────────────────────
function normFylke(raw: RawFylke): Fylke {
	return {
		// API uses both "fylkenummer" and "fylkesnummer" depending on endpoint
		fylkesnummer: str(raw.fylkenummer ?? raw.fylkesnummer),
		navn: str(raw.fylkenavn ?? raw.navn)
	};
}

function normKommune(raw: RawKommune): Kommune {
	return {
		kommunenummer: str(raw.kommunenummer),
		navn: str(raw.kommunenavn ?? raw.navn),
		fylkesnummer: str(raw.fylkenummer ?? raw.fylkesnummer)
	};
}

// ── Fetch with sanity log ─────────────────────────────────────────────────────
async function nxrFetch<T>(url: string): Promise<T> {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), 10_000);
	try {
		const res = await fetch(url, { signal: ctrl.signal });
		clearTimeout(timer);
		console.info(`[nxr] GET ${url} → ${res.status}`);
		if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
		return (await res.json()) as T;
	} catch (err) {
		clearTimeout(timer);
		console.error(`[nxr] GET ${url} → error:`, err);
		throw err;
	}
}

// Thin cache on top of nxrFetch
const _cache = new Map<string, { data: unknown; exp: number }>();
async function cachedFetch<T>(url: string, ttlMs = 30 * 60_000): Promise<T> {
	const hit = _cache.get(url);
	if (hit && Date.now() < hit.exp) return hit.data as T;
	const data = await nxrFetch<T>(url);
	_cache.set(url, { data, exp: Date.now() + ttlMs });
	return data;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getFylker(): Promise<Fylke[]> {
	const raw = await cachedFetch<RawFylke[]>(`${NXR_BASE}/api/v2/fylkedata`);
	const list = Array.isArray(raw) ? raw : ((raw as { data?: RawFylke[] }).data ?? []);
	return list.map(normFylke);
}

export async function getKommunerForFylke(fylkesnummer: string): Promise<Kommune[]> {
	const url = `${NXR_BASE}/api/v2/kommunedatamedfylkenummer?fylkenummer=${encodeURIComponent(fylkesnummer)}`;
	const raw = await cachedFetch<RawKommune[]>(url);
	const list = Array.isArray(raw) ? raw : ((raw as { data?: RawKommune[] }).data ?? []);
	return list.map(normKommune);
}

export async function getKommuner(): Promise<Kommune[]> {
	const raw = await cachedFetch<RawKommune[]>(`${NXR_BASE}/api/v2/kommunedata`);
	const list = Array.isArray(raw) ? raw : ((raw as { data?: RawKommune[] }).data ?? []);
	return list.map(normKommune);
}
