import { json } from '@sveltejs/kit';
import {
	getTableData,
	getFilterSpec,
	getFilterVerdier,
	listTables,
	setElevBase,
	buildQuery,
	TABELLER
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
		const tableId = Number(url.searchParams.get('tableId') ?? TABELLER.FYLKE);
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
		return json({ base, sampleUrl, sampleStatus });
	}

	// ── Available tables ─────────────────────────────────────────────────────
	if (action === 'tables') {
		try {
			const data = await listTables();
			return json({ data });
		} catch (e: unknown) {
			return json({ error: String(e) }, { status: 502 });
		}
	}

	// ── filterSpec ───────────────────────────────────────────────────────────
	if (action === 'filterspec') {
		const tableId = Number(url.searchParams.get('tableId') ?? TABELLER.FYLKE);
		try {
			const data = await getFilterSpec(tableId);
			return json({ data });
		} catch (e: unknown) {
			return json({ error: String(e) }, { status: 502 });
		}
	}

	// ── filterVerdier ────────────────────────────────────────────────────────
	if (action === 'filterverdier') {
		const tableId = Number(url.searchParams.get('tableId') ?? TABELLER.FYLKE);
		const filterId = url.searchParams.get('filterId') ?? undefined;
		try {
			const data = await getFilterVerdier(tableId, filterId);
			return json({ data });
		} catch (e: unknown) {
			return json({ error: String(e) }, { status: 502 });
		}
	}

	// ── Data ─────────────────────────────────────────────────────────────────
	const nivaa = url.searchParams.get('nivaa') ?? 'fylke';
	const geografi = url.searchParams.get('geografi') ?? '';
	const aarParam = url.searchParams.get('aar') ?? '2023';
	const trinn = url.searchParams.get('trinn') ?? '7';

	const tableId =
		nivaa === 'skole'
			? TABELLER.SKOLE
			: nivaa === 'kommune'
				? TABELLER.KOMMUNE
				: nivaa === 'fylke'
					? TABELLER.FYLKE
					: TABELLER.NASJONALT;

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
