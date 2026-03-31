import { json } from '@sveltejs/kit';
import {
	getTableData,
	getFilterSpec,
	getFilterVerdier,
	setElevBase,
	buildQuery,
	EKSPORT_ID,
	type EksportIdKey
} from '$lib/api/udir/elevundersokelsenClient';
import { resolveBase } from '$lib/api/udir/baseResolver';
import { env } from '$env/dynamic/private';

function initEnvOverride() {
	if (env.UDIR_API_URL) setElevBase(env.UDIR_API_URL);
}

export async function GET({ url }) {
	initEnvOverride();

	const action = url.searchParams.get('action') ?? 'data';

	// ── Debug info ───────────────────────────────────────────────────────────
	if (action === 'debug') {
		const base = await resolveBase();
		const tabelKey = (url.searchParams.get('tabell') ?? 'INDIKATOR_GRUNNSKOLE') as EksportIdKey;
		const tableId = EKSPORT_ID[tabelKey] ?? EKSPORT_ID.INDIKATOR_GRUNNSKOLE;
		const sampleParams = { Aar: '2023', Trinn: '7' };
		const sampleUrl = `${base}/Eksport/${tableId}/data?${buildQuery(sampleParams)}`;

		let sampleStatus: number | null = null;
		try {
			const ctrl = new AbortController();
			setTimeout(() => ctrl.abort(), 8_000);
			const res = await fetch(sampleUrl, { signal: ctrl.signal });
			sampleStatus = res.status;
		} catch {
			sampleStatus = null;
		}

		console.info('[udir debug] base:', base, '| sample URL:', sampleUrl, '| status:', sampleStatus);
		return json({ base, sampleUrl, sampleStatus, eksportIds: EKSPORT_ID });
	}

	// ── filterSpec ───────────────────────────────────────────────────────────
	if (action === 'filterspec') {
		const tabelKey = (url.searchParams.get('tabell') ?? 'INDIKATOR_GRUNNSKOLE') as EksportIdKey;
		const tableId = EKSPORT_ID[tabelKey] ?? EKSPORT_ID.INDIKATOR_GRUNNSKOLE;
		try {
			const data = await getFilterSpec(tableId);
			return json({ data });
		} catch (e: unknown) {
			return json({ error: String(e) }, { status: 502 });
		}
	}

	// ── filterVerdier ────────────────────────────────────────────────────────
	if (action === 'filterverdier') {
		const tabelKey = (url.searchParams.get('tabell') ?? 'INDIKATOR_GRUNNSKOLE') as EksportIdKey;
		const tableId = EKSPORT_ID[tabelKey] ?? EKSPORT_ID.INDIKATOR_GRUNNSKOLE;
		const filterId = url.searchParams.get('filterId') ?? undefined;
		try {
			const data = await getFilterVerdier(tableId, filterId);
			return json({ data });
		} catch (e: unknown) {
			return json({ error: String(e) }, { status: 502 });
		}
	}

	// ── Data ─────────────────────────────────────────────────────────────────
	const tabelKey = (url.searchParams.get('tabell') ?? 'INDIKATOR_GRUNNSKOLE') as EksportIdKey;
	const geografi = url.searchParams.get('geografi') ?? '';
	const aarParam = url.searchParams.get('aar') ?? '2023';
	const trinn = url.searchParams.get('trinn') ?? '7';

	const tableId = EKSPORT_ID[tabelKey] ?? EKSPORT_ID.INDIKATOR_GRUNNSKOLE;

	// Build params — keys will be sorted alphabetically inside buildQuery
	const params: Record<string, string | number | (string | number)[]> = {
		Aar: aarParam,
		Trinn: trinn
	};
	if (geografi) params['Geografi'] = geografi;

	const base = await resolveBase();
	const qs = buildQuery(params);
	const dataUrl = `${base}/Eksport/${tableId}/data?${qs}`;
	console.info('[udir] fetching:', dataUrl);

	try {
		const result = await getTableData(tableId, params);
		return json({ data: result, _debug: { base, url: dataUrl } });
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		console.error('[elevundersokelsen] error:', msg, '| url:', dataUrl);
		return json({ error: msg, _debug: { base, url: dataUrl } }, { status: 502 });
	}
}
