<script lang="ts">
	import ClassSelector from '$lib/components/ClassSelector.svelte';
	import WeekSelector from '$lib/components/WeekSelector.svelte';
	import Feedback from '$lib/components/Feedback.svelte';
	import type { CurriculumNote, WeeklyPlan, CalendarEvent } from '$lib/types/domain';
	import { getJSON, postJSON } from '$lib/api/client';

	let classId = $state<number | null>(null);
	let weekStart = $state(getMonday());

	let curriculumNotes = $state('');
	let weeklyPlan = $state('');
	let calendarEvents = $state<CalendarEvent[]>([]);

	let loadingWeek = $state(false);
	let savingNotes = $state(false);
	let savingPlan = $state(false);

	let feedback = $state<{ message: string; type: 'success' | 'error' } | null>(null);
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
		const monday = new Date(now.setDate(diff));
		return monday.toISOString().split('T')[0];
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
			// TODO: load calendar events when API is ready
			calendarEvents = [];
		} catch (e) {
			feedback = { message: 'Feil ved lasting av data', type: 'error' };
			console.error(e);
		} finally {
			loadingWeek = false;
		}
	}

	async function saveNotes() {
		if (!classId) return;
		savingNotes = true;
		try {
			await postJSON('/api/weekly', {
				class_id: classId,
				week_start: weekStart,
				notes: curriculumNotes
			});
			feedback = { message: 'Pensum lagret ✓', type: 'success' };
		} catch (e) {
			feedback = { message: 'Feil ved lagring av pensum', type: 'error' };
			console.error(e);
		} finally {
			savingNotes = false;
		}
	}

	async function savePlan() {
		if (!classId) return;
		savingPlan = true;
		try {
			await postJSON('/api/weekly', {
				class_id: classId,
				week_start: weekStart,
				plan_md: weeklyPlan
			});
			feedback = { message: 'Ukeplan lagret ✓', type: 'success' };
		} catch (e) {
			feedback = { message: 'Feil ved lagring av ukeplan', type: 'error' };
			console.error(e);
		} finally {
			savingPlan = false;
		}
	}

	async function addEvent() {
		if (!classId || !newEventDate || !newEventTitle) {
			feedback = { message: 'Fyll ut påkrevde felt', type: 'error' };
			return;
		}
		try {
			const eventDate = newEventTime ? `${newEventDate}T${newEventTime}` : newEventDate;
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
			feedback = { message: 'Hendelse lagt til ✓', type: 'success' };
			await loadWeekData();
		} catch (e) {
			feedback = { message: 'Feil ved tillegging av hendelse', type: 'error' };
			console.error(e);
		}
	}

	function handleClassChange(id: number) {
		classId = id;
		loadWeekData();
	}

	function handleWeekChange(newWeek: string) {
		weekStart = newWeek;
		loadWeekData();
	}

	$effect(() => {
		if (classId) {
			loadWeekData();
		}
	});
</script>

<svelte:head>
	<title>Planlegger – Skolebibliotek</title>
</svelte:head>

<h1>Planlegger</h1>

{#if feedback}
	<Feedback
		message={feedback.message}
		type={feedback.type}
		onDismiss={() => (feedback = null)}
	/>
{/if}

<div class="card">
	<ClassSelector {classId} onClassChange={handleClassChange} />
</div>

{#if classId}
	<div class="card">
		<WeekSelector {weekStart} onWeekChange={handleWeekChange} />
	</div>

	<!-- Section 1: Pensum -->
	<div class="card">
		<h2 class="section-title">Pensum (fritekst)</h2>
		<div class="form-group">
			<label for="curriculum">Beskriv pensum for denne uka</label>
			<textarea
				id="curriculum"
				rows="6"
				placeholder="Skriv ned emner, kapitler eller læringsmål som skal dekkes denne uka..."
				bind:value={curriculumNotes}
				disabled={savingNotes}
			></textarea>
		</div>
		<button
			type="button"
			onclick={saveNotes}
			disabled={savingNotes}
		>
			{savingNotes ? 'Lagrer...' : 'Lagre'}
		</button>
	</div>

	<!-- Section 2: Ukeplan -->
	<div class="card">
		<h2 class="section-title">Ukeplan (utkast)</h2>
		<div class="form-group">
			<label for="plan">Daglig ukeplan (markdown ok)</label>
			<textarea
				id="plan"
				rows="8"
				placeholder="Mandag: ...\nTirsdag: ...\n\nDu kan bruke markdown for formatering."
				bind:value={weeklyPlan}
				disabled={savingPlan}
			></textarea>
		</div>
		<button
			type="button"
			onclick={savePlan}
			disabled={savingPlan}
		>
			{savingPlan ? 'Lagrer...' : 'Lagre'}
		</button>
	</div>

	<!-- Section 3: Hendelser -->
	<div class="card">
		<h2 class="section-title">Hendelser denne uka</h2>

		{#if calendarEvents.length === 0}
			<p style="color: var(--color-text-light); margin-bottom: var(--spacing-md);">Ingen hendelser registrert.</p>
		{:else}
			<ul style="margin-bottom: var(--spacing-lg); list-style: none;">
				{#each calendarEvents as event}
					<li style="padding: var(--spacing-md); border-bottom: 1px solid var(--color-border);">
						<strong>{event.type === 'ferie' ? '🏖️' : event.type === 'elevsamtale' ? '👤' : '👨‍👩‍👧‍👦'} {event.title}</strong>
						<br />
						<span style="color: var(--color-text-light); font-size: 0.9rem;">
							{event.date}
							{#if event.time}
								kl. {event.time}
							{/if}
						</span>
						{#if event.agenda}
							<br />
							<span style="font-size: 0.9rem;">{event.agenda}</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}

		<button
			type="button"
			class="button-secondary"
			onclick={() => (showNewEventForm = true)}
		>
			+ Legg til hendelse
		</button>

		{#if showNewEventForm}
			<div class="modal-overlay" onclick={(e) => e.target === e.currentTarget && (showNewEventForm = false)}>
				<div class="modal">
					<h2>Legg til hendelse</h2>
					<div class="form-group">
						<label for="event-type">Type hendelse</label>
						<select id="event-type" bind:value={newEventType}>
							<option value="ferie">Ferie</option>
							<option value="elevsamtale">Elevsamtale</option>
							<option value="foreldremøte">Foreldremøte</option>
						</select>
					</div>
					<div class="form-group">
						<label for="event-date">Dato</label>
						<input
							id="event-date"
							type="date"
							bind:value={newEventDate}
						/>
					</div>
					<div class="form-group">
						<label for="event-time">Tid (valgfritt)</label>
						<input
							id="event-time"
							type="time"
							bind:value={newEventTime}
						/>
					</div>
					<div class="form-group">
						<label for="event-title">Tittel</label>
						<input
							id="event-title"
							type="text"
							placeholder="f.eks. Påskeferie, 1-samtale med Arne"
							bind:value={newEventTitle}
						/>
					</div>
					<div class="form-group">
						<label for="event-agenda">Agenda (valgfritt)</label>
						<textarea
							id="event-agenda"
							rows="3"
							placeholder="Notater eller agenda for hendelsen"
							bind:value={newEventAgenda}
						></textarea>
					</div>
					<div class="button-group">
						<button type="button" onclick={addEvent}>Legg til</button>
						<button type="button" class="button-secondary" onclick={() => (showNewEventForm = false)}>Avbryt</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}
