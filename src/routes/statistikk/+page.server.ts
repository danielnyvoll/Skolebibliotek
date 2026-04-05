import type { PageServerLoad } from './$types';
import { getFylker, setNxrBase } from '$lib/api/udir/nxrClient';
import { isOstlandet } from '$lib/api/udir/ostlandet';
import { env } from '$env/dynamic/private';
import db from '$lib/server/db';

// ── Oslo ranking types (exported for use in +page.svelte) ─────────────────────

export interface MetricDef {
	key: string;
	short: string;
	direction: 'higher_is_better' | 'lower_is_better';
	set: 'standard' | 'laeringsmiljo' | 'mobbing';
}

export interface SchoolRow {
	nsr_id: string;
	navn: string;
	totalByYear: Record<number, number | null>;
	metricByYear: Record<string, Record<number, number | null>>;
}

// ── Metric helpers ────────────────────────────────────────────────────────────

function metricDirection(name: string): MetricDef['direction'] {
	const n = name.toLowerCase();
	return n.includes('mobbing') || n.includes('krenk') || n.includes('uro')
		? 'lower_is_better'
		: 'higher_is_better';
}

function metricSet(name: string): MetricDef['set'] {
	const n = name.toLowerCase();
	if (n.includes('mobbing') || n.includes('krenk')) return 'mobbing';
	if (
		n.includes('demokrati') ||
		n.includes('medvirk') ||
		n.includes('hjemmefra') ||
		n.includes('fysisk')
	)
		return 'laeringsmiljo';
	return 'standard';
}

function shortLabel(name: string): string {
	const n = name.toLowerCase();
	if (n.includes('trivsel')) return 'Trivsel';
	if (n.includes('motivasjon')) return 'Motivasjon';
	if (n.includes('faglig')) return 'Faglig utf.';
	if (n.includes('mestring')) return 'Mestring';
	if (n.includes('læringskultur')) return 'Lær.kult.';
	if (n.includes('lærer')) return 'Lærerstøtte';
	if (n.includes('hjemmefra')) return 'Hjemstøtte';
	if (n.includes('demokrati')) return 'Demokrati';
	if (n.includes('medvirk')) return 'Medvirkning';
	if (n.includes('fysisk')) return 'Fysisk milj.';
	if (n.includes('mobbing')) return 'Mobbing';
	if (n.includes('krenk')) return 'Krenkelser';
	return name.length > 10 ? name.slice(0, 9) + '…' : name;
}

function normalize(verdi: number, dir: MetricDef['direction']): number {
	const raw = Math.max(0, Math.min(1, (verdi - 1) / 4));
	return Math.round((dir === 'lower_is_better' ? 1 - raw : raw) * 100);
}

// ── Oslo ranking loader ───────────────────────────────────────────────────────

async function loadOsloRanking() {
	const empty = {
		enabled: false as boolean,
		debug: { schoolCount: 0, metricRowCount: 0, years: [] as number[], sampleMetrics: [] as string[] },
		years: [] as number[],
		latestYear: null as number | null,
		metrics: [] as MetricDef[],
		schools: [] as SchoolRow[]
	};

	if (env.UDIR_ENABLED !== 'true') return empty;

	try {
		const [[{ school_count }], [{ metric_count }]] = await Promise.all([
			db<{ school_count: number }[]>`SELECT COUNT(*)::int AS school_count FROM udir_school`,
			db<{ metric_count: number }[]>`SELECT COUNT(*)::int AS metric_count FROM udir_school_metric`
		]);

		if (school_count === 0) {
			return { ...empty, enabled: true };
		}

		const [yearRows, metricRows] = await Promise.all([
			db<{ aar: number }[]>`SELECT DISTINCT aar FROM udir_school_metric ORDER BY aar`,
			db<{ indikator_navn: string; n: number }[]>`
				SELECT indikator_navn, COUNT(*)::int AS n
				FROM udir_school_metric
				WHERE NOT er_skjermet AND verdi IS NOT NULL
				GROUP BY indikator_navn
				ORDER BY n DESC
				LIMIT 20
			`
		]);

		const years = yearRows.map(r => r.aar);
		const latestYear = years[years.length - 1] ?? null;
		const minCount = Math.max(3, Math.floor(school_count * 0.1));

		const metrics: MetricDef[] = metricRows
			.filter(r => r.n >= minCount)
			.slice(0, 15)
			.map(r => ({
				key: r.indikator_navn,
				short: shortLabel(r.indikator_navn),
				direction: metricDirection(r.indikator_navn),
				set: metricSet(r.indikator_navn)
			}));

		const rawRows = await db<{
			nsr_id: string;
			navn: string;
			aar: number;
			indikator_navn: string;
			avg_verdi: number;
			direction: string;
		}[]>`
			SELECT
				m.nsr_id,
				s.navn,
				m.aar,
				m.indikator_navn,
				AVG(m.verdi)::float AS avg_verdi,
				MAX(m.direction)   AS direction
			FROM udir_school_metric m
			JOIN udir_school s ON s.nsr_id = m.nsr_id
			WHERE NOT m.er_skjermet
				AND m.verdi IS NOT NULL
				AND m.indikator_navn = ANY(${metrics.map(m => m.key)})
			GROUP BY m.nsr_id, s.navn, m.aar, m.indikator_navn
		`;

		const schoolMap = new Map<string, SchoolRow>();
		for (const row of rawRows) {
			if (!schoolMap.has(row.nsr_id)) {
				schoolMap.set(row.nsr_id, {
					nsr_id: row.nsr_id,
					navn: row.navn,
					totalByYear: {},
					metricByYear: {}
				});
			}
			const s = schoolMap.get(row.nsr_id)!;
			const metricDef = metrics.find(m => m.key === row.indikator_navn);
			const dir = (metricDef?.direction ?? row.direction) as MetricDef['direction'];
			const score = normalize(row.avg_verdi, dir);
			if (!s.metricByYear[row.indikator_navn]) s.metricByYear[row.indikator_navn] = {};
			s.metricByYear[row.indikator_navn][row.aar] = score;
		}

		for (const school of schoolMap.values()) {
			for (const year of years) {
				const vals = metrics
					.map(m => school.metricByYear[m.key]?.[year] ?? null)
					.filter((v): v is number => v !== null);
				school.totalByYear[year] = vals.length >= 3
					? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
					: null;
			}
		}

		const schools = Array.from(schoolMap.values()).sort((a, b) => {
			const as_ = latestYear ? (a.totalByYear[latestYear] ?? -1) : -1;
			const bs_ = latestYear ? (b.totalByYear[latestYear] ?? -1) : -1;
			return bs_ - as_;
		});

		return {
			enabled: true,
			debug: {
				schoolCount: school_count,
				metricRowCount: metric_count,
				years,
				sampleMetrics: metricRows.slice(0, 6).map(r => r.indikator_navn)
			},
			years,
			latestYear,
			metrics,
			schools
		};
	} catch (e) {
		console.error('[statistikk] oslo load error:', e);
		return { ...empty, enabled: true };
	}
}

// ── Page load ─────────────────────────────────────────────────────────────────

export const load: PageServerLoad = async () => {
	if (env.NXR_API_URL) setNxrBase(env.NXR_API_URL);

	let fylker: Awaited<ReturnType<typeof getFylker>> = [];
	let geoError: string | null = null;
	try {
		const alle = await getFylker();
		fylker = alle
			.filter(f => isOstlandet(f.navn))
			.sort((a, b) => a.navn.localeCompare(b.navn, 'nb'));
	} catch (e: unknown) {
		geoError = e instanceof Error ? e.message : String(e);
	}

	const oslo = await loadOsloRanking();

	return { fylker, geoError, oslo };
};
