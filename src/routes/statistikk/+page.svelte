<script lang="ts">
	import { browser } from '$app/environment';
	import type { PageData } from './$types';
	import { parseNorwegianDecimal } from '$lib/utils';

	let { data }: { data: PageData } = $props();

	// ── Types ─────────────────────────────────────────────────────────────────
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

	// ── Constants ─────────────────────────────────────────────────────────────
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

	// ── Filter state ──────────────────────────────────────────────────────────
	let selectedTabell = $state('INDIKATOR_GRUNNSKOLE');
	let selectedFylke = $state('');
	let selectedKommune = $state('');
	let selectedSkole = $state('');
	let selectedAar = $state('2023');
	let selectedTrinn = $state('7');
	let activeTab = $state<'linje' | 'stolpe' | 'rangering'>('linje');

	// ── Remote data ───────────────────────────────────────────────────────────
	let kommuner = $state<GeoItem[]>([]);
	let skoler = $state<GeoItem[]>([]);
	let statistikk = $state<UdirRad[] | null>(null);

	let loadingKommuner = $state(false);
	let loadingSkoler = $state(false);
	let loadingStatistikk = $state(false);

	let errorKommuner = $state<string | null>(null);
	let errorSkoler = $state<string | null>(null);
	let errorStatistikk = $state<string | null>(null);

	// ── Chart refs ────────────────────────────────────────────────────────────
	let lineCanvas = $state<HTMLCanvasElement | null>(null);
	let barCanvas = $state<HTMLCanvasElement | null>(null);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let lineChart: any = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let barChart: any = null;

	// ── Fetch helpers ─────────────────────────────────────────────────────────
	async function fetchJSON<T>(url: string): Promise<T> {
		const res = await fetch(url);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return res.json();
	}

	// ── Effects — use if/else, no top-level return ────────────────────────────
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
				.catch(e => {
					errorKommuner = e.message;
				})
				.finally(() => {
					loadingKommuner = false;
				});
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
				.catch(e => {
					errorSkoler = e.message;
				})
				.finally(() => {
					loadingSkoler = false;
				});
		} else {
			skoler = [];
			selectedSkole = '';
		}
	});

	$effect(() => {
		const nivaa = selectedSkole
			? 'skole'
			: selectedKommune
				? 'kommune'
				: selectedFylke
					? 'fylke'
					: '';
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
				.catch(e => {
					errorStatistikk = e.message;
				})
				.finally(() => {
					loadingStatistikk = false;
				});
		} else {
			statistikk = null;
			loadingStatistikk = false;
			errorStatistikk = null;
		}
	});

	function retryStatistikk() {
		// Trigger re-fetch by toggling a dummy state change then back
		const prev = selectedAar;
		selectedAar = '';
		setTimeout(() => {
			selectedAar = prev;
		}, 0);
	}

	// ── Data processing ───────────────────────────────────────────────────────
	function getDim(rad: UdirRad, navn: string): string | undefined {
		return rad.dimensjoner.find(d => d.dimensjonNavn.toLowerCase() === navn.toLowerCase())
			?.dimensjonVerdi;
	}

	let processed = $derived.by(() => {
		if (!statistikk || statistikk.length === 0) return null;

		const byTopic = new Map<string, { values: number[]; skjermet: number }>();
		const byYear = new Map<string, Map<string, number | null>>();

		for (const rad of statistikk) {
			// Parse value — handles both number and Norwegian string ("12,3")
			const rawVal = parseNorwegianDecimal(rad.verdi) ?? (typeof rad.verdi === 'number' ? rad.verdi : null);
			const topic =
				getDim(rad, 'IndikatorNavn') ??
				getDim(rad, 'Indikator') ??
				getDim(rad, 'Tema') ??
				'Ukjent';
			const aar = getDim(rad, 'Aar') ?? getDim(rad, 'År') ?? selectedAar;

			if (!byTopic.has(topic)) byTopic.set(topic, { values: [], skjermet: 0 });
			const t = byTopic.get(topic)!;
			if (!byYear.has(aar)) byYear.set(aar, new Map());
			const y = byYear.get(aar)!;

			if (rad.erSkjermet) {
				t.skjermet++;
				y.set(topic, null);
			} else if (rawVal !== null) {
				t.values.push(rawVal);
				y.set(topic, rawVal);
			}
		}

		const years = [...byYear.keys()].sort();
		const topics = [...byTopic.keys()];

		const ranked: ProcessedRow[] = topics
			.map(topic => {
				const info = byTopic.get(topic)!;
				const avg =
					info.values.length > 0
						? info.values.reduce((a, b) => a + b, 0) / info.values.length
						: null;
				const trend = years.map(y => byYear.get(y)?.get(topic) ?? null);
				return {
					navn: topic,
					score: avg,
					erSkjermet: info.skjermet > 0 && info.values.length === 0,
					trend,
					aar: years
				};
			})
			.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

		return { years, topics, byYear, byTopic, ranked };
	});

	// ── KPI derived ───────────────────────────────────────────────────────────
	let kpi = $derived.by(() => {
		if (!processed) return null;
		const withData = processed.ranked.filter(r => r.score !== null);
		const avg =
			withData.length > 0
				? withData.reduce((sum, r) => sum + r.score!, 0) / withData.length
				: null;
		const skjermet = processed.ranked.filter(r => r.erSkjermet).length;
		return {
			total: processed.ranked.length,
			avg: avg !== null ? avg.toFixed(2) : '—',
			skjermet
		};
	});

	// ── Chart effect — always returns cleanup function ─────────────────────────
	$effect(() => {
		const shouldDraw = browser && processed !== null && activeTab !== 'rangering';
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
										label: (ctx: any) =>
											ctx.parsed.y === null
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
					const colors = sorted.map(r =>
						r.score! >= 4 ? '#22c55e' : r.score! >= 3 ? '#3b82f6' : '#ef4444'
					);
					barChart = new Chart(barCanvas, {
						type: 'bar',
						data: {
							labels: sorted.map(r => r.navn),
							datasets: [
								{
									label: 'Snittverdi',
									data: sorted.map(r => r.score!),
									backgroundColor: colors,
									borderRadius: 4
								}
							]
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
							scales: {
								x: { min: 1, max: 5, title: { display: true, text: 'Snittverdi (1–5)' } }
							}
						}
					});
				}
			});
		}

		return () => {
			lineChart?.destroy();
			lineChart = null;
			barChart?.destroy();
			barChart = null;
		};
	});

	// ── Sparkline ─────────────────────────────────────────────────────────────
	function sparklinePath(values: (number | null)[], w = 80, h = 24): string {
		const valid = values.filter(v => v !== null) as number[];
		if (valid.length < 2) return '';
		const min = Math.min(...valid);
		const max = Math.max(...valid);
		const range = max - min || 1;
		const pts = values
			.map((v, i) => {
				if (v === null) return null;
				const x = (i / (values.length - 1)) * w;
				const y = h - ((v - min) / range) * (h - 4) - 2;
				return `${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.filter(Boolean);
		if (pts.length < 2) return '';
		return `M ${pts.join(' L ')}`;
	}

	// ── Download ──────────────────────────────────────────────────────────────
	function downloadCSV() {
		if (!processed) return;
		const rows = [
			['Indikator', 'Snittverdi', ...processed.years],
			...processed.ranked.map(r => [
				r.navn,
				r.score?.toFixed(2) ?? (r.erSkjermet ? 'Skjermet' : 'Mangler'),
				...r.trend.map(v => (v === null ? '' : v.toFixed(2)))
			])
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
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<svelte:head>
	<title>Statistikk – Skolebibliotek</title>
</svelte:head>

<div class="page-header">
	<h1>Statistikk</h1>
	<p class="subtitle">Elevundersøkelsen – Utdanningsdirektoratet</p>
</div>

{#if data.geoError}
	<div class="alert alert-error" role="alert" style="margin-bottom: 1rem;">
		Kunne ikke laste geografidata: {data.geoError}
	</div>
{/if}

<!-- ── Filtre ─────────────────────────────────────────────────────────────── -->
<section class="card" style="margin-bottom: 1.25rem;">
	<h2 style="font-size: 1rem; margin-bottom: 1rem; color: var(--color-text-light); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
		Filtre
	</h2>
	<div class="filter-grid">
		<div class="form-group">
			<label for="tabell">Datasett</label>
			<select id="tabell" bind:value={selectedTabell}>
				{#each TABELL_OPTIONS as opt}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</div>

		<div class="form-group">
			<label for="fylke">Fylke</label>
			<select id="fylke" bind:value={selectedFylke}>
				<option value="">— Velg fylke —</option>
				{#each data.fylker as f}
					<option value={f.fylkesnummer}>{f.navn}</option>
				{/each}
			</select>
		</div>

		<div class="form-group">
			<label for="kommune">Kommune {loadingKommuner ? '…' : ''}</label>
			<select
				id="kommune"
				bind:value={selectedKommune}
				disabled={!selectedFylke || loadingKommuner}
			>
				<option value="">— Alle kommuner —</option>
				{#each kommuner as k}
					<option value={k.kommunenummer}>{k.navn}</option>
				{/each}
			</select>
			{#if errorKommuner}
				<span class="field-error">{errorKommuner}</span>
			{/if}
		</div>

		<div class="form-group">
			<label for="skole">Skole {loadingSkoler ? '…' : ''}</label>
			<select
				id="skole"
				bind:value={selectedSkole}
				disabled={!selectedKommune || loadingSkoler}
			>
				<option value="">— Alle skoler —</option>
				{#each skoler as s}
					<option value={s.nsrId}>{s.navn}</option>
				{/each}
			</select>
			{#if errorSkoler}
				<span class="field-error">{errorSkoler}</span>
			{/if}
		</div>

		<div class="form-group">
			<label for="aar">Skoleår</label>
			<select id="aar" bind:value={selectedAar}>
				{#each TILGJENGELIGE_AAR as y}
					<option value={y}>{y}</option>
				{/each}
			</select>
		</div>

		<div class="form-group">
			<label for="trinn">Trinn</label>
			<select id="trinn" bind:value={selectedTrinn}>
				{#each TILGJENGELIGE_TRINN as t}
					<option value={t.value}>{t.label}</option>
				{/each}
			</select>
		</div>
	</div>
</section>

<!-- ── Empty / loading / error / results ──────────────────────────────────── -->
{#if !selectedFylke}
	<div class="empty-state" role="status">
		<div class="empty-icon">📊</div>
		<p>Velg et fylke for å vise resultater fra Elevundersøkelsen.</p>
	</div>
{:else if loadingStatistikk}
	<div class="kpi-grid" aria-hidden="true">
		<div class="skeleton-kpi"></div>
		<div class="skeleton-kpi"></div>
		<div class="skeleton-kpi"></div>
	</div>
	<div class="card skeleton-block" style="height: 420px;"></div>
{:else if errorStatistikk}
	<div class="alert alert-error" role="alert">
		<div style="flex: 1;">
			<strong>Feil ved henting av statistikk</strong>
			<div style="font-size: 0.875rem; margin-top: 0.25rem;">{errorStatistikk}</div>
		</div>
		<button class="button-secondary button-sm" onclick={retryStatistikk}>Prøv igjen</button>
	</div>
{:else if statistikk !== null && statistikk.length === 0}
	<div class="empty-state" role="status">
		<div class="empty-icon">🔍</div>
		<p>Ingen data tilgjengelig for dette utvalget. Prøv et annet år, trinn eller datasett.</p>
	</div>
{:else if processed && kpi}
	<!-- ── KPI cards ──────────────────────────────────────────────────────── -->
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
			<span class="kpi-value" style="color: {kpi.skjermet > 0 ? 'var(--color-warning)' : 'var(--color-success)'};">
				{kpi.skjermet}
			</span>
			<span class="kpi-label">Skjermede verdier</span>
		</div>
	</div>

	<!-- ── Tabs ──────────────────────────────────────────────────────────── -->
	<div class="tab-bar" role="tablist">
		<button
			role="tab"
			aria-selected={activeTab === 'linje'}
			class:active={activeTab === 'linje'}
			onclick={() => (activeTab = 'linje')}
		>Tidsutvikling</button>
		<button
			role="tab"
			aria-selected={activeTab === 'stolpe'}
			class:active={activeTab === 'stolpe'}
			onclick={() => (activeTab = 'stolpe')}
		>Tema-oversikt</button>
		<button
			role="tab"
			aria-selected={activeTab === 'rangering'}
			class:active={activeTab === 'rangering'}
			onclick={() => (activeTab = 'rangering')}
		>Rangering</button>
	</div>

	<div class="card" role="tabpanel" style="margin-bottom: 1rem;">
		{#if activeTab === 'linje'}
			<p class="chart-meta">{processed.topics.length} indikatorer · viser maks 8 i grafen</p>
			{#if processed.years.length < 2}
				<div class="empty-state" style="border: none; padding: 2rem;">
					<p>Tidsutvikling krever data for flere år. Prøv å endre filtrene.</p>
				</div>
			{:else}
				<canvas bind:this={lineCanvas} style="max-height: 420px;" aria-label="Linjediagram"></canvas>
			{/if}
		{:else if activeTab === 'stolpe'}
			<p class="chart-meta">
				{processed.ranked.filter(r => r.score !== null).length} indikatorer med data
			</p>
			<canvas bind:this={barCanvas} style="max-height: 480px;" aria-label="Stolpediagram"></canvas>
		{:else}
			<div style="overflow-x: auto;">
				<table class="stat-table" aria-label="Rangert tabell">
					<thead>
						<tr>
							<th>#</th>
							<th>Indikator</th>
							<th>Snitt</th>
							<th>Trend</th>
							<th>Status</th>
						</tr>
					</thead>
					<tbody>
						{#each processed.ranked as row, i}
							<tr>
								<td style="color: var(--color-text-muted); font-size: 0.8rem; width: 2rem;">{i + 1}</td>
								<td>{row.navn}</td>
								<td style="white-space: nowrap;">
									{#if row.erSkjermet}
										<span class="badge badge-yellow">Skjermet</span>
									{:else if row.score === null}
										<span class="badge badge-gray">Mangler</span>
									{:else}
										<strong>{row.score.toFixed(2)}</strong>
										<span style="color: var(--color-text-muted);"> / 5</span>
									{/if}
								</td>
								<td>
									{#if row.trend.some(v => v !== null)}
										<svg width="80" height="24" aria-hidden="true" style="display:block;">
											<path
												d={sparklinePath(row.trend)}
												fill="none"
												stroke="var(--color-primary)"
												stroke-width="1.5"
											/>
										</svg>
									{:else}
										<span style="color: var(--color-text-muted);">—</span>
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

<style>
	.filter-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
		gap: 0.75rem;
	}
	.filter-grid .form-group {
		margin-bottom: 0;
	}
	.chart-meta {
		font-size: 0.8rem;
		color: var(--color-text-light);
		margin-bottom: 1rem;
	}

	@media (max-width: 640px) {
		.filter-grid {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
