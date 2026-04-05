import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	EKSPORT_ID,
	getFilterTree,
	getTableData,
	parseUdirScore,
	setElevBase,
	type TidNode
} from '$lib/api/udir/elevundersokelsenClient';
import { resolveBase, CANDIDATE_BASES } from '$lib/api/udir/baseResolver';
import { getOsloSkoler, getRawGeoSample } from '$lib/api/udir/nsrClient';
import db from '$lib/server/db';
import { env } from '$env/dynamic/private';

function initEnvOverride() {
	if (env.UDIR_API_URL) setElevBase(env.UDIR_API_URL);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeDirection(metricName: string): 'higher_is_better' | 'lower_is_better' {
	const n = metricName.toLowerCase();
	return n.includes('mobbing') || n.includes('krenk') || n.includes('uro')
		? 'lower_is_better'
		: 'higher_is_better';
}

/** TidID codes look like 202412 (2024-25 school year). Extract the start year: 2024. */
function tidToYear(tid: TidNode): number {
	return Math.floor(tid.id / 100);
}

async function upsertSchool(nsr_id: string, navn: string, kommunenummer = '0301') {
	await db`
    INSERT INTO udir_school (nsr_id, navn, kommunenummer, synced_at)
    VALUES (${nsr_id}, ${navn}, ${kommunenummer}, NOW())
    ON CONFLICT (nsr_id) DO UPDATE SET
      navn        = EXCLUDED.navn,
      kommunenummer = EXCLUDED.kommunenummer,
      synced_at   = NOW()
  `;
}

async function upsertMetric(
	nsr_id: string,
	aar: number,
	trinn: string,
	eksport_id: number,
	indikator_navn: string,
	verdi: number | null,
	er_skjermet: boolean,
	direction: string,
	raw: unknown
) {
	await db`
    INSERT INTO udir_school_metric
      (nsr_id, aar, trinn, eksport_id, indikator_navn, verdi, er_skjermet, direction, raw)
    VALUES (
      ${nsr_id}, ${aar}, ${trinn}, ${eksport_id},
      ${indikator_navn},
      ${er_skjermet ? null : (verdi ?? null)},
      ${er_skjermet},
      ${direction},
      ${JSON.stringify(raw)}
    )
    ON CONFLICT (nsr_id, aar, trinn, eksport_id, indikator_navn) DO UPDATE SET
      verdi       = EXCLUDED.verdi,
      er_skjermet = EXCLUDED.er_skjermet,
      direction   = EXCLUDED.direction,
      raw         = EXCLUDED.raw
  `;
}

// ── GET — debug/discovery (no auth needed) ────────────────────────────────────
export const GET: RequestHandler = async () => {
	initEnvOverride();

	if (env.UDIR_ENABLED !== 'true') {
		return json({ enabled: false });
	}

	// ── Step 1: probe base URLs ───────────────────────────────────────────────
	const baseProbes: { url: string; status: string }[] = [];
	let resolvedBase: string | null = null;
	for (const candidate of CANDIDATE_BASES) {
		try {
			const ctrl = new AbortController();
			setTimeout(() => ctrl.abort(), 6_000);
			const res = await fetch(`${candidate}/Eksport`, { signal: ctrl.signal });
			baseProbes.push({ url: candidate, status: `HTTP ${res.status}` });
			if (res.ok && !resolvedBase) resolvedBase = candidate;
		} catch (e: unknown) {
			baseProbes.push({ url: candidate, status: `ERROR: ${e instanceof Error ? e.message : String(e)}` });
		}
	}

	// ── Step 2: filter tree (confirms API parameters) ─────────────────────────
	let filterTreeError: string | null = null;
	let availableYears: { kode: string; navn: string; year: number }[] = [];
	try {
		const tree = await getFilterTree(148);
		availableYears = tree.TidID.map(t => ({ kode: t.kode, navn: t.navn, year: tidToYear(t) }));
	} catch (e: unknown) {
		filterTreeError = e instanceof Error ? e.message : String(e);
	}

	// ── Step 3: school discovery ──────────────────────────────────────────────
	const [skoler, geoSample] = await Promise.all([
		getOsloSkoler(),
		getRawGeoSample()
	]);

	// ── Step 4: filterSpec — shows required parameter names for data endpoint ──
	let filterSpec: unknown = null;
	let filterSpecError: string | null = null;
	try {
		const b = resolvedBase ?? 'https://api.statistikkbanken.udir.no/api/rest/v2';
		const res = await fetch(`${b}/Eksport/148/filterSpec`);
		filterSpec = await res.json();
	} catch (e: unknown) {
		filterSpecError = e instanceof Error ? e.message : String(e);
	}

	// ── Step 5: probe multiple data URL formats to find which works ────────────
	const dataProbes: { format: string; url: string; status: number | string }[] = [];
	if (skoler.length > 0 && availableYears.length > 0) {
		const school = skoler[0];
		const tid = availableYears[0];
		const b = resolvedBase ?? 'https://api.statistikkbanken.udir.no/api/rest/v2';
		const enhetId = parseInt(school.nsrId);
		const tidId = parseInt(tid.kode);

		const statBase = 'https://statistikkportalen.udir.no/api/rapportering/rest/v1';
		const formats: { label: string; url: string }[] = [
			// New format: filter= named param + statistikkportalen base
			{ label: 'stat/v1 filter=TidID+EnhetID',       url: `${statBase}/Eksport/148/data?filter=TidID(${tidId})_EnhetID(${enhetId})&format=Json&antallRader=100` },
			{ label: 'stat/v1 filter=TidID only',          url: `${statBase}/Eksport/148/data?filter=TidID(${tidId})&format=Json&antallRader=10` },
			{ label: 'stat/v1 filter=Kommunekode bulk',    url: `${statBase}/Eksport/148/data?filter=Kommunekode(0301)_TidID(${tidId})&format=Json&antallRader=100` },
			// Same with existing api.statistikkbanken base
			{ label: 'apiv2 filter=TidID+EnhetID',         url: `${b}/Eksport/148/data?filter=TidID(${tidId})_EnhetID(${enhetId})&format=Json&antallRader=100` },
			{ label: 'apiv2 filter=TidID only',            url: `${b}/Eksport/148/data?filter=TidID(${tidId})&format=Json&antallRader=10` },
			// Oslo EnhetID node (-17)
			{ label: 'stat/v1 filter=Oslo EnhetID(-17)',   url: `${statBase}/Eksport/148/data?filter=EnhetID(-17)_TidID(${tidId})&format=Json&antallRader=100` },
		];

		for (const f of formats) {
			try {
				const ctrl = new AbortController();
				setTimeout(() => ctrl.abort(), 8_000);
				const res = await fetch(f.url, { signal: ctrl.signal });
				let status: string;
				if (res.ok) {
					const body = await res.json();
					const bodyStr = JSON.stringify(body).slice(0, 600);
					status = `HTTP 200 — ${bodyStr}`;
				} else {
					// Capture response body for 4xx errors so we can read the API's error message
					let body = '';
					try { body = await res.text(); } catch { /* ignore */ }
					status = `HTTP ${res.status} — ${body.slice(0, 300)}`;
				}
				dataProbes.push({ format: f.label, url: f.url, status });
			} catch (e: unknown) {
				dataProbes.push({ format: f.label, url: f.url, status: `ERROR: ${e instanceof Error ? e.message : String(e)}` });
			}
		}
	}

	return json({
		enabled: true,
		resolvedBase,
		baseProbes,
		filterTreeError,
		filterSpec,
		filterSpecError,
		availableYears,
		schoolsDiscovered: skoler.length,
		schools: skoler.slice(0, 5),
		dataProbes,
	});
};

// ── POST — full ingest (requires Authorization: Bearer <INGEST_SECRET>) ───────
export const POST: RequestHandler = async ({ request, url }) => {
	initEnvOverride();

	if (env.UDIR_ENABLED !== 'true') {
		throw error(503, 'UDIR_ENABLED is not set');
	}

	const authHeader = request.headers.get('authorization') ?? '';
	const secret = env.INGEST_SECRET ?? '';
	if (!secret || authHeader !== `Bearer ${secret}`) {
		throw error(401, 'Unauthorized');
	}

	// ── Discover available years from the filter tree ─────────────────────────
	const tree = await getFilterTree(EKSPORT_ID.INDIKATOR_GRUNNSKOLE);

	// Allow caller to limit years, default to latest 3
	const aarParam = url.searchParams.get('aar'); // e.g. "2024,2023" (start year)
	let tids: TidNode[];
	if (aarParam) {
		const requestedYears = new Set(aarParam.split(',').map(s => parseInt(s.trim())));
		tids = tree.TidID.filter(t => requestedYears.has(tidToYear(t)));
	} else {
		tids = tree.TidID.slice(0, 3); // latest 3 school years
	}

	if (tids.length === 0) {
		return json({ ok: false, error: 'No matching TidID entries found', availableYears: tree.TidID });
	}

	// ── Discover Oslo schools ─────────────────────────────────────────────────
	const skoler = await getOsloSkoler(EKSPORT_ID.INDIKATOR_GRUNNSKOLE);
	if (skoler.length === 0) {
		return json({ ok: false, error: 'No Oslo schools discovered — check server log for tree diagnostics' });
	}

	// Confirmed API format (from probe results):
	//   filter=Kommunekode(0301)_TidID(202512)  → bulk Oslo, all schools at once
	//   Response: flat UdirDataRow[]
	//   EnhetNivaa=4 → school level  KjoennKode="A" → all-gender aggregate
	//   Score: "3,6" (Norwegian decimal) or "*" (suppressed)

	// Index schools by org number for fast lookup during bulk processing
	const skoleByOrg = new Map(skoler.map(s => [s.kode, s]));
	// Pre-upsert all schools so FK constraint is satisfied before metrics
	for (const skole of skoler) {
		try { await upsertSchool(skole.nsrId, skole.navn, skole.kommunenummer); }
		catch (e) { console.error('[ingest] upsertSchool', skole.nsrId, e); }
	}

	const eksportIds = [EKSPORT_ID.INDIKATOR_GRUNNSKOLE, EKSPORT_ID.TEMA_GRUNNSKOLE];
	let totalRows = 0;
	let errors    = 0;
	let bulkHits  = 0;

	for (const tid of tids) {
		const aar = tidToYear(tid);

		for (const eksportId of eksportIds) {

			// ── Strategy A: single bulk call — Kommunekode(0301) ─────────────
			let bulkSucceeded = false;
			try {
				const rows = await getTableData(eksportId, {
					Kommunekode: '0301',
					TidID: tid.id
				});

				if (rows.length > 0) {
					bulkSucceeded = true;
					bulkHits++;
					console.info(`[ingest] bulk aar=${aar} eksportId=${eksportId} → ${rows.length} total rows`);

					for (const row of rows) {
						// Only school-level, all-gender aggregate rows
						if (row.EnhetNivaa !== 4) continue;
						if (row.KjoennKode !== 'A') continue;

						const orgNr = row.Organisasjonsnummer;
						const skole = orgNr ? skoleByOrg.get(orgNr) : undefined;
						if (!skole) continue;

						const verdi = parseUdirScore(row.Score);
						const erSkjermet = row.Score === '*';
						const indikatorNavn = row.Spoersmaalgruppe ?? row.Spoersmaalgruppekode ?? 'ukjent';
						const trinnKode = row.TrinnKode ?? 'all';
						const direction = computeDirection(indikatorNavn);

						try {
							await upsertMetric(skole.nsrId, aar, trinnKode, eksportId,
								indikatorNavn, verdi, erSkjermet, direction, row);
							totalRows++;
						} catch (e) {
							console.error(`[ingest upsert] ${skole.nsrId} aar=${aar}:`, e);
							errors++;
						}
					}
				}
			} catch (e) {
				console.warn(`[ingest] bulk failed eksportId=${eksportId} aar=${aar}, falling back:`, e);
			}

			if (bulkSucceeded) continue;

			// ── Strategy B: per-school fallback ───────────────────────────────
			console.info(`[ingest] per-school fallback: eksportId=${eksportId} aar=${aar}`);
			for (const skole of skoler) {
				try {
					const rows = await getTableData(eksportId, {
						Organisasjonsnummer: skole.kode,
						TidID: tid.id
					});

					for (const row of rows) {
						if (row.EnhetNivaa !== 4) continue;
						if (row.KjoennKode !== 'A') continue;

						const verdi = parseUdirScore(row.Score);
						const erSkjermet = row.Score === '*';
						const indikatorNavn = row.Spoersmaalgruppe ?? row.Spoersmaalgruppekode ?? 'ukjent';
						const trinnKode = row.TrinnKode ?? 'all';
						const direction = computeDirection(indikatorNavn);

						try {
							await upsertMetric(skole.nsrId, aar, trinnKode, eksportId,
								indikatorNavn, verdi, erSkjermet, direction, row);
							totalRows++;
						} catch (e) {
							console.error(`[ingest upsert] ${skole.nsrId} aar=${aar}:`, e);
							errors++;
						}
					}
				} catch (e) {
					console.error(`[ingest] school=${skole.nsrId} aar=${aar} eksportId=${eksportId}:`, e);
					errors++;
				}
			}
		}
	}

	return json({
		ok: true,
		years: tids.map(t => ({ kode: t.kode, navn: t.navn, year: tidToYear(t) })),
		schoolsProcessed: skoler.length,
		bulkHits,
		totalRows,
		errors
	});
};
