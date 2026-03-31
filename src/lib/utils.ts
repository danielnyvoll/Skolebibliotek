/** Returns '' for null/undefined, trims otherwise. Never throws. */
export function safeTrim(v: unknown): string {
	if (typeof v !== 'string') return '';
	return v.trim();
}

/**
 * Parse Norwegian decimal notation: "12,3" → 12.3, "12.3" → 12.3
 * Returns null for shielded values ("*"), empty strings, or non-numbers.
 */
export function parseNorwegianDecimal(v: unknown): number | null {
	const s = safeTrim(v);
	if (!s || s === '*') return null;
	const n = parseFloat(s.replace(',', '.'));
	return isNaN(n) ? null : n;
}

/**
 * Parse integer with space-as-thousands-separator: "1 234" → 1234
 * Returns null for shielded values or non-numbers.
 */
export function parseSpacedInt(v: unknown): number | null {
	const s = safeTrim(v);
	if (!s || s === '*') return null;
	const n = parseInt(s.replace(/\s/g, ''), 10);
	return isNaN(n) ? null : n;
}

/** Safe coercion to number. Returns null for NaN / null / undefined / "*" / "". */
export function safeNumber(v: unknown): number | null {
	if (v === null || v === undefined || v === '' || v === '*') return null;
	const n = Number(v);
	return isNaN(n) ? null : n;
}
