/**
 * Probes known UDIR base URLs and returns the first that answers 200.
 * Result is cached for the lifetime of the process.
 *
 * API spec (Swagger): https://statistikkportalen.udir.no/api/rapportering/swagger
 * Data endpoint format: GET /Eksport/{id}/data?filter=Key(val)_Key(val)&format=Json
 */

export const CANDIDATE_BASES = [
	// Working open base (no auth required)
	'https://api.statistikkbanken.udir.no/api/rest/v2',
	// statistikkportalen requires auth — kept as reference only
	'https://statistikkportalen.udir.no/api/rapportering/rest/v1',
] as const;

let _resolved: string | null = null;
let _resolvePromise: Promise<string> | null = null;

export async function resolveBase(): Promise<string> {
	if (_resolved) return _resolved;
	if (_resolvePromise) return _resolvePromise;

	_resolvePromise = (async () => {
		for (const base of CANDIDATE_BASES) {
			try {
				const ctrl = new AbortController();
				const timer = setTimeout(() => ctrl.abort(), 8_000);
				const res = await fetch(`${base}/Eksport`, { signal: ctrl.signal });
				clearTimeout(timer);
				if (res.ok) {
					_resolved = base;
					console.info(`[udir] base resolved → ${base}`);
					return base;
				}
				console.warn(`[udir] ${base}/Eksport → HTTP ${res.status}`);
			} catch (err) {
				console.warn(`[udir] ${base} unreachable: ${err}`);
			}
		}
		_resolved = CANDIDATE_BASES[0];
		console.warn(`[udir] no base responded, falling back to ${_resolved}`);
		return _resolved;
	})();

	return _resolvePromise;
}

/** Reset so tests or hot-reload can re-probe */
export function resetBaseCache() {
	_resolved = null;
	_resolvePromise = null;
}
