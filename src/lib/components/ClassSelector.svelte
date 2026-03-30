<script lang="ts">
	import type { ClassProfile } from '$lib/types/domain';
	import { getJSON, postJSON } from '$lib/api/client';

	interface Props {
		classId: number | null;
		onClassChange: (classId: number) => void;
	}

	let { classId, onClassChange }: Props = $props();

	let classes: ClassProfile[] = $state([]);
	let showNewClassForm = $state(false);
	let newClassName = $state('');
	let newClassGrade = $state<1 | 2 | 3 | 4>(1);
	let loading = $state(true);
	let error = $state('');

	async function loadClasses() {
		try {
			const data = await getJSON<{ classes: ClassProfile[] }>('/api/class');
			classes = data.classes || [];
			if (classes.length > 0 && !classId) {
				onClassChange(classes[0].id);
			}
		} catch (e) {
			error = 'Kunne ikke laste klasser';
			console.error(e);
		} finally {
			loading = false;
		}
	}

	async function createClass() {
		try {
			const result = await postJSON<{ id: number }>('/api/class', {
				name: newClassName,
				grade: newClassGrade
			});
			newClassName = '';
			showNewClassForm = false;
			await loadClasses();
			onClassChange(result.id);
		} catch (e) {
			error = 'Feil ved opprettelse av klasse';
			console.error(e);
		}
	}

	loadClasses();
</script>

<div class="form-group">
	<label for="class-select">Velg klasse</label>
	{#if loading}
		<p style="color: var(--color-text-light);">Laster...</p>
	{:else if classes.length === 0}
		<p style="color: var(--color-text-light); margin-bottom: var(--spacing-md);">Ingen klasser opprettet ennå.</p>
		<button type="button" onclick={() => (showNewClassForm = true)}>Opprett første klasse</button>
	{:else}
		<select
			id="class-select"
			value={classId || ''}
			onchange={(e) => onClassChange(parseInt(e.currentTarget.value))}
		>
			<option value="">Velg klasse...</option>
			{#each classes as cls}
				<option value={cls.id}>{cls.name} (trinn {cls.grade})</option>
			{/each}
		</select>
		<button
			type="button"
			class="button-secondary"
			style="margin-top: var(--spacing-md);"
			onclick={() => (showNewClassForm = true)}
		>
			+ Opprett ny klasse
		</button>
	{/if}

	{#if showNewClassForm}
		<div class="modal-overlay" onclick={(e) => e.target === e.currentTarget && (showNewClassForm = false)}>
			<div class="modal">
				<h2>Opprett ny klasse</h2>
				<div class="form-group">
					<label for="class-name">Klassenavn</label>
					<input
						id="class-name"
						type="text"
						placeholder="f.eks. 1A"
						bind:value={newClassName}
					/>
				</div>
				<div class="form-group">
					<label for="class-grade">Trinn</label>
					<select id="class-grade" bind:value={newClassGrade}>
						<option value={1}>Trinn 1</option>
						<option value={2}>Trinn 2</option>
						<option value={3}>Trinn 3</option>
						<option value={4}>Trinn 4</option>
					</select>
				</div>
				<div class="button-group">
					<button type="button" onclick={createClass}>Opprett</button>
					<button type="button" class="button-secondary" onclick={() => (showNewClassForm = false)}>Avbryt</button>
				</div>
			</div>
		</div>
	{/if}

	{#if error}
		<div class="feedback error">{error}</div>
	{/if}
</div>
