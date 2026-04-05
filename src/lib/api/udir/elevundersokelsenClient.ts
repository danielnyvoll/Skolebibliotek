import { udirFetch } from './fetchWrapper';
import { resolveBase } from './baseResolver';

let _envOverride: string | null = null;
export function setElevBase(url: string) { _envOverride = url; }

async function base(): Promise<string> {
	return _envOverride ?? resolveBase();
}

// ── Eksport-ID-er ─────────────────────────────────────────────────────────────
export const EKSPORT_ID = {
	INDIKATOR_GRUNNSKOLE: 148,
	TEMA_GRUNNSKOLE: 149,
	MOBBING_GRUNNSKOLE: 150,
	DELTAKELSE_GRUNNSKOLE: 151,
	INDIKATOR_VIDEREGAENDE: 152
} as const;

export type EksportIdKey = keyof typeof EKSPORT_ID;

// ── Filter tree types (actual UDIR API format) ────────────────────────────────

/** A time-period node returned by /filterVerdier. */
export interface TidNode {
	indeks: number;
	id: number;      // e.g. 202412  →  year = floor(id / 100) = 2024
	kode: string;    // same as id as string, e.g. "202412"
	navn: string;    // e.g. "2024-25"
	erBegrenset: number;
}

/** A geographical/school unit node returned by /filterVerdier.
 *  nivaa: 0=root  1=national  2=county(fylke)  3=municipality  4=school
 *  barn:  indeks values into the flat EnhetID array (not id values!)
 */
export interface EnhetNode {
	indeks: number;
	id: number;      // internal UDIR integer — use this in EnhetID(…) queries
	kode: string;    // nivaa 4 = Norwegian org number (9 digits); others = geo code
	navn: string;
	erBegrenset: number;
	nivaa: number;
	skjult?: number;
	forelder?: number;
	barn?: number[]; // indeks values (0-based position in the array)
}

export interface FilterTree {
	TidID: TidNode[];
	EnhetID: EnhetNode[];
}

// ── Data response types ───────────────────────────────────────────────────────
/**
 * One row returned by /Eksport/{id}/data?filter=...&format=Json
 * The response is a flat JSON array of these objects (no wrapper).
 *
 * Score is a Norwegian-formatted string: "3,6" (use parseUdirScore to convert).
 * Score = "*" means the value is suppressed (too few respondents).
 */
export interface UdirDataRow {
	SpoersmaalNivaa?: number;
	Spoersmaalgruppekode: string;
	Spoersmaalgruppe: string;
	Spoersmaalkode?: string;
	Spoersmaalnavn?: string;
	Skoleaarnavn?: string;
	EnhetNivaa: number;        // 1=national 2=county 3=municipality 4=school
	Nasjonaltkode?: string;
	Fylkekode?: string;
	Kommunekode?: string;
	Organisasjonsnummer?: string;
	EnhetNavn?: string;
	TrinnNivaa?: number;
	TrinnKode?: string;        // e.g. "7", "9", "10"
	Trinnnavn?: string;
	EierformNivaa?: number;
	Eierformkode?: number;
	EierformNavn?: string;
	KjoennNivaa?: number;
	KjoennKode?: string;       // "A"=alle  "G"=gutt  "J"=jente
	Kjoenn?: string;
	Score: string;             // "3,6" or "*" (suppressed)
	Standardavvik?: string;
	AntallBesvarelser?: string | number;
	[key: string]: unknown;
}

/** Parse a Norwegian Score string ("3,6") to a float. Returns null for "*" or invalid. */
export function parseUdirScore(score: string | undefined): number | null {
	if (!score || score === '*') return null;
	const n = parseFloat(score.replace(',', '.'));
	return isNaN(n) ? null : n;
}

// Legacy types kept for backward compat with statistikk page
export interface UdirDimensjon { dimensjonNavn: string; dimensjonVerdi: string; displayNavn?: string; }
export interface UdirRad { verdi: number | null; erSkjermet: boolean; dimensjoner: UdirDimensjon[]; }
export interface UdirRespons { data: UdirRad[]; }

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
 * Builds the Udir query string.
 * Keys are sorted alphabetically; values joined with comma if array.
 * Example: { EnhetID: 28027, TidID: 202412 } → "EnhetID(28027)_TidID(202412)"
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

/**
 * Fetches the full filter tree for an eksportId.
 * Returns { TidID: TidNode[], EnhetID: EnhetNode[] }.
 * This is the canonical way to discover available years and school units.
 */
export async function getFilterTree(eksportId: number): Promise<FilterTree> {
	const b = await base();
	return udirFetch<FilterTree>(`${b}/Eksport/${eksportId}/filterVerdier`, { ttl: 60 * 60_000 });
}

export async function getFilterSpec(tableId: number): Promise<FilterSpec[]> {
	const b = await base();
	return udirFetch<FilterSpec[]>(`${b}/Eksport/${tableId}/filterSpec`, { ttl: 60 * 60_000 });
}

/** @deprecated The UDIR API returns a FilterTree object, not a flat FilterVerdi[].
 *  Use getFilterTree() instead. Kept for legacy call sites. */
export async function getFilterVerdier(
	tableId: number,
	_filterId?: string
): Promise<FilterVerdi[]> {
	// The API ignores filterId and returns FilterTree; return empty to avoid confusion.
	void tableId;
	return [];
}

/**
 * Fetch data rows for a given eksportId with filter parameters.
 * Handles pagination automatically (fetches all pages).
 * Returns a flat array of UdirDataRow objects.
 *
 * Correct filter format (confirmed from API): filter=Key(val)_Key(val)
 * Example: filter=Kommunekode(0301)_TidID(202512)
 */
export async function getTableData(
	tableId: number,
	params: Record<string, string | number | (string | number)[]>
): Promise<UdirDataRow[]> {
	const b = await base();
	const filterStr = buildQuery(params);
	const PAGE = 5000;
	const allRows: UdirDataRow[] = [];

	for (let page = 1; ; page++) {
		const url = `${b}/Eksport/${tableId}/data?filter=${filterStr}&format=Json&antallRader=${PAGE}&sideNummer=${page}`;
		const rows = await udirFetch<UdirDataRow[]>(url, { ttl: 10 * 60_000 });
		if (!Array.isArray(rows) || rows.length === 0) break;
		allRows.push(...rows);
		if (rows.length < PAGE) break; // last page
	}

	return allRows;
}

/** @deprecated Use UdirDataRow fields directly instead of getDim. */
export function getDim(rad: UdirRad, navn: string): string | undefined {
	return rad.dimensjoner.find(d => d.dimensjonNavn.toLowerCase() === navn.toLowerCase())
		?.dimensjonVerdi;
}
