export const OSTLANDET_FYLKER = [
	'Oslo',
	'Akershus',
	'Østfold',
	'Buskerud',
	'Innlandet',
	'Vestfold',
	'Telemark',
	'Viken',
	'Vestfold og Telemark'
] as const;

/** Safe: accepts any value — NXR can return numbers or undefined */
export function isOstlandet(navn: unknown): boolean {
	const s = typeof navn === 'string' ? navn.trim() : navn?.toString() ?? '';
	const n = s.toLowerCase();
	return OSTLANDET_FYLKER.some(f => f.toLowerCase() === n);
}
