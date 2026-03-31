<script lang="ts">
	import { browser } from '$app/environment';
	import ClassSelector from '$lib/components/ClassSelector.svelte';
	import WeekSelector from '$lib/components/WeekSelector.svelte';
	import Feedback from '$lib/components/Feedback.svelte';
	import type { CurriculumNote, WeeklyPlan, CalendarEvent } from '$lib/types/domain';
	import { getJSON, postJSON } from '$lib/api/client';

	let activeMainTab = $state<'wizard' | 'ukeplan'>('wizard');
	let feedback = $state<{ message: string; type: 'success' | 'error' } | null>(null);

	// ── Mock data for wizard ──────────────────────────────────────────────────
	const MOCK_FAG = [
		{ kode: 'NOR', navn: 'Norsk' },
		{ kode: 'MAT', navn: 'Matematikk' },
		{ kode: 'ENG', navn: 'Engelsk' },
		{ kode: 'KRL', navn: 'KRLE' },
		{ kode: 'NAT', navn: 'Naturfag' },
		{ kode: 'SAF', navn: 'Samfunnsfag' },
		{ kode: 'KRO', navn: 'Kroppsøving' },
		{ kode: 'MUS', navn: 'Musikk' },
		{ kode: 'KHV', navn: 'Kunst og håndverk' }
	];

	const MOCK_MAL: Record<string, string[]> = {
		NOR: [
			'Lese og reflektere over et bredt utvalg av tekster i ulike sjangre',
			'Skrive tekster med ulik form og for ulike formål',
			'Bruke digitale verktøy i skrivearbeidet',
			'Samtale om litteratur, teater og film',
			'Bruke biblioteket og digitale ressurser til informasjonsinnhenting'
		],
		MAT: [
			'Bruke tall og algebra til å løse problemer fra dagliglivet',
			'Arbeide med geometri, måling og enheter',
			'Tolke og lage statistikk og sannsynlighetsberegninger',
			'Bruke digitale verktøy til beregning og visualisering'
		],
		ENG: [
			'Lytte til og forstå engelsk i ulike sammenhenger',
			'Kommunisere muntlig på engelsk med god flyt',
			'Skrive tekster på engelsk for ulike formål',
			'Lese og reflektere over engelskspråklige tekster'
		],
		KRL: [
			'Utforske og presentere mangfoldet innen religioner og livssyn',
			'Reflektere over etiske spørsmål og menneskeverd',
			'Samtale om filosofi, livsmestring og identitet'
		],
		NAT: [
			'Utforske og beskrive naturfenomener fra nær og fjern verden',
			'Planlegge og gjennomføre naturfaglige undersøkelser',
			'Kommunisere om naturfag og bruke fagbegreper',
			'Bruke digitale verktøy til datainnhenting og presentasjon'
		],
		SAF: [
			'Utforske demokrati og samfunnsstrukturer i Norge og verden',
			'Lese og lage kart og arbeide med geografi',
			'Reflektere over historiske hendelser og årsakssammenhenger'
		],
		KRO: [
			'Delta i og lede varierte idrettsaktiviteter',
			'Trene og reflektere over sammenhengen mellom aktivitet og helse',
			'Praktisere friluftsliv i ulike årstider'
		],
		MUS: [
			'Synge og spille musikk i samspill med andre',
			'Lytte aktivt til og analysere musikk fra ulike kulturer',
			'Komponere, improvisere og skape egne musikalske uttrykk'
		],
		KHV: [
			'Bruke ulike materialer, redskaper og teknikker i skapende arbeid',
			'Analysere og reflektere over design, arkitektur og kunsthåndverk',
			'Arbeide med digitale verktøy i kunst og håndverk'
		]
	};

	// ── Wizard state ──────────────────────────────────────────────────────────
	interface Session {
		id: string;
		tittel: string;
		mal: string;
		varighet: number;
	}
	interface Plan {
		id: string;
		fag: string;
		fagNavn: string;
		mal: string[];
		okter: Session[];
		createdAt: string;
	}

	let wizardStep = $state(1);
	let wizardFag = $state('');
	let wizardMal = $state<string[]>([]);
	let wizardOkter = $state<Session[]>([]);
	let newOktTittel = $state('');
	let newOktMal = $state('');
	let newOktVarighet = $state(45);
	let savedPlans = $state<Plan[]>([]);

	let availableMal = $derived(
		wizardFag ? (MOCK_MAL[wizardFag] ?? []) : []
	);

	function loadPlans() {
		if (!browser) return;
		try {
			const raw = localStorage.getItem('skolebibliotek_plans');
			savedPlans = raw ? JSON.parse(raw) : [];
		} catch {
			savedPlans = [];
		}
	}

	function persistPlans(plans: Plan[]) {
		if (!browser) return;
		localStorage.setItem('skolebibliotek_plans', JSON.stringify(plans));
		savedPlans = plans;
	}

	function toggleMal(mal: string) {
		wizardMal = wizardMal.includes(mal)
			? wizardMal.filter(m => m !== mal)
			: [...wizardMal, mal];
	}

	function addOkt() {
		if (!newOktTittel.trim()) {
			feedback = { message: 'Gi økten en tittel', type: 'error' };
			return;
		}
		wizardOkter = [
			...wizardOkter,
			{ id: crypto.randomUUID(), tittel: newOktTittel.trim(), mal: newOktMal, varighet: newOktVarighet }
		];
		newOktTittel = '';
		newOktMal = '';
		newOktVarighet = 45;
	}

	function removeOkt(id: string) {
		wizardOkter = wizardOkter.filter(o => o.id !== id);
	}

	function savePlan() {
		if (!wizardFag || wizardMal.length === 0 || wizardOkter.length === 0) {
			feedback = { message: 'Fag, minst ett mål og minst én økt er påkrevd', type: 'error' };
			return;
		}
		const fagNavn = MOCK_FAG.find(f => f.kode === wizardFag)?.navn ?? wizardFag;
		const plan: Plan = {
			id: crypto.randomUUID(),
			fag: wizardFag,
			fagNavn,
			mal: wizardMal,
			okter: wizardOkter,
			createdAt: new Date().toISOString()
		};
		persistPlans([plan, ...savedPlans]);
		feedback = { message: 'Plan lagret!', type: 'success' };
		wizardStep = 1;
		wizardFag = '';
		wizardMal = [];
		wizardOkter = [];
	}

	function deletePlan(id: string) {
		persistPlans(savedPlans.filter(p => p.id !== id));
	}

	function exportJSON() {
		const blob = new Blob([JSON.stringify(savedPlans, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'planlegger-planer.json';
		a.click();
		URL.revokeObjectURL(url);
	}

	let importInput = $state<HTMLInputElement | null>(null);

	function handleImport(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const plans = JSON.parse(reader.result as string);
				if (Array.isArray(plans)) {
					persistPlans(plans);
					feedback = { message: `${plans.length} planer importert`, type: 'success' };
				} else {
					feedback = { message: 'Ugyldig JSON-format', type: 'error' };
				}
			} catch {
				feedback = { message: 'Feil ved lesing av fil', type: 'error' };
			}
		};
		reader.readAsText(file);
	}

	$effect(() => { loadPlans(); });

	// ── Ukeplan (existing) ────────────────────────────────────────────────────
	let classId = $state<number | null>(null);
	let weekStart = $state(getMonday());
	let curriculumNotes = $state('');
	let weeklyPlan = $state('');
	let calendarEvents = $state<CalendarEvent[]>([]);
	let loadingWeek = $state(false);
	let savingNotes = $state(false);
	let savingPlan = $state(false);
	let showNewEventForm = $state(false);
	let newEventType = $state<'ferie' | 'elevsamtale' | 'foreldremøte'>('ferie');
	let newEventDate = $state('');
	let newEventTime = $state('');
	let newEventTitle = $state('');
	let newEventAgenda = $state('');

	function getMonday(): string {
		const now = new Date();
		const day = now.getDay();
		const diff = now.getDate() - day + (day === 0 ? -6 : 1);
		return new Date(now.setDate(diff)).toISOString().split('T')[0];
	}

	async function loadWeekData() {
		if (!classId) return;
		loadingWeek = true;
		try {
			const res = await getJSON<{ notes: CurriculumNote | null; plan: WeeklyPlan | null }>(
				`/api/weekly?classId=${classId}&weekStart=${weekStart}`
			);
			curriculumNotes = res.notes?.notes || '';
			weeklyPlan = res.plan?.plan_md || '';
			calendarEvents = [];
		} catch {
			feedback = { message: 'Feil ved lasting av data', type: 'error' };
		} finally {
			loadingWeek = false;
		}
	}

	async function saveNotes() {
		if (!classId) return;
		savingNotes = true;
		try {
			await postJSON('/api/weekly', { class_id: classId, week_start: weekStart, notes: curriculumNotes });
			feedback = { message: 'Pensum lagret', type: 'success' };
		} catch {
			feedback = { message: 'Feil ved lagring', type: 'error' };
		} finally {
			savingNotes = false;
		}
	}

	async function savePlanDb() {
		if (!classId) return;
		savingPlan = true;
		try {
			await postJSON('/api/weekly', { class_id: classId, week_start: weekStart, plan_md: weeklyPlan });
			feedback = { message: 'Ukeplan lagret', type: 'success' };
		} catch {
			feedback = { message: 'Feil ved lagring', type: 'error' };
		} finally {
			savingPlan = false;
		}
	}

	async function addEvent() {
		if (!classId || !newEventDate || !newEventTitle) {
			feedback = { message: 'Fyll ut dato og tittel', type: 'error' };
			return;
		}
		try {
			await postJSON('/api/calendar', {
				class_id: classId,
				date: newEventDate,
				time: newEventTime || null,
				type: newEventType,
				title: newEventTitle,
				agenda: newEventAgenda || null
			});
			newEventDate = '';
			newEventTime = '';
			newEventTitle = '';
			newEventAgenda = '';
			showNewEventForm = false;
			feedback = { message: 'Hendelse lagt til', type: 'success' };
			await loadWeekData();
		} catch {
			feedback = { message: 'Feil ved tillegging av hendelse', type: 'error' };
		}
	}

	$effect(() => {
		if (classId && weekStart && activeMainTab === 'ukeplan') {
			loadWeekData();
		}
	});
</script>

<svelte:head>
	<title>Planlegger – Skolebibliotek</title>
</svelte:head>

<div class="page-header">
	<h1>Planlegger</h1>
	<p class="subtitle">Leksjonsveiviser og ukeplaner</p>
</div>

{#if feedback}
	<Feedback message={feedback.message} type={feedback.type} onDismiss={() => (feedback = null)} />
{/if}

<!-- Main tabs -->
<div class="tab-bar" role="tablist" style="margin-bottom: 1.5rem;">
	<button
		role="tab"
		class:active={activeMainTab === 'wizard'}
		aria-selected={activeMainTab === 'wizard'}
		onclick={() => (activeMainTab = 'wizard')}
	>Planveiviser</button>
	<button
		role="tab"
		class:active={activeMainTab === 'ukeplan'}
		aria-selected={activeMainTab === 'ukeplan'}
		onclick={() => (activeMainTab = 'ukeplan')}
	>Ukeplan</button>
</div>

<!-- ══ Wizard tab ════════════════════════════════════════════════════════════ -->
{#if activeMainTab === 'wizard'}
	<!-- Step indicator -->
	<div class="wizard-steps" aria-label="Fremdrift" style="margin-bottom: 1.5rem;">
		<div class="wizard-step" class:active={wizardStep === 1} class:done={wizardStep > 1}>
			<div class="step-num">{wizardStep > 1 ? '✓' : '1'}</div>
			<span class="step-label">Velg fag</span>
		</div>
		<div class="wizard-step" class:active={wizardStep === 2} class:done={wizardStep > 2}>
			<div class="step-num">{wizardStep > 2 ? '✓' : '2'}</div>
			<span class="step-label">Kompetansemål</span>
		</div>
		<div class="wizard-step" class:active={wizardStep === 3}>
			<div class="step-num">3</div>
			<span class="step-label">Bygg plan</span>
		</div>
	</div>

	<div class="card" style="margin-bottom: 1.5rem;">
		<!-- Step 1: Choose subject -->
		{#if wizardStep === 1}
			<h2 style="font-size: 1.1rem; margin-bottom: 1rem;">Velg fag</h2>
			<div class="fag-grid">
				{#each MOCK_FAG as fag}
					<button
						class="fag-btn"
						class:selected={wizardFag === fag.kode}
						onclick={() => (wizardFag = fag.kode)}
					>
						{fag.navn}
						<span class="fag-kode">{fag.kode}</span>
					</button>
				{/each}
			</div>
			<div style="margin-top: 1.5rem;">
				<button disabled={!wizardFag} onclick={() => (wizardStep = 2)}>
					Neste: Velg kompetansemål →
				</button>
			</div>

		<!-- Step 2: Choose competency goals -->
		{:else if wizardStep === 2}
			<div class="step-header">
				<h2 style="font-size: 1.1rem; margin-bottom: 0;">
					Kompetansemål — {MOCK_FAG.find(f => f.kode === wizardFag)?.navn}
				</h2>
				<button class="button-ghost button-sm" onclick={() => (wizardStep = 1)}>← Tilbake</button>
			</div>
			<p style="color: var(--color-text-light); font-size: 0.875rem; margin: 0.5rem 0 1rem;">
				Velg ett eller flere mål for denne undervisningssekvensen.
			</p>
			<div class="mal-list">
				{#each availableMal as mal}
					<label class="mal-item" class:checked={wizardMal.includes(mal)}>
						<input
							type="checkbox"
							checked={wizardMal.includes(mal)}
							onchange={() => toggleMal(mal)}
							style="width: auto;"
						/>
						<span>{mal}</span>
					</label>
				{/each}
			</div>
			<div style="margin-top: 1.5rem;" class="button-group">
				<button disabled={wizardMal.length === 0} onclick={() => (wizardStep = 3)}>
					Neste: Bygg plan ({wizardMal.length} mål valgt) →
				</button>
			</div>

		<!-- Step 3: Build sessions -->
		{:else if wizardStep === 3}
			<div class="step-header">
				<h2 style="font-size: 1.1rem; margin-bottom: 0;">Bygg undervisningsplan</h2>
				<button class="button-ghost button-sm" onclick={() => (wizardStep = 2)}>← Tilbake</button>
			</div>
			<p style="color: var(--color-text-light); font-size: 0.875rem; margin: 0.5rem 0 1.25rem;">
				Legg til økter. Knytt hvert til et kompetansemål.
			</p>

			<!-- Existing sessions -->
			{#if wizardOkter.length > 0}
				<div class="okter-list">
					{#each wizardOkter as okt, i}
						<div class="okt-row">
							<span class="okt-num">{i + 1}</span>
							<div class="okt-info">
								<strong>{okt.tittel}</strong>
								{#if okt.mal}
									<span class="okt-mal">{okt.mal}</span>
								{/if}
							</div>
							<span class="okt-varighet">{okt.varighet} min</span>
							<button class="button-ghost button-sm" onclick={() => removeOkt(okt.id)} aria-label="Slett økt">✕</button>
						</div>
					{/each}
				</div>
			{:else}
				<p style="color: var(--color-text-muted); font-size: 0.875rem; margin-bottom: 1rem;">
					Ingen økter ennå. Legg til en økt nedenfor.
				</p>
			{/if}

			<!-- Add session form -->
			<div class="add-okt-form card" style="background: var(--color-bg-light);">
				<h3 style="font-size: 0.9rem; margin-bottom: 0.75rem;">+ Legg til økt</h3>
				<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
					<div class="form-group" style="margin-bottom: 0;">
						<label for="okt-tittel">Tittel</label>
						<input id="okt-tittel" type="text" placeholder="f.eks. Innledning til lesing" bind:value={newOktTittel} />
					</div>
					<div class="form-group" style="margin-bottom: 0;">
						<label for="okt-varighet">Varighet (min)</label>
						<input id="okt-varighet" type="number" min="10" max="300" step="5" bind:value={newOktVarighet} />
					</div>
				</div>
				<div class="form-group" style="margin-top: 0.75rem; margin-bottom: 0.75rem;">
					<label for="okt-mal">Kompetansemål (valgfritt)</label>
					<select id="okt-mal" bind:value={newOktMal}>
						<option value="">— Ingen spesifikt mål —</option>
						{#each wizardMal as mal}
							<option value={mal}>{mal.slice(0, 80)}{mal.length > 80 ? '…' : ''}</option>
						{/each}
					</select>
				</div>
				<button class="button-secondary button-sm" onclick={addOkt}>Legg til økt</button>
			</div>

			<div style="margin-top: 1.5rem;" class="button-group">
				<button disabled={wizardOkter.length === 0} onclick={savePlan}>
					Lagre plan
				</button>
			</div>
		{/if}
	</div>

	<!-- Saved plans -->
	<div class="card">
		<div class="step-header" style="margin-bottom: 1rem;">
			<h2 style="font-size: 1.05rem; margin-bottom: 0;">
				Lagrede planer
				{#if savedPlans.length > 0}
					<span style="font-weight: 400; color: var(--color-text-light); font-size: 0.9rem;">
						({savedPlans.length})
					</span>
				{/if}
			</h2>
			<div class="button-group">
				{#if savedPlans.length > 0}
					<button class="button-secondary button-sm" onclick={exportJSON}>↓ Eksporter JSON</button>
				{/if}
				<label class="button button-secondary button-sm" style="cursor: pointer; margin: 0;">
					↑ Importer JSON
					<input bind:this={importInput} type="file" accept=".json" onchange={handleImport} style="display: none;" />
				</label>
			</div>
		</div>

		{#if savedPlans.length === 0}
			<div class="empty-state" style="padding: 1.5rem;">
				<p>Ingen lagrede planer ennå. Bruk veiviseren ovenfor for å lage din første plan.</p>
			</div>
		{:else}
			<div class="plans-list">
				{#each savedPlans as plan}
					<div class="plan-card">
						<div class="plan-header">
							<div>
								<span class="badge badge-blue">{plan.fagNavn ?? plan.fag}</span>
								<strong style="margin-left: 0.5rem;">{plan.okter.length} økt{plan.okter.length !== 1 ? 'er' : ''}</strong>
							</div>
							<button
								class="button-ghost button-sm"
								onclick={() => deletePlan(plan.id)}
								aria-label="Slett plan"
							>Slett</button>
						</div>
						<ul class="plan-mal-list">
							{#each plan.mal.slice(0, 2) as mal}
								<li>{mal}</li>
							{/each}
							{#if plan.mal.length > 2}
								<li style="color: var(--color-text-muted);">+ {plan.mal.length - 2} mål til</li>
							{/if}
						</ul>
						<p style="font-size: 0.78rem; color: var(--color-text-muted); margin-top: 0.5rem;">
							Lagret {new Date(plan.createdAt).toLocaleDateString('nb-NO')}
						</p>
					</div>
				{/each}
			</div>
		{/if}
	</div>

<!-- ══ Ukeplan tab ═══════════════════════════════════════════════════════════ -->
{:else}
	<div class="card" style="margin-bottom: 1rem;">
		<ClassSelector {classId} onClassChange={(id) => { classId = id; }} />
	</div>

	{#if classId}
		<div class="card" style="margin-bottom: 1rem;">
			<WeekSelector {weekStart} onWeekChange={(w) => { weekStart = w; }} />
		</div>

		{#if loadingWeek}
			<div class="card skeleton-block" style="height: 200px; margin-bottom: 1rem;"></div>
		{:else}
			<div class="card" style="margin-bottom: 1rem;">
				<h2 class="section-title">Pensum denne uka</h2>
				<div class="form-group">
					<label for="curriculum">Emner, kapitler og læringsmål</label>
					<textarea
						id="curriculum"
						rows="5"
						placeholder="Beskriv pensum for denne uka..."
						bind:value={curriculumNotes}
						disabled={savingNotes}
					></textarea>
				</div>
				<button onclick={saveNotes} disabled={savingNotes}>
					{savingNotes ? 'Lagrer…' : 'Lagre pensum'}
				</button>
			</div>

			<div class="card" style="margin-bottom: 1rem;">
				<h2 class="section-title">Ukeplan (utkast)</h2>
				<div class="form-group">
					<label for="plan">Daglig plan (markdown ok)</label>
					<textarea
						id="plan"
						rows="8"
						placeholder="Mandag: …&#10;Tirsdag: …&#10;&#10;Du kan bruke markdown."
						bind:value={weeklyPlan}
						disabled={savingPlan}
					></textarea>
				</div>
				<button onclick={savePlanDb} disabled={savingPlan}>
					{savingPlan ? 'Lagrer…' : 'Lagre ukeplan'}
				</button>
			</div>

			<div class="card">
				<h2 class="section-title">Hendelser</h2>
				{#if calendarEvents.length === 0}
					<p style="color: var(--color-text-light); margin-bottom: 1rem; font-size: 0.9rem;">
						Ingen hendelser registrert denne uka.
					</p>
				{:else}
					<ul style="margin-bottom: 1rem; list-style: none;">
						{#each calendarEvents as event}
							<li style="padding: 0.75rem 0; border-bottom: 1px solid var(--color-border);">
								<strong>{event.title}</strong>
								<span class="badge badge-gray" style="margin-left: 0.5rem;">{event.type}</span>
								<div style="font-size: 0.85rem; color: var(--color-text-light); margin-top: 0.2rem;">
									{event.date}{event.time ? ` kl. ${event.time}` : ''}
								</div>
							</li>
						{/each}
					</ul>
				{/if}
				<button
					class="button-secondary"
					onclick={() => (showNewEventForm = true)}
				>+ Legg til hendelse</button>

				{#if showNewEventForm}
					<div class="modal-overlay" onclick={(e) => e.target === e.currentTarget && (showNewEventForm = false)}>
						<div class="modal">
							<h2>Ny hendelse</h2>
							<div class="form-group">
								<label for="ev-type">Type</label>
								<select id="ev-type" bind:value={newEventType}>
									<option value="ferie">Ferie</option>
									<option value="elevsamtale">Elevsamtale</option>
									<option value="foreldremøte">Foreldremøte</option>
								</select>
							</div>
							<div class="form-group">
								<label for="ev-date">Dato</label>
								<input id="ev-date" type="date" bind:value={newEventDate} />
							</div>
							<div class="form-group">
								<label for="ev-time">Tid (valgfritt)</label>
								<input id="ev-time" type="time" bind:value={newEventTime} />
							</div>
							<div class="form-group">
								<label for="ev-title">Tittel</label>
								<input id="ev-title" type="text" placeholder="f.eks. Påskeferie" bind:value={newEventTitle} />
							</div>
							<div class="form-group">
								<label for="ev-agenda">Agenda (valgfritt)</label>
								<textarea id="ev-agenda" rows="2" bind:value={newEventAgenda}></textarea>
							</div>
							<div class="button-group">
								<button onclick={addEvent}>Legg til</button>
								<button class="button-secondary" onclick={() => (showNewEventForm = false)}>Avbryt</button>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	{:else}
		<div class="empty-state">
			<div class="empty-icon">📅</div>
			<p>Velg eller opprett en klasse for å vise og redigere ukeplanen.</p>
		</div>
	{/if}
{/if}

<style>
	.fag-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
		gap: 0.625rem;
	}

	.fag-btn {
		background: var(--color-bg-light);
		color: var(--color-text);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: 0.75rem 0.5rem;
		font-weight: 500;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		transition: border-color 0.15s, background 0.15s;
	}
	.fag-btn:hover {
		border-color: var(--color-primary-mid);
		background: var(--color-primary-light);
	}
	.fag-btn.selected {
		border-color: var(--color-primary);
		background: var(--color-primary-light);
		color: var(--color-primary);
	}
	.fag-kode {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		font-weight: 400;
	}
	.fag-btn.selected .fag-kode {
		color: var(--color-primary);
		opacity: 0.7;
	}

	.step-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
	}

	.mal-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.mal-item {
		display: flex;
		align-items: flex-start;
		gap: 0.625rem;
		padding: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: background 0.1s, border-color 0.1s;
		font-weight: normal;
		margin-bottom: 0;
	}
	.mal-item:hover {
		background: var(--color-bg-light);
	}
	.mal-item.checked {
		background: var(--color-primary-light);
		border-color: var(--color-primary-mid);
	}
	.mal-item input {
		margin-top: 2px;
		flex-shrink: 0;
	}
	.mal-item span {
		font-size: 0.9rem;
		line-height: 1.5;
	}

	.add-okt-form {
		margin-top: 1rem;
		border: 1px dashed var(--color-border) !important;
	}

	.okter-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	.okt-row {
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 0.75rem;
		background: var(--color-bg-light);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}
	.okt-num {
		width: 24px;
		height: 24px;
		background: var(--color-primary);
		color: white;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 700;
		flex-shrink: 0;
	}
	.okt-info strong {
		display: block;
		font-size: 0.9rem;
	}
	.okt-mal {
		display: block;
		font-size: 0.78rem;
		color: var(--color-text-light);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 300px;
	}
	.okt-varighet {
		font-size: 0.8rem;
		color: var(--color-text-muted);
		white-space: nowrap;
	}

	.plans-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
	}
	.plan-card {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: 1rem;
		background: var(--color-bg-light);
	}
	.plan-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.75rem;
	}
	.plan-mal-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.plan-mal-list li {
		font-size: 0.82rem;
		color: var(--color-text-light);
		line-height: 1.4;
	}
	.plan-mal-list li::before {
		content: '• ';
		color: var(--color-primary);
	}

	@media (max-width: 640px) {
		.add-okt-form > div:first-of-type {
			grid-template-columns: 1fr;
		}
		.okt-row {
			grid-template-columns: auto 1fr auto;
		}
		.okt-varighet {
			display: none;
		}
	}
</style>
