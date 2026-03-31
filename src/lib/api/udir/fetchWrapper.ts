const cache = new Map<string, { data: unknown; expires: number }>();

export interface FetchOptions {
	ttl?: number;
	timeout?: number;
	retries?: number;
}

export async function udirFetch<T>(url: string, opts: FetchOptions = {}): Promise<T> {
	const { ttl = 5 * 60_000, timeout = 10_000, retries = 1 } = opts;

	const hit = cache.get(url);
	if (hit && Date.now() < hit.expires) return hit.data as T;

	let lastErr: unknown;
	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			const ctrl = new AbortController();
			const timer = setTimeout(() => ctrl.abort(), timeout);
			const res = await fetch(url, { signal: ctrl.signal });
			clearTimeout(timer);
			if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`);
			const data = await res.json();
			cache.set(url, { data, expires: Date.now() + ttl });
			return data as T;
		} catch (err) {
			lastErr = err;
			if (attempt < retries) await new Promise(r => setTimeout(r, 600));
		}
	}
	throw lastErr;
}

export function clearCache() {
	cache.clear();
}
