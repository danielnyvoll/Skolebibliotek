<script lang="ts">
	import { browser } from '$app/environment';
	import type { PageData } from './$types';
	import type { MetricDef, SchoolRow } from './+page.server';
	import { parseNorwegianDecimal } from '$lib/utils';

	let { data }: { data: PageData } = $props();

	// ── Types ──────────────────────────────────────────────────────────────────
	interface GeoItem {
		fylkesnummer?: string;
		kommunenummer?: string;
		nsrId?: string;
		navn: string;
	}
	interface UdirRad {
		verdi: number | string | null;
		erSkjermet: boolean;
		dimensjoner: Array<{ dimensjonNavn: string; dimensjonVerdi: string; displayNavn?: string }>;
	}
	interface ProcessedRow {
		navn: string;
		score: number | null;
		erSkjermet: boolean;
		trend: (number | null)[];
		aar: string[];
	}

	// ── Constants ──────────────────────────────────────────────────────────────
	const TABELL_OPTIONS = [
		{ value: 'INDIKATOR_GRUNNSKOLE', label: 'Indikator – grunnskole' },
		{ value: 'TEMA_GRUNNSKOLE', label: 'Tema – grunnskole' },
		{ value: 'MOBBING_GRUNNSKOLE', label: 'Mobbing – grunnskole' },
		{ value: 'DELTAKELSE_GRUNNSKOLE', label: 'Deltakelse – grunnskole' },
		{ value: 'INDIKATOR_VIDEREGAENDE', label: 'Indikator – videregående' }
	] as const;
	const TILGJENGELIGE_AAR = ['2019', '2020', '2021', '2022', '2023', '2024'];
	const TILGJENGELIGE_TRINN = [
		{ value: '5', label: '5. trinn' },
		{ value: '6', label: '6. trinn' },
		{ value: '7', label: '7. trinn' },
		{ value: '10', label: '10. trinn' }
	];

	// ── Top-level section ──────────────────────────────────────────────────────
	let section = $state<'elevundersokelsen' | 'oslo'>('oslo');

	// ══════════════════════════════════════════════════════════════════════════
	// ELEVUNDERSØKELSEN section
	// ══════════════════════════════════════════════════════════════════════════

	let selectedTabell = $state('INDIKATOR_GRUNNSKOLE');
	let selectedFylke = $state('');
	let selectedKommune = $state('');
	let selectedSkole = $state('');
	let selectedAar = $state('2023');
	let selectedTrinn = $state('7');
	let activeTab = $state<'linje' | 'stolpe' | 'rangering'>('linje');

	let kommuner = $state<GeoItem[]>([]);
	let skoler = $state<GeoItem[]>([]);
	let statistikk = $state<UdirRad[] | null>(null);

	let loadingKommuner = $state(false);
	let loadingSkoler = $state(false);
	let loadingStatistikk = $state(false);

	let errorKommuner = $state<string | null>(null);
	let errorSkoler = $state<string | null>(null);
	let errorStatistikk = $state<string | null>(null);

	let lineCanvas = $state<HTMLCanvasElement | null>(null);
	let barCanvas = $state<HTMLCanvasElement | null>(null);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let lineChart: any = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let barChart: any = null;

	async function fetchJSON<T>(url: string): Promise<T> {
		const res = await fetch(url);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return res.json();
	}

	$effect(() => {
		const fylke = selectedFylke;
		if (fylke) {
			loadingKommuner = true;
			errorKommuner = null;
			fetchJSON<{ data: GeoItem[]; error?: string }>(
				`/api/statistikk/geografi?type=kommuner&id=${fylke}`
			)
				.then(r => {
					if (r.error) throw new Error(r.error);
					kommuner = r.data.sort((a, b) => a.navn.localeCompare(b.navn, 'nb'));
					selectedKommune = '';
					selectedSkole = '';
				})
				.catch(e => { errorKommuner = e.message; })
				.finally(() => { loadingKommuner = false; });
		} else {
			kommuner = [];
			selectedKommune = '';
		}
	});

	$effect(() => {
		const kommune = selectedKommune;
		if (kommune) {
			loadingSkoler = true;
			errorSkoler = null;
			fetchJSON<{ data: GeoItem[]; error?: string }>(
				`/api/statistikk/geografi?type=skoler&id=${kommune}`
			)
				.then(r => {
					if (r.error) throw new Error(r.error);
					skoler = r.data.sort((a, b) => a.navn.localeCompare(b.navn, 'nb'));
					selectedSkole = '';
				})
				.catch(e => { errorSkoler = e.message; })
				.finally(() => { loadingSkoler = false; });
		} else {
			skoler = [];
			selectedSkole = '';
		}
	});

	$effect(() => {
		const nivaa = selectedSkole ? 'skole' : selectedKommune ? 'kommune' : selectedFylke ? 'fylke' : '';
		const geografi = selectedSkole || selectedKommune || selectedFylke;
		const tabell = selectedTabell;
		const aar = selectedAar;
		const trinn = selectedTrinn;

		if (nivaa) {
			loadingStatistikk = true;
			errorStatistikk = null;
			statistikk = null;
			fetchJSON<{ data: { data: UdirRad[] }; error?: string }>(
				`/api/statistikk/elevundersokelsen?tabell=${tabell}&nivaa=${nivaa}&geografi=${geografi}&aar=${aar}&trinn=${trinn}`
			)
				.then(r => {
					if (r.error) throw new Error(r.error);
					statistikk = r.data?.data ?? [];
				})
				.catch(e => { errorStatistikk = e.message; })
				.finally(() => { loadingStatistikk = false; });
		} else {
			statistikk = null;
			loadingStatistikk = false;
			errorStatistikk = null;
		}
	});

	function retryStatistikk() {
		const prev = selectedAar;
		selectedAar = '';
		setTimeout(() => { selectedAar = prev; }, 0);
	}

	function getDim(rad: UdirRad, navn: string): string | undefined {
		return rad.dimensjoner.find(d => d.dimensjonNavn.toLowerCase() === navn.toLowerCase())?.dimensjonVerdi;
	}

	let processed = $derived.by(() => {
		if (!statistikk || statistikk.length === 0) return null;
		const byTopic = new Map<string, { values: number[]; skjermet: number }>();
		const byYear = new Map<string, Map<string, number | null>>();
		for (const rad of statistikk) {
			const rawVal = parseNorwegianDecimal(rad.verdi) ?? (typeof rad.verdi === 'number' ? rad.verdi : null);
			const topic = getDim(rad, 'IndikatorNavn') ?? getDim(rad, 'Indikator') ?? getDim(rad, 'Tema') ?? 'Ukjent';
			const aar = getDim(rad, 'Aar') ?? getDim(rad, 'År') ?? selectedAar;
			if (!byTopic.has(topic)) byTopic.set(topic, { values: [], skjermet: 0 });
			const t = byTopic.get(topic)!;
			if (!byYear.has(aar)) byYear.set(aar, new Map());
			const y = byYear.get(aar)!;
			if (rad.erSkjermet) { t.skjermet++; y.set(topic, null); }
			else if (rawVal !== null) { t.values.push(rawVal); y.set(topic, rawVal); }
		}
		const years = [...byYear.keys()].sort();
		const topics = [...byTopic.keys()];
		const ranked: ProcessedRow[] = topics.map(topic => {
			const info = byTopic.get(topic)!;
			const avg = info.values.length > 0 ? info.values.reduce((a, b) => a + b, 0) / info.values.length : null;
			return {
				navn: topic,
				score: avg,
				erSkjermet: info.skjermet > 0 && info.values.length === 0,
				trend: years.map(y => byYear.get(y)?.get(topic) ?? null),
				aar: years
			};
		}).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
		return { years, topics, byYear, byTopic, ranked };
	});

	let kpi = $derived.by(() => {
		if (!processed) return null;
		const withData = processed.ranked.filter(r => r.score !== null);
		const avg = withData.length > 0 ? withData.reduce((sum, r) => sum + r.score!, 0) / withData.length : null;
		return { total: processed.ranked.length, avg: avg !== null ? avg.toFixed(2) : '—', skjermet: processed.ranked.filter(r => r.erSkjermet).length };
	});

	$effect(() => {
		const shouldDraw = browser && processed !== null && activeTab !== 'rangering' && section === 'elevundersokelsen';
		const p = processed;
		if (shouldDraw && p) {
			import('chart.js/auto').then(({ Chart }) => {
				if (lineCanvas && activeTab === 'linje') {
					lineChart?.destroy();
					const datasets = p.topics.slice(0, 8).map((topic, i) => ({
						label: topic,
						data: p.years.map(y => p.byYear.get(y)?.get(topic) ?? null),
						borderColor: `hsl(${(i * 45) % 360}, 65%, 50%)`,
						backgroundColor: `hsl(${(i * 45) % 360}, 65%, 80%)`,
						spanGaps: false,
						tension: 0.3
					}));
					lineChart = new Chart(lineCanvas, {
						type: 'line',
						data: { labels: p.years, datasets },
						options: {
							responsive: true,
							plugins: {
								legend: { position: 'bottom' },
								tooltip: {
									callbacks: {
										// eslint-disable-next-line @typescript-eslint/no-explicit-any
										label: (ctx: any) => ctx.parsed.y === null
											? `${ctx.dataset.label ?? ''}: Skjermet/mangler`
											: `${ctx.dataset.label ?? ''}: ${ctx.parsed.y.toFixed(2)}`
									}
								}
							},
							scales: {
								y: { min: 1, max: 5, title: { display: true, text: 'Snittverdi (1–5)' } },
								x: { title: { display: true, text: 'Skoleår' } }
							}
						}
					});
				}
				if (barCanvas && activeTab === 'stolpe') {
					barChart?.destroy();
					const sorted = [...p.ranked].filter(r => r.score !== null);
					const colors = sorted.map(r => r.score! >= 4 ? '#22c55e' : r.score! >= 3 ? '#3b82f6' : '#ef4444');
					barChart = new Chart(barCanvas, {
						type: 'bar',
						data: {
							labels: sorted.map(r => r.navn),
							datasets: [{ label: 'Snittverdi', data: sorted.map(r => r.score!), backgroundColor: colors, borderRadius: 4 }]
						},
						options: {
							indexAxis: 'y',
							responsive: true,
							plugins: {
								legend: { display: false },
								tooltip: {
									callbacks: {
										// eslint-disable-next-line @typescript-eslint/no-explicit-any
										label: (ctx: any) => `${(ctx.parsed.x as number).toFixed(2)} / 5`
									}
								}
							},
							scales: { x: { min: 1, max: 5, title: { display: true, text: 'Snittverdi (1–5)' } } }
						}
					});
				}
			});
		}
		return () => { lineChart?.destroy(); lineChart = null; barChart?.destroy(); barChart = null; };
	});

	function sparklinePath(values: (number | null)[], w = 80, h = 24): string {
		const valid = values.filter(v => v !== null) as number[];
		if (valid.length < 2) return '';
		const min = Math.min(...valid); const max = Math.max(...valid); const range = max - min || 1;
		const pts = values.map((v, i) => {
			if (v === null) return null;
			const x = (i / (values.length - 1)) * w;
			const y = h - ((v - min) / range) * (h - 4) - 2;
			return `${x.toFixed(1)},${y.toFixed(1)}`;
		}).filter(Boolean);
		if (pts.length < 2) return '';
		return `M ${pts.join(' L ')}`;
	}

	function downloadCSV() {
		if (!processed) return;
		const rows = [
			['Indikator', 'Snittverdi', ...processed.years],
			...processed.ranked.map(r => [r.navn, r.score?.toFixed(2) ?? (r.erSkjermet ? 'Skjermet' : 'Mangler'), ...r.trend.map(v => (v === null ? '' : v.toFixed(2)))])
		];
		const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
		triggerDownload(csv, 'text/csv', 'elevundersokelsen.csv');
	}
	function downloadJSON() {
		if (!statistikk) return;
		triggerDownload(JSON.stringify(statistikk, null, 2), 'application/json', 'elevundersokelsen.json');
	}
	function triggerDownload(content: string, type: string, filename: string) {
		const blob = new Blob([content], { type });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url; a.download = filename; a.click();
		URL.revokeObjectURL(url);
	}

	// ══════════════════════════════════════════════════════════════════════════
	// OSLO RANGERING section
	// ══════════════════════════════════════════════════════════════════════════

	let osloTab = $state<'rangering' | 'trendgraf'>('rangering');
	let osloSelectedYear = $state<number | null>(data.oslo.latestYear);
	let osloMetricSet = $state<'all' | 'standard' | 'laeringsmiljo' | 'mobbing'>('standard');
	let osloSearch = $state('');
	let osloDrilldownId = $state<string | null>(null);

	// Debug / ingest panel
	let showOsloDebug = $state(data.oslo.debug.schoolCount === 0);
	let ingestStatus = $state<'idle' | 'loading' | 'done' | 'error'>('idle');
	let ingestMsg = $state('');

	async function triggerIngest() {
		const secret = (document.getElementById('ingest-secret') as HTMLInputElement)?.value ?? '';
		if (!secret) { ingestMsg = 'Skriv inn INGEST_SECRET'; ingestStatus = 'error'; return; }
		ingestStatus = 'loading'; ingestMsg = 'Henter data…';
		try {
			const r = await fetch('/api/udir/ingest', {
				method: 'POST',
				headers: { Authorization: `Bearer ${secret}` }
			});
			const json = await r.json();
			if (!r.ok) throw new Error(json.message ?? r.statusText);
			ingestStatus = 'done';
			ingestMsg = `Ferdig: ${json.totalRows} rader, ${json.errors} feil. Last siden på nytt.`;
		} catch (e: unknown) {
			ingestStatus = 'error';
			ingestMsg = e instanceof Error ? e.message : String(e);
		}
	}

	// Oslo derived
	const osloVisibleMetrics = $derived(
		osloMetricSet === 'all'
			? data.oslo.metrics
			: data.oslo.metrics.filter((m: MetricDef) => m.set === osloMetricSet)
	);

	const osloFilteredSchools = $derived(
		data.oslo.schools.filter((s: SchoolRow) => s.navn.toLowerCase().includes(osloSearch.toLowerCase()))
	);

	const osloSortedSchools = $derived(
		[...osloFilteredSchools].sort((a: SchoolRow, b: SchoolRow) => {
			const av = osloSelectedYear ? (a.totalByYear[osloSelectedYear] ?? -1) : -1;
			const bv = osloSelectedYear ? (b.totalByYear[osloSelectedYear] ?? -1) : -1;
			return bv - av;
		})
	);

	// Trend data: top 10 improvers, bottom 10 decliners, and search-matched schools
	const osloTrendData = $derived.by(() => {
		const oslo = data.oslo;
		if (oslo.years.length < 2 || oslo.schools.length === 0) return null;

		const minYear = Math.min(...oslo.years);
		const maxYear = Math.max(...oslo.years);

		const withDelta = oslo.schools
			.filter(s => s.totalByYear[minYear] != null && s.totalByYear[maxYear] != null)
			.map(s => ({
				school: s,
				delta: (s.totalByYear[maxYear] as number) - (s.totalByYear[minYear] as number)
			}))
			.sort((a, b) => b.delta - a.delta);

		const top10 = withDelta.slice(0, 10);
		const bottom10 = [...withDelta.slice(-10)].reverse();

		const avgByYear = oslo.years.map(y => {
			const vals = oslo.schools.map(s => s.totalByYear[y]).filter((v): v is number => v != null);
			return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
		});

		// Schools matching the current search (requires at least 2 chars)
		const search = osloSearch.toLowerCase().trim();
		const searchedSchools = search.length >= 2
			? oslo.schools
				.filter(s => s.navn.toLowerCase().includes(search))
				.map(s => ({
					school: s,
					delta: (s.totalByYear[maxYear] ?? null) != null && (s.totalByYear[minYear] ?? null) != null
						? (s.totalByYear[maxYear] as number) - (s.totalByYear[minYear] as number)
						: null
				}))
			: [];

		return { top10, bottom10, avgByYear, minYear, maxYear, searchedSchools, search };
	});

	// Oslo helper functions
	function heatBg(score: number | null): string {
		if (score == null) return '#f1f5f9';
		if (score >= 80) return '#16a34a';
		if (score >= 65) return '#65a30d';
		if (score >= 50) return '#ca8a04';
		if (score >= 35) return '#ea580c';
		return '#dc2626';
	}
	function heatFg(score: number | null): string {
		if (score == null) return '#94a3b8';
		if (score >= 50 || score < 35) return '#fff';
		return '#1e293b';
	}

	function osloSparkPath(school: SchoolRow): string {
		const W = 60; const H = 20;
		const pts = data.oslo.years.map((y: number, i: number) => {
			const v = school.totalByYear[y];
			const x = data.oslo.years.length < 2 ? W / 2 : (i / (data.oslo.years.length - 1)) * W;
			const yc = v != null ? H - (v / 100) * H : null;
			return { x, y: yc };
		});
		let d = '';
		for (const p of pts) {
			if (p.y == null) continue;
			d += d === '' ? `M${p.x.toFixed(1)},${p.y.toFixed(1)}` : `L${p.x.toFixed(1)},${p.y.toFixed(1)}`;
		}
		return d;
	}

	function toggleDrilldown(nsr_id: string) {
		osloDrilldownId = osloDrilldownId === nsr_id ? null : nsr_id;
	}

	function drilldownMetrics(school: SchoolRow): { label: string; score: number | null; direction: string }[] {
		if (!osloSelectedYear) return [];
		return data.oslo.metrics
			.map((m: MetricDef) => ({
				label: m.key,
				score: school.metricByYear[m.key]?.[osloSelectedYear!] ?? null,
				direction: m.direction
			}))
			.filter(x => x.score !== null)
			.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
	}
</script>

<svelte:head>
	<title>Statistikk – Skolebibliotek</title>
</svelte:head>

<div class="page-header">
	<h1>Statistikk</h1>
	<p class="subtitle">Elevundersøkelsen – Utdanningsdirektoratet</p>
</div>

<!-- ── Top-level section switcher ─────────────────────────────────────────── -->
<div class="section-tabs" role="tablist">
	<button
		role="tab"
		aria-selected={section === 'oslo'}
		class:active={section === 'oslo'}
		onclick={() => (section = 'oslo')}
	>Oslo-rangering</button>
	<button
		role="tab"
		aria-selected={section === 'elevundersokelsen'}
		class:active={section === 'elevundersokelsen'}
		onclick={() => (section = 'elevundersokelsen')}
	>Elevundersøkelsen</button>
</div>

<!-- ══════════════════════════════════════════════════════════════════════════
     OSLO RANGERING
     ══════════════════════════════════════════════════════════════════════════ -->
{#if section === 'oslo'}
	<div class="oslo-header">
		<p class="oslo-sub">Grunnskole Oslo · score 0–100 · høyere = bedre</p>
		<button class="btn-debug" onclick={() => (showOsloDebug = !showOsloDebug)}>
			{showOsloDebug ? '▲ Lukk oppsett' : '⚙ Oppsett'}
		</button>
	</div>

	{#if showOsloDebug}
		<div class="debug-panel card">
			<h2 class="debug-title">Databasestatus</h2>
			<div class="debug-stats">
				<div class="dstat"><div class="dstat-val">{data.oslo.debug.schoolCount}</div><div class="dstat-label">Skoler</div></div>
				<div class="dstat"><div class="dstat-val">{data.oslo.debug.metricRowCount.toLocaleString('nb')}</div><div class="dstat-label">Metrikk-rader</div></div>
				<div class="dstat"><div class="dstat-val">{data.oslo.debug.years.join(', ') || '—'}</div><div class="dstat-label">Tilgjengelige år</div></div>
			</div>
			{#if data.oslo.debug.sampleMetrics.length > 0}
				<div style="margin-top:1rem;">
					<strong style="font-size:0.8rem;">Indikatorer i DB:</strong>
					<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.4rem;">
						{#each data.oslo.debug.sampleMetrics as m}
							<span class="badge badge-gray">{m}</span>
						{/each}
					</div>
				</div>
			{/if}
			<div class="ingest-form">
				<h3 style="font-size:0.9rem;margin-bottom:0.75rem;">Kjør innhenting</h3>
				<div style="display:flex;gap:0.5rem;align-items:flex-end;flex-wrap:wrap;">
					<div class="form-group" style="margin-bottom:0;flex:1;min-width:180px;">
						<label for="ingest-secret">INGEST_SECRET</label>
						<input id="ingest-secret" type="password" placeholder="Fra .env" />
					</div>
					<button class="button-secondary" onclick={triggerIngest} disabled={ingestStatus === 'loading'}>
						{ingestStatus === 'loading' ? 'Henter…' : 'Start innhenting'}
					</button>
				</div>
				{#if ingestMsg}
					<div class="ingest-msg" class:ok={ingestStatus === 'done'} class:err={ingestStatus === 'error'}>{ingestMsg}</div>
				{/if}
				<p class="debug-hint">
					Eller via curl: <code>curl -X POST /api/udir/ingest -H "Authorization: Bearer &lt;SECRET&gt;"</code>
				</p>
			</div>
		</div>
	{/if}

	{#if !data.oslo.enabled}
		<div class="alert-box warn">Sett <code>UDIR_ENABLED=true</code> i miljøvariabler og last serveren på nytt.</div>
	{:else if data.oslo.schools.length === 0}
		<div class="alert-box info">Ingen skoledata i databasen ennå. Bruk oppsett-panelet ovenfor for å kjøre innhenting.</div>
	{:else}
		<!-- Controls -->
		<div class="oslo-controls">
			<input class="search-input" type="search" placeholder="Søk skole…" bind:value={osloSearch} aria-label="Søk etter skole" />
			<div class="year-tabs" role="tablist" aria-label="Velg år">
				{#each data.oslo.years as y}
					<button class="ytab" class:active={osloSelectedYear === y} role="tab" aria-selected={osloSelectedYear === y}
						onclick={() => { osloSelectedYear = y; }}>
						{y}
					</button>
				{/each}
			</div>
			<select class="set-select" bind:value={osloMetricSet} aria-label="Metrikk-sett">
				<option value="all">Alle indikatorer</option>
				<option value="standard">Standard (kjerne)</option>
				<option value="laeringsmiljo">Læringsmiljø</option>
				<option value="mobbing">Mobbing</option>
			</select>
		</div>

		<!-- KPI strip -->
		<div class="kpi-grid" style="margin-bottom:1.25rem;">
			<div class="kpi-card">
				<div class="kpi-value">{osloSortedSchools.length}</div>
				<div class="kpi-label">Skoler</div>
			</div>
			<div class="kpi-card">
				<div class="kpi-value">{osloVisibleMetrics.length}</div>
				<div class="kpi-label">Indikatorer vist</div>
			</div>
			{#if osloSelectedYear}
				{@const scores = osloSortedSchools.map((s: SchoolRow) => s.totalByYear[osloSelectedYear!]).filter((v): v is number => v != null)}
				<div class="kpi-card">
					<div class="kpi-value">{scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : '—'}</div>
					<div class="kpi-label">Snitt {osloSelectedYear}</div>
				</div>
				<div class="kpi-card">
					<div class="kpi-value">{scores.length ? Math.max(...scores) : '—'}</div>
					<div class="kpi-label">Beste skole</div>
				</div>
			{/if}
		</div>

		<!-- Sub-tabs: Rangering | Trendgraf -->
		<div class="tab-bar" role="tablist">
			<button role="tab" aria-selected={osloTab === 'rangering'} class:active={osloTab === 'rangering'}
				onclick={() => (osloTab = 'rangering')}>Rangering</button>
			<button role="tab" aria-selected={osloTab === 'trendgraf'} class:active={osloTab === 'trendgraf'}
				onclick={() => (osloTab = 'trendgraf')}>Trendgraf {data.oslo.years.length >= 2 ? `(${Math.min(...data.oslo.years)}→${Math.max(...data.oslo.years)})` : ''}</button>
		</div>

		{#if osloTab === 'rangering'}
			<!-- Heatmap table -->
			<div class="heatmap-wrap">
				<table class="heatmap">
					<thead>
						<tr>
							<th class="th-rank">#</th>
							<th class="th-name">Skole</th>
							<th class="th-total">Score</th>
							<th class="th-spark">Trend</th>
							{#each osloVisibleMetrics as m (m.key)}
								<th class="th-metric" title={m.key}>{m.short}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each osloSortedSchools as school, idx (school.nsr_id)}
							<tr class="school-row" class:drillopen={osloDrilldownId === school.nsr_id}
								onclick={() => toggleDrilldown(school.nsr_id)}
								role="button" tabindex="0"
								onkeydown={e => e.key === 'Enter' && toggleDrilldown(school.nsr_id)}
								aria-expanded={osloDrilldownId === school.nsr_id}>
								<td class="td-rank">{idx + 1}</td>
								<td class="td-name">{school.navn}</td>
								<td class="td-total">
									{#if true}
										{@const ts = osloSelectedYear ? school.totalByYear[osloSelectedYear] : null}
										<span class="total-badge" style="background:{heatBg(ts)};color:{heatFg(ts)}">{ts ?? '—'}</span>
									{/if}
								</td>
								<td class="td-spark">
									<svg width="60" height="20" viewBox="0 0 60 20" aria-hidden="true">
										<path d={osloSparkPath(school)} fill="none" stroke="#3b82f6" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
									</svg>
								</td>
								{#each osloVisibleMetrics as m (m.key)}
									{#if true}
										{@const score = osloSelectedYear ? (school.metricByYear[m.key]?.[osloSelectedYear] ?? null) : null}
										<td class="td-heat" style="background:{heatBg(score)};color:{heatFg(score)}">{score ?? '·'}</td>
									{/if}
								{/each}
							</tr>
							{#if osloDrilldownId === school.nsr_id}
								<tr class="drilldown-tr">
									<td colspan={4 + osloVisibleMetrics.length} class="drilldown-td">
										<div class="drilldown">
											<strong class="drilldown-title">{school.navn} — alle indikatorer {osloSelectedYear ?? ''}</strong>
											<div class="bars">
												{#each drilldownMetrics(school) as dm}
													<div class="bar-row">
														<span class="bar-label" title={dm.label}>{dm.label}</span>
														<div class="bar-track">
															<div class="bar-fill" style="width:{dm.score}%;background:{heatBg(dm.score)}"></div>
														</div>
														<span class="bar-val">{dm.score}</span>
													</div>
												{/each}
												{#if drilldownMetrics(school).length === 0}
													<p style="color:var(--color-text-muted);font-size:0.85rem;">Ingen data for valgt år.</p>
												{/if}
											</div>
										</div>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
				{#if osloSortedSchools.length === 0}
					<div class="empty-msg">Ingen skoler matcher søket.</div>
				{/if}
			</div>

		{:else}
			<!-- Trend tables -->
			{#if data.oslo.years.length < 2}
				<div class="card" style="padding:2rem;text-align:center;color:var(--color-text-muted);">
					Trendgraf krever data for minst to år.
				</div>
			{:else if !osloTrendData}
				<div class="card" style="padding:2rem;text-align:center;color:var(--color-text-muted);">Ingen skoledata å beregne trend for.</div>
			{:else}
				<p class="chart-meta">
					Endring i totalscoring (0–100) fra {osloTrendData.minYear} til {osloTrendData.maxYear}.
					Oslo-gjennomsnitt: {osloTrendData.avgByYear[0] ?? '—'} → {osloTrendData.avgByYear[osloTrendData.avgByYear.length - 1] ?? '—'}
				</p>

				{#if osloTrendData.searchedSchools.length > 0}
					<!-- Search result trend view -->
					<div class="trend-search-result">
						<h3 class="trend-col-title">Søkeresultat for «{osloSearch.trim()}»</h3>
						<table class="trend-table">
							<thead>
								<tr>
									<th>Skole</th>
									{#each data.oslo.years as y}<th class="trend-num">{y}</th>{/each}
									<th class="trend-num">Endring</th>
								</tr>
							</thead>
							<tbody>
								{#each osloTrendData.searchedSchools as item}
									<tr>
										<td class="trend-school-name">{item.school.navn}</td>
										{#each data.oslo.years as y}
											<td class="trend-num">{item.school.totalByYear[y] ?? '—'}</td>
										{/each}
										<td class="trend-delta {item.delta == null ? '' : item.delta >= 0 ? 'positive' : 'negative'}">
											{#if item.delta == null}—{:else if item.delta >= 0}+{item.delta}{:else}{item.delta}{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<!-- Default: top 10 / bottom 10 -->
					<div class="trend-legend-grid">
						<div class="trend-col">
							<h3 class="trend-col-title" style="color:#16a34a;">Top 10 forbedret</h3>
							<table class="trend-table">
								<thead><tr><th>Skole</th><th>Fra</th><th>Til</th><th>Endring</th></tr></thead>
								<tbody>
									{#each osloTrendData.top10 as item}
										<tr>
											<td class="trend-school-name">{item.school.navn}</td>
											<td class="trend-num">{item.school.totalByYear[osloTrendData.minYear]}</td>
											<td class="trend-num">{item.school.totalByYear[osloTrendData.maxYear]}</td>
											<td class="trend-delta positive">+{item.delta}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
						<div class="trend-col">
							<h3 class="trend-col-title" style="color:#dc2626;">Top 10 forverret</h3>
							<table class="trend-table">
								<thead><tr><th>Skole</th><th>Fra</th><th>Til</th><th>Endring</th></tr></thead>
								<tbody>
									{#each osloTrendData.bottom10 as item}
										<tr>
											<td class="trend-school-name">{item.school.navn}</td>
											<td class="trend-num">{item.school.totalByYear[osloTrendData.minYear]}</td>
											<td class="trend-num">{item.school.totalByYear[osloTrendData.maxYear]}</td>
											<td class="trend-delta negative">{item.delta}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				{/if}
			{/if}
		{/if}
	{/if}
{/if}

<!-- ══════════════════════════════════════════════════════════════════════════
     ELEVUNDERSØKELSEN section
     ══════════════════════════════════════════════════════════════════════════ -->
{#if section === 'elevundersokelsen'}
	{#if data.geoError}
		<div class="alert alert-error" role="alert" style="margin-bottom:1rem;">
			Kunne ikke laste geografidata: {data.geoError}
		</div>
	{/if}

	<section class="card" style="margin-bottom:1.25rem;">
		<h2 style="font-size:1rem;margin-bottom:1rem;color:var(--color-text-light);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Filtre</h2>
		<div class="filter-grid">
			<div class="form-group">
				<label for="tabell">Datasett</label>
				<select id="tabell" bind:value={selectedTabell}>
					{#each TABELL_OPTIONS as opt}<option value={opt.value}>{opt.label}</option>{/each}
				</select>
			</div>
			<div class="form-group">
				<label for="fylke">Fylke</label>
				<select id="fylke" bind:value={selectedFylke}>
					<option value="">— Velg fylke —</option>
					{#each data.fylker as f}<option value={f.fylkesnummer}>{f.navn}</option>{/each}
				</select>
			</div>
			<div class="form-group">
				<label for="kommune">Kommune {loadingKommuner ? '…' : ''}</label>
				<select id="kommune" bind:value={selectedKommune} disabled={!selectedFylke || loadingKommuner}>
					<option value="">— Alle kommuner —</option>
					{#each kommuner as k}<option value={k.kommunenummer}>{k.navn}</option>{/each}
				</select>
				{#if errorKommuner}<span class="field-error">{errorKommuner}</span>{/if}
			</div>
			<div class="form-group">
				<label for="skole">Skole {loadingSkoler ? '…' : ''}</label>
				<select id="skole" bind:value={selectedSkole} disabled={!selectedKommune || loadingSkoler}>
					<option value="">— Alle skoler —</option>
					{#each skoler as s}<option value={s.nsrId}>{s.navn}</option>{/each}
				</select>
				{#if errorSkoler}<span class="field-error">{errorSkoler}</span>{/if}
			</div>
			<div class="form-group">
				<label for="aar">Skoleår</label>
				<select id="aar" bind:value={selectedAar}>
					{#each TILGJENGELIGE_AAR as y}<option value={y}>{y}</option>{/each}
				</select>
			</div>
			<div class="form-group">
				<label for="trinn">Trinn</label>
				<select id="trinn" bind:value={selectedTrinn}>
					{#each TILGJENGELIGE_TRINN as t}<option value={t.value}>{t.label}</option>{/each}
				</select>
			</div>
		</div>
	</section>

	{#if !selectedFylke}
		<div class="empty-state" role="status">
			<div class="empty-icon">📊</div>
			<p>Velg et fylke for å vise resultater fra Elevundersøkelsen.</p>
		</div>
	{:else if loadingStatistikk}
		<div class="kpi-grid" aria-hidden="true">
			<div class="skeleton-kpi"></div><div class="skeleton-kpi"></div><div class="skeleton-kpi"></div>
		</div>
		<div class="card skeleton-block" style="height:420px;"></div>
	{:else if errorStatistikk}
		<div class="alert alert-error" role="alert">
			<div style="flex:1;">
				<strong>Feil ved henting av statistikk</strong>
				<div style="font-size:0.875rem;margin-top:0.25rem;">{errorStatistikk}</div>
			</div>
			<button class="button-secondary button-sm" onclick={retryStatistikk}>Prøv igjen</button>
		</div>
	{:else if statistikk !== null && statistikk.length === 0}
		<div class="empty-state" role="status">
			<div class="empty-icon">🔍</div>
			<p>Ingen data tilgjengelig for dette utvalget. Prøv et annet år, trinn eller datasett.</p>
		</div>
	{:else if processed && kpi}
		<div class="kpi-grid">
			<div class="kpi-card">
				<span class="kpi-value">{kpi.total}</span>
				<span class="kpi-label">Indikatorer totalt</span>
			</div>
			<div class="kpi-card">
				<span class="kpi-value">{kpi.avg}</span>
				<span class="kpi-label">Gjennomsnitt (1–5)</span>
			</div>
			<div class="kpi-card">
				<span class="kpi-value" style="color:{kpi.skjermet > 0 ? 'var(--color-warning)' : 'var(--color-success)'};">{kpi.skjermet}</span>
				<span class="kpi-label">Skjermede verdier</span>
			</div>
		</div>

		<div class="tab-bar" role="tablist">
			<button role="tab" aria-selected={activeTab === 'linje'} class:active={activeTab === 'linje'} onclick={() => (activeTab = 'linje')}>Tidsutvikling</button>
			<button role="tab" aria-selected={activeTab === 'stolpe'} class:active={activeTab === 'stolpe'} onclick={() => (activeTab = 'stolpe')}>Tema-oversikt</button>
			<button role="tab" aria-selected={activeTab === 'rangering'} class:active={activeTab === 'rangering'} onclick={() => (activeTab = 'rangering')}>Rangering</button>
		</div>

		<div class="card" role="tabpanel" style="margin-bottom:1rem;">
			{#if activeTab === 'linje'}
				<p class="chart-meta">{processed.topics.length} indikatorer · viser maks 8 i grafen</p>
				{#if processed.years.length < 2}
					<div class="empty-state" style="border:none;padding:2rem;"><p>Tidsutvikling krever data for flere år. Prøv å endre filtrene.</p></div>
				{:else}
					<canvas bind:this={lineCanvas} style="max-height:420px;" aria-label="Linjediagram"></canvas>
				{/if}
			{:else if activeTab === 'stolpe'}
				<p class="chart-meta">{processed.ranked.filter(r => r.score !== null).length} indikatorer med data</p>
				<canvas bind:this={barCanvas} style="max-height:480px;" aria-label="Stolpediagram"></canvas>
			{:else}
				<div style="overflow-x:auto;">
					<table class="stat-table" aria-label="Rangert tabell">
						<thead>
							<tr><th>#</th><th>Indikator</th><th>Snitt</th><th>Trend</th><th>Status</th></tr>
						</thead>
						<tbody>
							{#each processed.ranked as row, i}
								<tr>
									<td style="color:var(--color-text-muted);font-size:0.8rem;width:2rem;">{i + 1}</td>
									<td>{row.navn}</td>
									<td style="white-space:nowrap;">
										{#if row.erSkjermet}
											<span class="badge badge-yellow">Skjermet</span>
										{:else if row.score === null}
											<span class="badge badge-gray">Mangler</span>
										{:else}
											<strong>{row.score.toFixed(2)}</strong>
											<span style="color:var(--color-text-muted);"> / 5</span>
										{/if}
									</td>
									<td>
										{#if row.trend.some(v => v !== null)}
											<svg width="80" height="24" aria-hidden="true" style="display:block;">
												<path d={sparklinePath(row.trend)} fill="none" stroke="var(--color-primary)" stroke-width="1.5"/>
											</svg>
										{:else}
											<span style="color:var(--color-text-muted);">—</span>
										{/if}
									</td>
									<td>
										{#if row.erSkjermet}
											<span class="badge badge-yellow">Skjermet</span>
										{:else if row.score !== null && row.score >= 4}
											<span class="badge badge-green">God</span>
										{:else if row.score !== null && row.score < 3}
											<span class="badge badge-red">Lav</span>
										{:else}
											<span class="badge badge-gray">Middels</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

		<div class="button-group">
			<button class="button-secondary button-sm" onclick={downloadCSV}>↓ CSV</button>
			<button class="button-secondary button-sm" onclick={downloadJSON}>↓ JSON</button>
		</div>
	{/if}
{/if}

<style>
	/* ── Section switcher ── */
	.section-tabs {
		display: flex;
		gap: 0.2rem;
		margin-bottom: 1.25rem;
		border-bottom: 2px solid var(--color-border);
		padding-bottom: 0;
	}
	.section-tabs button {
		padding: 0.5rem 1.25rem;
		border: none;
		border-bottom: 3px solid transparent;
		background: none;
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
		color: var(--color-text-light);
		margin-bottom: -2px;
		border-radius: 0;
		transition: color 0.15s, border-color 0.15s;
	}
	.section-tabs button:hover { color: var(--color-text); }
	.section-tabs button.active { color: var(--color-primary); border-bottom-color: var(--color-primary); }

	/* ── Oslo header ── */
	.oslo-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.oslo-sub { color: var(--color-text-light); font-size: 0.875rem; margin: 0; }
	.btn-debug {
		background: var(--color-bg-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: 0.4rem 0.875rem;
		font-size: 0.82rem;
		cursor: pointer;
		color: var(--color-text-light);
		white-space: nowrap;
	}
	.btn-debug:hover { background: var(--color-bg-light); color: var(--color-text); }

	/* ── Debug panel ── */
	.debug-panel { margin-bottom: 1.5rem; background: #fffbeb; border-color: #fde68a; }
	.debug-title { font-size: 0.95rem; margin-bottom: 0.875rem; }
	.debug-stats { display: flex; gap: 1.5rem; flex-wrap: wrap; }
	.dstat-val { font-size: 1.5rem; font-weight: 700; }
	.dstat-label { font-size: 0.78rem; color: var(--color-text-muted); }
	.ingest-form { margin-top: 1.25rem; padding-top: 1.25rem; border-top: 1px solid #fde68a; }
	.ingest-msg { margin-top: 0.5rem; font-size: 0.85rem; padding: 0.4rem 0.75rem; border-radius: var(--radius-md); background: #f1f5f9; color: var(--color-text); }
	.ingest-msg.ok  { background: #dcfce7; color: #166534; }
	.ingest-msg.err { background: #fee2e2; color: #991b1b; }
	.debug-hint { margin-top: 0.625rem; font-size: 0.78rem; color: var(--color-text-muted); }
	.debug-hint code { background: rgba(0,0,0,0.05); padding: 0.1em 0.3em; border-radius: 3px; font-size: 0.75em; word-break: break-all; }

	/* ── Alert boxes ── */
	.alert-box { padding: 1rem 1.25rem; border-radius: var(--radius-md); margin-bottom: 1.5rem; font-size: 0.9rem; line-height: 1.6; }
	.alert-box code { background: rgba(0,0,0,0.06); padding: 0.1em 0.35em; border-radius: 3px; font-size: 0.9em; }
	.alert-box.warn { background: #fff7ed; color: #92400e; border: 1px solid #fcd34d; }
	.alert-box.info { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }

	/* ── Oslo controls ── */
	.oslo-controls { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
	.search-input {
		padding: 0.5rem 0.875rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		min-width: 200px;
		background: white;
		color: var(--color-text);
	}
	.search-input:focus { outline: 2px solid var(--color-primary); outline-offset: -1px; border-color: transparent; }
	.year-tabs { display: flex; gap: 0.2rem; }
	.ytab {
		padding: 0.38rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: white;
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		color: var(--color-text-light);
		transition: background 0.1s, color 0.1s;
	}
	.ytab:hover { background: var(--color-bg-subtle); color: var(--color-text); }
	.ytab.active { background: var(--color-primary); border-color: var(--color-primary); color: white; }
	.set-select {
		padding: 0.38rem 0.625rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 0.85rem;
		background: white;
		color: var(--color-text);
		cursor: pointer;
	}

	/* ── Heatmap ── */
	.heatmap-wrap { overflow-x: auto; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: white; margin-bottom: 1.5rem; }
	.heatmap { border-collapse: collapse; font-size: 0.8rem; width: 100%; white-space: nowrap; }
	.heatmap thead tr { background: var(--color-bg-subtle); border-bottom: 2px solid var(--color-border); }
	.heatmap th { padding: 0.5rem; font-weight: 600; font-size: 0.72rem; color: var(--color-text-light); text-align: center; border-right: 1px solid var(--color-border); }
	.heatmap th:last-child { border-right: none; }
	.th-rank { width: 2.5rem; } .th-name { text-align: left; min-width: 180px; max-width: 220px; }
	.th-total { width: 4.5rem; } .th-spark { width: 4rem; } .th-metric { width: 5rem; }
	.heatmap tbody tr { border-bottom: 1px solid var(--color-border); }
	.heatmap tbody tr:last-child { border-bottom: none; }
	.school-row { cursor: pointer; transition: background 0.1s; }
	.school-row:hover td { background: #f8fafc; }
	.school-row.drillopen td { background: #eff6ff; }
	.heatmap td { padding: 0.4rem 0.5rem; vertical-align: middle; }
	.td-rank { text-align: center; color: var(--color-text-muted); font-variant-numeric: tabular-nums; }
	.td-name { font-weight: 500; max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
	.td-total { text-align: center; }
	.td-spark { text-align: center; padding: 0.25rem 0.5rem; }
	.total-badge { display: inline-block; min-width: 2.5rem; text-align: center; font-weight: 700; font-size: 0.85rem; padding: 0.2rem 0.4rem; border-radius: 5px; }
	.td-heat { text-align: center; font-weight: 600; font-size: 0.78rem; border-right: 1px solid rgba(255,255,255,0.3); transition: filter 0.1s; }
	.td-heat:last-child { border-right: none; }
	.school-row:hover .td-heat { filter: brightness(1.06); }

	/* ── Drilldown ── */
	.drilldown-tr td { background: #f0f9ff; padding: 0; }
	.drilldown { padding: 1rem 1.25rem; border-top: 2px solid #bfdbfe; }
	.drilldown-title { display: block; font-size: 0.875rem; margin-bottom: 0.875rem; color: var(--color-text); }
	.bars { display: flex; flex-direction: column; gap: 0.45rem; max-width: 600px; }
	.bar-row { display: grid; grid-template-columns: 200px 1fr 2.5rem; align-items: center; gap: 0.625rem; }
	.bar-label { font-size: 0.78rem; color: var(--color-text-light); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.bar-track { height: 14px; background: #e2e8f0; border-radius: 999px; overflow: hidden; }
	.bar-fill { height: 100%; border-radius: 999px; transition: width 0.3s ease; }
	.bar-val { font-size: 0.78rem; font-weight: 600; color: var(--color-text); text-align: right; font-variant-numeric: tabular-nums; }
	.empty-msg { padding: 2rem; text-align: center; color: var(--color-text-muted); font-size: 0.9rem; }

	/* ── Trend chart ── */
	.chart-meta { font-size: 0.8rem; color: var(--color-text-light); margin-bottom: 1rem; }
	.trend-legend-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 1.25rem; }
	.trend-search-result { margin-top: 1.25rem; }
	.trend-col-title { font-size: 0.9rem; font-weight: 700; margin-bottom: 0.75rem; }
	.trend-table { border-collapse: collapse; font-size: 0.8rem; width: 100%; border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; }
	.trend-table th { padding: 0.35rem 0.6rem; text-align: left; color: var(--color-text-light); font-weight: 600; background: var(--color-bg-subtle); border-bottom: 2px solid var(--color-border); border-right: 1px solid var(--color-border); font-size: 0.72rem; }
	.trend-table th:last-child { border-right: none; }
	.trend-table td { padding: 0.3rem 0.6rem; border-bottom: 1px solid var(--color-border); border-right: 1px solid var(--color-border); }
	.trend-table td:last-child { border-right: none; }
	.trend-table tr:last-child td { border-bottom: none; }
	.trend-search-result .trend-table { border-radius: var(--radius-md); }
	.trend-school-name { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
	.trend-num { text-align: right; font-variant-numeric: tabular-nums; color: var(--color-text-light); }
	.trend-delta { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
	.trend-delta.positive { color: #16a34a; }
	.trend-delta.negative { color: #dc2626; }

	/* ── Elevundersøkelsen filters ── */
	.filter-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 0.75rem; }
	.filter-grid .form-group { margin-bottom: 0; }

	@media (max-width: 640px) {
		.filter-grid { grid-template-columns: 1fr 1fr; }
		.trend-legend-grid { grid-template-columns: 1fr; }
	}
</style>
