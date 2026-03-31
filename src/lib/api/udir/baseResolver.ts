/**
 * Probes both known Udir base URLs and returns the first that answers 200
 * on GET /Eksport/. Result is cached for the lifetime of the process.
 */

export const CANDIDATE_BASES = [
	'https://api.statistikkbanken.udir.no/api/rest/v2',
	'https://api.udir-statistikkbanken.no/api/rest/v2'
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
		// fallback — let actual requests fail with a descriptive error
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
