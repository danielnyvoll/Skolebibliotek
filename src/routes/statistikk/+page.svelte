<script lang="ts">
	import { browser } from '$app/environment';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// ── Types ────────────────────────────────────────────────────────────────
	interface GeoItem {
		fylkesnummer?: string;
		kommunenummer?: string;
		nsrId?: string;
		navn: string;
	}

	interface UdirRad {
		verdi: number | null;
		erSkjermet: boolean;
		dimensjoner: Array<{ dimensjonNavn: string; dimensjonVerdi: string; displayNavn?: string }>;
	}

	interface ProcessedRow {
		navn: string;
		score: number | null;
		erSkjermet: boolean;
		trend: (number | null)[];
		aar: string[];
		isUncertain: boolean;
	}

	// ── Filter state ─────────────────────────────────────────────────────────
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

	const TILGJENGELIGE_AAR = ['2019', '2020', '2021', '2022', '2023', '2024'];
	const TILGJENGELIGE_TRINN = [
		{ value: '5', label: '5. trinn' },
		{ value: '6', label: '6. trinn' },
		{ value: '7', label: '7. trinn' },
		{ value: '10', label: '10. trinn' }
	];

	// ── Fetch helpers ─────────────────────────────────────────────────────────
	async function fetchJSON<T>(url: string): Promise<T> {
		const res = await fetch(url);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return res.json();
	}

	// ── Effects ───────────────────────────────────────────────────────────────
	$effect(() => {
		if (!selectedFylke) {
			kommuner = [];
			selectedKommune = '';
			return;
		}
		loadingKommuner = true;
		errorKommuner = null;
		fetchJSON<{ data: GeoItem[]; error?: string }>(
			`/api/statistikk/geografi?type=kommuner&id=${selectedFylke}`
		)
			.then(r => {
				if (r.error) throw new Error(r.error);
				kommuner = r.data.sort((a, b) => a.navn.localeCompare(b.navn, 'nb'));
				selectedKommune = '';
				selectedSkole = '';
			})
			.catch(e => (errorKommuner = e.message))
			.finally(() => (loadingKommuner = false));
	});

	$effect(() => {
		if (!selectedKommune) {
			skoler = [];
			selectedSkole = '';
			return;
		}
		loadingSkoler = true;
		errorSkoler = null;
		fetchJSON<{ data: GeoItem[]; error?: string }>(
			`/api/statistikk/geografi?type=skoler&id=${selectedKommune}`
		)
			.then(r => {
				if (r.error) throw new Error(r.error);
				skoler = r.data.sort((a, b) => a.navn.localeCompare(b.navn, 'nb'));
				selectedSkole = '';
			})
			.catch(e => (errorSkoler = e.message))
			.finally(() => (loadingSkoler = false));
	});

	$effect(() => {
		const nivaa = selectedSkole ? 'skole' : selectedKommune ? 'kommune' : selectedFylke ? 'fylke' : '';
		if (!nivaa) return;

		const geografi = selectedSkole || selectedKommune || selectedFylke;
		loadingStatistikk = true;
		errorStatistikk = null;
		statistikk = null;

		fetchJSON<{ data: { data: UdirRad[] }; error?: string }>(
			`/api/statistikk/elevundersokelsen?nivaa=${nivaa}&geografi=${geografi}&aar=${selectedAar}&trinn=${selectedTrinn}`
		)
			.then(r => {
				if (r.error) throw new Error(r.error);
				statistikk = r.data?.data ?? [];
			})
			.catch(e => (errorStatistikk = e.message))
			.finally(() => (loadingStatistikk = false));
	});

	// ── Data processing ───────────────────────────────────────────────────────
	function getDim(rad: UdirRad, navn: string): string | undefined {
		return rad.dimensjoner.find(d => d.dimensjonNavn.toLowerCase() === navn.toLowerCase())
			?.dimensjonVerdi;
	}

	let processed = $derived.by(() => {
		if (!statistikk || statistikk.length === 0) return null;

		// Group by topic (IndikatorNavn or similar dimension)
		const byTopic = new Map<string, { values: number[]; skjermet: number }>();
		const byYear = new Map<string, Map<string, number | null>>();

		for (const rad of statistikk) {
			const topic =
				getDim(rad, 'IndikatorNavn') ??
				getDim(rad, 'Indikator') ??
				getDim(rad, 'Tema') ??
				'Ukjent';
			const aar = getDim(rad, 'Aar') ?? getDim(rad, 'År') ?? selectedAar;

			if (!byTopic.has(topic)) byTopic.set(topic, { values: [], skjermet: 0 });
			const t = byTopic.get(topic)!;
			if (rad.erSkjermet) {
				t.skjermet++;
			} else if (rad.verdi !== null) {
				t.values.push(rad.verdi);
			}

			if (!byYear.has(aar)) byYear.set(aar, new Map());
			const y = byYear.get(aar)!;
			y.set(topic, rad.erSkjermet ? null : rad.verdi);
		}

		const years = [...byYear.keys()].sort();
		const topics = [...byTopic.keys()];

		// Ranked rows (by avg score per topic)
		const ranked: ProcessedRow[] = topics
			.map(t => {
				const info = byTopic.get(t)!;
				const avg =
					info.values.length > 0
						? info.values.reduce((a, b) => a + b, 0) / info.values.length
						: null;
				const trend = years.map(y => byYear.get(y)?.get(t) ?? null);
				return {
					navn: t,
					score: avg,
					erSkjermet: info.skjermet > 0 && info.values.length === 0,
					trend,
					aar: years,
					isUncertain: false
				};
			})
			.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

		return { years, topics, byYear, byTopic, ranked };
	});

	// ── Chart.js ──────────────────────────────────────────────────────────────
	$effect(() => {
		if (!browser || !processed || activeTab === 'rangering') return;

		import('chart.js/auto').then(({ Chart }) => {
			// Line chart — development over years per topic
			if (lineCanvas && activeTab === 'linje') {
				lineChart?.destroy();
				const datasets = processed.topics.slice(0, 8).map((topic, i) => ({
					label: topic,
					data: processed.years.map(y => processed.byYear.get(y)?.get(topic) ?? null),
					borderColor: `hsl(${(i * 45) % 360}, 65%, 50%)`,
					backgroundColor: `hsl(${(i * 45) % 360}, 65%, 80%)`,
					spanGaps: false,
					tension: 0.3
				}));
				lineChart = new Chart(lineCanvas, {
					type: 'line',
					data: { labels: processed.years, datasets },
					options: {
						responsive: true,
						plugins: {
							legend: { position: 'bottom' },
							tooltip: {
								callbacks: {
									label: ctx =>
										ctx.parsed.y === null
											? `${ctx.dataset.label}: Skjermet/mangler`
											: `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}`
								}
							}
						},
						scales: {
							y: {
								min: 1,
								max: 5,
								title: { display: true, text: 'Snittverdi (1–5)' }
							},
							x: { title: { display: true, text: 'Skoleår' } }
						}
					}
				});
			}

			// Bar chart — top/bottom indicators
			if (barCanvas && activeTab === 'stolpe') {
				barChart?.destroy();
				const sorted = [...processed.ranked].filter(r => r.score !== null);
				const labels = sorted.map(r => r.navn);
				const values = sorted.map(r => r.score!);
				const colors = values.map(v =>
					v >= 4 ? '#22c55e' : v >= 3 ? '#3b82f6' : '#ef4444'
				);
				barChart = new Chart(barCanvas, {
					type: 'bar',
					data: {
						labels,
						datasets: [
							{
								label: 'Snittverdi',
								data: values,
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
								callbacks: { label: ctx => `${ctx.parsed.x.toFixed(2)} / 5` }
							}
						},
						scales: {
							x: { min: 1, max: 5, title: { display: true, text: 'Snittverdi (1–5)' } }
						}
					}
				});
			}
		});

		return () => {
			lineChart?.destroy();
			lineChart = null;
			barChart?.destroy();
			barChart = null;
		};
	});

	// ── Sparkline SVG ─────────────────────────────────────────────────────────
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
		const json = JSON.stringify(statistikk, null, 2);
		triggerDownload(json, 'application/json', 'elevundersokelsen.json');
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

<h1 style="margin-bottom: var(--spacing-lg);">Statistikk – Elevundersøkelsen</h1>

{#if data.geoError}
	<div class="feedback error" role="alert">
		Kunne ikke laste geografi: {data.geoError}
	</div>
{/if}

<!-- ── Filtre ──────────────────────────────────────────────────────────────── -->
<section class="card" style="margin-bottom: var(--spacing-lg);">
	<h2 style="margin-bottom: var(--spacing-md); font-size: 1rem;">Filtre</h2>
	<div class="filter-grid">
		<div class="form-group">
			<label for="fylke">Fylke</label>
			<select id="fylke" bind:value={selectedFylke} aria-label="Velg fylke">
				<option value="">— Velg fylke —</option>
				{#each data.fylker as f}
					<option value={f.fylkesnummer}>{f.navn}</option>
				{/each}
			</select>
		</div>

		<div class="form-group">
			<label for="kommune">Kommune {loadingKommuner ? '…' : ''}</label>
			<select id="kommune" bind:value={selectedKommune} disabled={!selectedFylke || loadingKommuner} aria-label="Velg kommune">
				<option value="">— Alle kommuner —</option>
				{#each kommuner as k}
					<option value={k.kommunenummer}>{k.navn}</option>
				{/each}
			</select>
			{#if errorKommuner}
				<span class="field-error">Feil: {errorKommuner}</span>
			{/if}
		</div>

		<div class="form-group">
			<label for="skole">Skole {loadingSkoler ? '…' : ''}</label>
			<select id="skole" bind:value={selectedSkole} disabled={!selectedKommune || loadingSkoler} aria-label="Velg skole">
				<option value="">— Alle skoler —</option>
				{#each skoler as s}
					<option value={s.nsrId}>{s.navn}</option>
				{/each}
			</select>
			{#if errorSkoler}
				<span class="field-error">Feil: {errorSkoler}</span>
			{/if}
		</div>

		<div class="form-group">
			<label for="aar">Skoleår</label>
			<select id="aar" bind:value={selectedAar} aria-label="Velg skoleår">
				{#each TILGJENGELIGE_AAR as y}
					<option value={y}>{y}</option>
				{/each}
			</select>
		</div>

		<div class="form-group">
			<label for="trinn">Trinn</label>
			<select id="trinn" bind:value={selectedTrinn} aria-label="Velg trinn">
				{#each TILGJENGELIGE_TRINN as t}
					<option value={t.value}>{t.label}</option>
				{/each}
			</select>
		</div>
	</div>
</section>

<!-- ── Status / empty ─────────────────────────────────────────────────────── -->
{#if !selectedFylke}
	<div class="empty-state" role="status">Velg et fylke for å vise statistikk.</div>
{:else if loadingStatistikk}
	<div class="empty-state" role="status" aria-live="polite">Laster statistikk…</div>
{:else if errorStatistikk}
	<div class="feedback error" role="alert">
		Feil ved henting av statistikk: {errorStatistikk}
	</div>
{:else if statistikk !== null && statistikk.length === 0}
	<div class="empty-state" role="status">Ingen data tilgjengelig for dette utvalget.</div>
{:else if processed}
	<!-- ── Tabs ──────────────────────────────────────────────────────────── -->
	<div class="tab-bar" role="tablist" aria-label="Visningsvalg">
		<button
			role="tab"
			aria-selected={activeTab === 'linje'}
			onclick={() => (activeTab = 'linje')}
			class:active={activeTab === 'linje'}>Tidsutvikling</button
		>
		<button
			role="tab"
			aria-selected={activeTab === 'stolpe'}
			onclick={() => (activeTab = 'stolpe')}
			class:active={activeTab === 'stolpe'}>Tema-oversikt</button
		>
		<button
			role="tab"
			aria-selected={activeTab === 'rangering'}
			onclick={() => (activeTab = 'rangering')}
			class:active={activeTab === 'rangering'}>Rangering</button
		>
	</div>

	<div class="card" role="tabpanel" aria-label="Statistikk-visning">
		{#if activeTab === 'linje'}
			<h2 style="font-size: 1rem; margin-bottom: var(--spacing-md);">
				Utvikling over år — {processed.topics.length} indikatorer
			</h2>
			{#if processed.years.length < 2}
				<p class="muted">Tidsutvikling krever data for flere år. Prøv å velge et annet nivå.</p>
			{:else}
				<canvas
					bind:this={lineCanvas}
					aria-label="Linjediagram: utvikling over år per indikator"
					style="max-height: 420px;"
				></canvas>
			{/if}
		{:else if activeTab === 'stolpe'}
			<h2 style="font-size: 1rem; margin-bottom: var(--spacing-md);">
				Topp og bunn — indikatorer ({processed.ranked.filter(r => r.score !== null).length} med data)
			</h2>
			<canvas
				bind:this={barCanvas}
				aria-label="Stolpediagram: snittverdi per indikator, sortert"
				style="max-height: 480px;"
			></canvas>
		{:else}
			<!-- Rangering-tabell med sparklines -->
			<h2 style="font-size: 1rem; margin-bottom: var(--spacing-md);">
				Rangert tabell
			</h2>
			<div style="overflow-x: auto;">
				<table class="stat-table" aria-label="Rangert tabell med trendlinje per indikator">
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
								<td class="rank">{i + 1}</td>
								<td>{row.navn}</td>
								<td class="score">
									{#if row.erSkjermet}
										<span class="badge skjermet">Skjermet</span>
									{:else if row.score === null}
										<span class="badge mangler">Mangler</span>
									{:else}
										<strong>{row.score.toFixed(2)}</strong> / 5
									{/if}
								</td>
								<td>
									{#if row.trend.some(v => v !== null)}
										<svg
											width="80"
											height="24"
											aria-hidden="true"
											style="display:block;"
										>
											<path
												d={sparklinePath(row.trend)}
												fill="none"
												stroke="var(--color-primary)"
												stroke-width="1.5"
											/>
										</svg>
									{:else}
										<span class="muted">—</span>
									{/if}
								</td>
								<td>
									{#if row.erSkjermet}
										<span class="badge skjermet" title="Verdien er prikket/skjermet av hensyn til personvern">Skjermet</span>
									{:else if row.isUncertain}
										<span class="badge usikker">Usikker match</span>
									{:else}
										<span class="badge ok">OK</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>

	<!-- ── Last ned ───────────────────────────────────────────────────────── -->
	<div style="display: flex; gap: var(--spacing-sm); margin-top: var(--spacing-md);">
		<button class="btn-secondary" onclick={downloadCSV} aria-label="Last ned data som CSV">
			↓ Last ned CSV
		</button>
		<button class="btn-secondary" onclick={downloadJSON} aria-label="Last ned rådata som JSON">
			↓ Last ned JSON
		</button>
	</div>
{/if}

<style>
	.filter-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: var(--spacing-md);
	}

	.field-error {
		font-size: 0.8rem;
		color: var(--color-error);
		display: block;
		margin-top: 0.2rem;
	}

	.empty-state {
		text-align: center;
		padding: var(--spacing-xl);
		color: var(--color-text-muted, #6b7280);
		border: 1px dashed var(--color-border);
		border-radius: 8px;
	}

	.muted {
		color: var(--color-text-muted, #6b7280);
		font-size: 0.9rem;
	}

	.tab-bar {
		display: flex;
		gap: 2px;
		margin-bottom: var(--spacing-md);
		border-bottom: 2px solid var(--color-border);
	}

	.tab-bar button {
		padding: 0.5rem 1rem;
		border: none;
		background: transparent;
		cursor: pointer;
		color: var(--color-text-muted, #6b7280);
		font-weight: 500;
		border-bottom: 2px solid transparent;
		margin-bottom: -2px;
		transition: color 0.15s, border-color 0.15s;
	}

	.tab-bar button.active,
	.tab-bar button[aria-selected='true'] {
		color: var(--color-primary);
		border-bottom-color: var(--color-primary);
	}

	.stat-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	.stat-table th,
	.stat-table td {
		padding: 0.5rem 0.75rem;
		text-align: left;
		border-bottom: 1px solid var(--color-border);
	}

	.stat-table th {
		background: var(--color-bg-subtle, #f9fafb);
		font-weight: 600;
	}

	.stat-table tr:hover td {
		background: var(--color-bg-subtle, #f9fafb);
	}

	.rank {
		color: var(--color-text-muted, #6b7280);
		font-size: 0.8rem;
		width: 2rem;
	}

	.score {
		white-space: nowrap;
	}

	.badge {
		font-size: 0.75rem;
		padding: 0.15rem 0.45rem;
		border-radius: 999px;
		font-weight: 600;
	}

	.badge.skjermet {
		background: #fef3c7;
		color: #92400e;
	}

	.badge.mangler {
		background: #f3f4f6;
		color: #6b7280;
	}

	.badge.usikker {
		background: #fff7ed;
		color: #c2410c;
	}

	.badge.ok {
		background: #f0fdf4;
		color: #166534;
	}

	@media (max-width: 640px) {
		.filter-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
