import { udirFetch } from './fetchWrapper';

export let ELEV_BASE = 'https://api.udir-statistikkbanken.no/api/rest/v2';

// Known table numbers — verify/extend against /api/rest/v2/Eksport
export const TABELLER = {
	NASJONALT: 1,
	FYLKE: 2,
	KOMMUNE: 3,
	SKOLE: 4
} as const;

export interface UdirDimensjon {
	dimensjonNavn: string;
	dimensjonVerdi: string;
	displayNavn?: string;
}

export interface UdirRad {
	verdi: number | null;
	erSkjermet: boolean; // prikket/skjermet verdi
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

export function setElevBase(url: string) {
	ELEV_BASE = url;
}

/**
 * Builds Udir-style query string: Aar(2023)_Trinn(7)_Geografi(Fylke_03)
 * Params with array values join with comma: Aar(2022,2023)
 */
export function buildQuery(params: Record<string, string | number | (string | number)[]>): string {
	return Object.entries(params)
		.map(([k, v]) => {
			const val = Array.isArray(v) ? v.join(',') : v;
			return `${k}(${val})`;
		})
		.join('_');
}

export async function getTableData(
	tableNr: number,
	params: Record<string, string | number | (string | number)[]>
): Promise<UdirRespons> {
	const qs = buildQuery(params);
	const url = `${ELEV_BASE}/Eksport/${tableNr}/data?${qs}`;
	return udirFetch<UdirRespons>(url, { ttl: 10 * 60_000 });
}

export async function listTables(): Promise<unknown[]> {
	return udirFetch<unknown[]>(`${ELEV_BASE}/Eksport`, { ttl: 60 * 60_000 });
}

/** Helper: extract a dimension value by name from a row */
export function getDim(rad: UdirRad, navn: string): string | undefined {
	return rad.dimensjoner.find(d => d.dimensjonNavn.toLowerCase() === navn.toLowerCase())
		?.dimensjonVerdi;
}
