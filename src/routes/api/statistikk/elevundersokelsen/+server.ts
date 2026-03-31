import { json } from '@sveltejs/kit';
import {
	getTableData,
	listTables,
	setElevBase,
	TABELLER
} from '$lib/api/udir/elevundersokelsenClient';
import { env } from '$env/dynamic/private';

function initBase() {
	if (env.UDIR_API_URL) setElevBase(env.UDIR_API_URL);
}

export async function GET({ url }) {
	initBase();

	const action = url.searchParams.get('action'); // tables | data
	if (action === 'tables') {
		try {
			const data = await listTables();
			return json({ data });
		} catch (e: unknown) {
			return json({ error: String(e) }, { status: 502 });
		}
	}

	// action === 'data' (default)
	const nivaa = url.searchParams.get('nivaa') ?? 'fylke'; // nasjonalt | fylke | kommune | skole
	const geografi = url.searchParams.get('geografi') ?? '';
	const aarParam = url.searchParams.get('aar') ?? '2023';
	const trinn = url.searchParams.get('trinn') ?? '7';

	const tableNr =
		nivaa === 'skole'
			? TABELLER.SKOLE
			: nivaa === 'kommune'
				? TABELLER.KOMMUNE
				: nivaa === 'fylke'
					? TABELLER.FYLKE
					: TABELLER.NASJONALT;

	const params: Record<string, string | number | (string | number)[]> = {
		Trinn: trinn,
		Aar: aarParam
	};
	if (geografi) params['Geografi'] = geografi;

	try {
		const result = await getTableData(tableNr, params);
		return json({ data: result });
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		console.error('[elevundersokelsen]', msg);
		return json({ error: msg }, { status: 502 });
	}
}
