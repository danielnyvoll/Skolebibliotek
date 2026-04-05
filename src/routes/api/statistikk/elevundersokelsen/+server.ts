import { json } from '@sveltejs/kit';
import {
	getFilterTree,
	getTableData,
	parseUdirScore,
	setElevBase,
	EKSPORT_ID,
	type EksportIdKey,
	type UdirDataRow
} from '$lib/api/udir/elevundersokelsenClient';
import { env } from '$env/dynamic/private';

function initEnvOverride() {
	if (env.UDIR_API_URL) setElevBase(env.UDIR_API_URL);
}

/**
 * Convert a flat UdirDataRow to the legacy UdirRad shape the frontend expects.
 * UdirRad: { verdi, erSkjermet, dimensjoner: [{ dimensjonNavn, dimensjonVerdi }] }
 */
function toRad(row: UdirDataRow, year: string) {
	const score = parseUdirScore(row.Score);
	const erSkjermet = row.Score === '*';
	return {
		verdi: erSkjermet ? null : score,
		erSkjermet,
		dimensjoner: [
			{
				dimensjonNavn: 'IndikatorNavn',
				dimensjonVerdi: row.Spoersmaalgruppe ?? row.Spoersmaalgruppekode ?? 'Ukjent'
			},
			{ dimensjonNavn: 'Aar', dimensjonVerdi: year },
			...(row.TrinnKode ? [{ dimensjonNavn: 'Trinn', dimensjonVerdi: row.TrinnKode }] : []),
			...(row.EnhetNavn ? [{ dimensjonNavn: 'EnhetNavn', dimensjonVerdi: row.EnhetNavn }] : [])
		]
	};
}

export async function GET({ url }) {
	initEnvOverride();

	const tabelKey = (url.searchParams.get('tabell') ?? 'INDIKATOR_GRUNNSKOLE') as EksportIdKey;
	const nivaa = url.searchParams.get('nivaa') ?? 'fylke';
	const geografi = url.searchParams.get('geografi') ?? '';
	const aarParam = url.searchParams.get('aar') ?? '2023';
	const trinn = url.searchParams.get('trinn') ?? '7';

	const tableId = EKSPORT_ID[tabelKey] ?? EKSPORT_ID.INDIKATOR_GRUNNSKOLE;

	try {
		// ── Resolve TidID from filter tree ────────────────────────────────────
		const tree = await getFilterTree(tableId);

		const aarInt = parseInt(aarParam);
		const tid = tree.TidID.find(t => Math.floor(t.id / 100) === aarInt);
		if (!tid) {
			const available = tree.TidID.map(t => Math.floor(t.id / 100));
			return json({
				data: { data: [] },
				_debug: { error: `Ingen data for år ${aarParam}`, availableYears: available }
			});
		}

		// ── Build query params ────────────────────────────────────────────────
		const params: Record<string, string | number> = { TidID: tid.id };

		if (geografi) {
			if (nivaa === 'kommune') {
				// Kommunekode is 4-digit, zero-pad if needed
				params['Kommunekode'] = geografi.padStart(4, '0');
			} else if (nivaa === 'fylke') {
				// Find the UDIR county node by kode (zero-padded 2-digit county code)
				const geoNorm = geografi.padStart(2, '0');
				const fylkeNode = tree.EnhetID.find(
					n => n.nivaa === 2 && (n.kode === geoNorm || n.kode === geografi)
				);
				if (fylkeNode) {
					params['EnhetID'] = fylkeNode.id;
				} else {
					const available = tree.EnhetID.filter(n => n.nivaa === 2).map(n => ({ kode: n.kode, navn: n.navn }));
					console.warn(`[elevundersokelsen] fylke kode=${geografi} ikke funnet i UDIR-treet`);
					return json({
						data: { data: [] },
						_debug: { error: `Fylke kode=${geografi} ikke funnet`, available }
					});
				}
			} else if (nivaa === 'skole') {
				// School level — try by org number (kode at nivaa=4) or EnhetID
				const schoolNode = tree.EnhetID.find(
					n => n.nivaa === 4 && (n.kode === geografi || String(n.id) === geografi)
				);
				if (schoolNode) {
					params['EnhetID'] = schoolNode.id;
				} else {
					params['Organisasjonsnummer'] = geografi;
				}
			}
		}

		// ── Fetch flat rows ───────────────────────────────────────────────────
		const rows = await getTableData(tableId, params);

		// ── Filter to correct entity level, all-gender, and selected grade ────
		const entityNivaa = nivaa === 'fylke' ? 2 : nivaa === 'kommune' ? 3 : 4;
		const filtered = rows.filter(r => {
			if (r.EnhetNivaa !== entityNivaa) return false;
			if (r.KjoennKode !== 'A') return false; // all-gender aggregate only
			if (trinn && r.TrinnKode && r.TrinnKode !== trinn) return false;
			return true;
		});

		// ── Convert to legacy UdirRad format expected by the frontend ─────────
		const rader = filtered.map(r => toRad(r, aarParam));

		return json({
			data: { data: rader },
			_debug: { tidKode: tid.kode, tidNavn: tid.navn, params, rowsTotal: rows.length, rowsFiltered: rader.length }
		});
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		console.error('[elevundersokelsen] error:', msg);
		return json({ error: msg }, { status: 502 });
	}
}
