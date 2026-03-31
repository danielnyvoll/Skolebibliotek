import { udirFetch } from './fetchWrapper';

// Base URL — override via NXR_API_URL env on server side
export let NXR_BASE = 'https://data-nxr-fellestjeneste.udir.no';

export interface Fylke {
	fylkesnummer: string;
	navn: string;
}

export interface Kommune {
	kommunenummer: string;
	navn: string;
	fylkesnummer: string;
}

export interface Skole {
	nsrId: string;
	navn: string;
	kommunenummer: string;
	kommuneNavn: string;
	fylkesnummer: string;
	organisasjonsnummer?: string;
}

export function setNxrBase(url: string) {
	NXR_BASE = url;
}

export async function getFylker(): Promise<Fylke[]> {
	// NOTE: verify exact endpoint path against Swagger at /swagger/index.html
	return udirFetch<Fylke[]>(`${NXR_BASE}/api/Geografi/fylke`, { ttl: 30 * 60_000 });
}

export async function getKommuner(fylkesnummer?: string): Promise<Kommune[]> {
	const qs = fylkesnummer ? `?fylkenummer=${fylkesnummer}` : '';
	return udirFetch<Kommune[]>(`${NXR_BASE}/api/Geografi/kommune${qs}`, { ttl: 30 * 60_000 });
}

export async function getSkoler(kommunenummer: string): Promise<Skole[]> {
	return udirFetch<Skole[]>(
		`${NXR_BASE}/api/Geografi/enhet?kommunenummer=${kommunenummer}`,
		{ ttl: 30 * 60_000 }
	);
}
