// Østlandet-fylker (inkl. de re-splittede fra 2024)
export const OSTLANDET_FYLKER = [
	'Oslo',
	'Akershus',
	'Østfold',
	'Buskerud',
	'Innlandet',
	'Vestfold',
	'Telemark',
	// Eldre navn / Viken-perioden
	'Viken',
	'Vestfold og Telemark'
] as const;

export function isOstlandet(navn: string): boolean {
	const n = navn.trim().toLowerCase();
	return OSTLANDET_FYLKER.some(f => f.toLowerCase() === n);
}
