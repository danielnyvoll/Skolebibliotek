import { udirFetch } from './fetchWrapper';
import { resolveBase } from './baseResolver';

// env override still supported (set before first call)
let _envOverride: string | null = null;
export function setElevBase(url: string) {
	_envOverride = url;
}

async function base(): Promise<string> {
	return _envOverride ?? resolveBase();
}

// ── Eksport-ID-er — faste, ikke oppdaget dynamisk ────────────────────────────
export const EKSPORT_ID = {
	INDIKATOR_GRUNNSKOLE: 148,
	TEMA_GRUNNSKOLE: 149,
	MOBBING_GRUNNSKOLE: 150,
	DELTAKELSE_GRUNNSKOLE: 151,
	INDIKATOR_VIDEREGAENDE: 152
} as const;

export type EksportIdKey = keyof typeof EKSPORT_ID;

// ── Types ────────────────────────────────────────────────────────────────────
export interface UdirDimensjon {
	dimensjonNavn: string;
	dimensjonVerdi: string;
	displayNavn?: string;
}

export interface UdirRad {
	verdi: number | null;
	/** true when the value is shielded ("prikket") — MUST NOT be plotted as 0 */
	erSkjermet: boolean;
	dimensjoner: UdirDimensjon[];
}

export interface UdirRespons {
	data: UdirRad[];
	metadata?: {
		tabellNummer?: number;
		tittel?: string;
		dimensjoner?: Array<{ navn: string; verdier: string[] }>;
	};
}

export interface FilterSpec {
	filterId: string;
	displayNavn?: string;
	obligatorisk?: boolean;
}

export interface FilterVerdi {
	verdi: string;
	displayNavn?: string;
}

// ── Query builder ─────────────────────────────────────────────────────────────
/**
 * Builds Udir query string.
 * Keys are sorted alphabetically as required by the API spec.
 * Example: Aar(2023)_Trinn(7)  →  sorted: Aar < Trinn ✓
 * Array values: Aar(2022,2023)
 */
export function buildQuery(params: Record<string, string | number | (string | number)[]>): string {
	return Object.entries(params)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([k, v]) => {
			const val = Array.isArray(v) ? v.join(',') : v;
			return `${k}(${val})`;
		})
		.join('_');
}

// ── API methods ───────────────────────────────────────────────────────────────
export async function getFilterSpec(tableId: number): Promise<FilterSpec[]> {
	const b = await base();
	return udirFetch<FilterSpec[]>(`${b}/Eksport/${tableId}/filterSpec`, { ttl: 60 * 60_000 });
}

export async function getFilterVerdier(
	tableId: number,
	filterId?: string
): Promise<FilterVerdi[]> {
	const b = await base();
	const qs = filterId ? `?filterId=${encodeURIComponent(filterId)}` : '';
	return udirFetch<FilterVerdi[]>(`${b}/Eksport/${tableId}/filterVerdier${qs}`, {
		ttl: 30 * 60_000
	});
}

export async function getTableData(
	tableId: number,
	params: Record<string, string | number | (string | number)[]>
): Promise<UdirRespons> {
	const b = await base();
	const qs = buildQuery(params);
	const url = `${b}/Eksport/${tableId}/data?${qs}`;
	return udirFetch<UdirRespons>(url, { ttl: 10 * 60_000 });
}

/** Extract a dimension value by name (case-insensitive) */
export function getDim(rad: UdirRad, navn: string): string | undefined {
	return rad.dimensjoner.find(d => d.dimensjonNavn.toLowerCase() === navn.toLowerCase())
		?.dimensjonVerdi;
}
