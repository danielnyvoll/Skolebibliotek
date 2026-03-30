<script lang="ts">
	import Feedback from '$lib/components/Feedback.svelte';
	import type { DocumentItem } from '$lib/types/domain';
	import { getJSON, postJSON } from '$lib/api/client';

	let documents = $state<DocumentItem[]>([]);
	let loading = $state(true);
	let feedback = $state<{ message: string; type: 'success' | 'error' } | null>(null);
	let showNewDocForm = $state(false);

	let newDocTitle = $state('');
	let newDocCollection = $state('');
	let newDocGrade = $state<1 | 2 | 3 | 4>(1);
	let newDocLanguage = $state('norsk');
	let newDocTags = $state('');
	let newDocContent = $state('');
	let savingDoc = $state(false);

	let filterText = $state('');

	async function loadDocuments() {
		try {
			const res = await getJSON<{ documents: DocumentItem[] }>('/api/documents');
			documents = res.documents || [];
		} catch (e) {
			feedback = { message: 'Feil ved lasting av dokumenter', type: 'error' };
			console.error(e);
		} finally {
			loading = false;
		}
	}

	async function createDocument() {
		if (!newDocTitle || !newDocCollection || !newDocContent) {
			feedback = { message: 'Fyll ut påkrevde felt', type: 'error' };
			return;
		}

		savingDoc = true;
		try {
			await postJSON('/api/documents', {
				title: newDocTitle,
				collection: newDocCollection,
				grade: newDocGrade,
				language: newDocLanguage,
				tags: newDocTags,
				content: newDocContent
			});

			newDocTitle = '';
			newDocCollection = '';
			newDocGrade = 1;
			newDocLanguage = 'norsk';
			newDocTags = '';
			newDocContent = '';
			showNewDocForm = false;

			feedback = { message: 'Dokument opprettet ✓', type: 'success' };
			await loadDocuments();
		} catch (e) {
			feedback = { message: 'Feil ved opprettelse av dokument', type: 'error' };
			console.error(e);
		} finally {
			savingDoc = false;
		}
	}

	function parseTagsFromDoc(tagsStr: string | string[]): string[] {
		if (Array.isArray(tagsStr)) return tagsStr;
		if (typeof tagsStr === 'string') {
			try {
				const parsed = JSON.parse(tagsStr);
				return Array.isArray(parsed) ? parsed : [];
			} catch {
				return tagsStr.split(',').map(t => t.trim()).filter(t => t);
			}
		}
		return [];
	}

	const filteredDocuments = $derived(
		documents.filter(doc =>
			doc.title.toLowerCase().includes(filterText.toLowerCase())
		)
	);

	const commonCollections = $derived.by(() => {
		const cols = new Set<string>();
		documents.forEach(doc => cols.add(doc.collection));
		return Array.from(cols).sort();
	});

	loadDocuments();
</script>

<svelte:head>
	<title>Dokumentbank – Skolebibliotek</title>
</svelte:head>

<h1>Dokumentbank</h1>

{#if feedback}
	<Feedback
		message={feedback.message}
		type={feedback.type}
		onDismiss={() => (feedback = null)}
	/>
{/if}

<!-- Nytt dokument -->
<div class="card">
	<h2 class="section-title">Legg til dokument</h2>
	<button
		type="button"
		onclick={() => (showNewDocForm = !showNewDocForm)}
		class="button-secondary"
	>
		{showNewDocForm ? '✕ Avbryt' : '+ Nytt dokument'}
	</button>

	{#if showNewDocForm}
		<div style="margin-top: var(--spacing-lg); padding-top: var(--spacing-lg); border-top: 1px solid var(--color-border);">
			<div class="form-group">
				<label for="doc-title">Tittel *</label>
				<input
					id="doc-title"
					type="text"
					placeholder="f.eks. Leseoppsummering – Snøhvit"
					bind:value={newDocTitle}
					disabled={savingDoc}
				/>
			</div>

			<div class="form-group">
				<label for="doc-collection">Kategori/Collection *</label>
				<input
					id="doc-collection"
					type="text"
					placeholder="f.eks. norsk-2, matte-3"
					list="collections-list"
					bind:value={newDocCollection}
					disabled={savingDoc}
				/>
				<datalist id="collections-list">
					{#each commonCollections as col}
						<option value={col} />
					{/each}
				</datalist>
			</div>

			<div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md);">
				<div class="form-group">
					<label for="doc-grade">Trinn *</label>
					<select id="doc-grade" bind:value={newDocGrade} disabled={savingDoc}>
						<option value={1}>Trinn 1</option>
						<option value={2}>Trinn 2</option>
						<option value={3}>Trinn 3</option>
						<option value={4}>Trinn 4</option>
					</select>
				</div>

				<div class="form-group">
					<label for="doc-language">Språk</label>
					<select id="doc-language" bind:value={newDocLanguage} disabled={savingDoc}>
						<option value="norsk">Norsk</option>
						<option value="engelsk">Engelsk</option>
						<option value="annet">Annet</option>
					</select>
				</div>
			</div>

			<div class="form-group">
				<label for="doc-tags">Tags (kommaseparert, valgfritt)</label>
				<input
					id="doc-tags"
					type="text"
					placeholder="f.eks. eventyr, lesing, forfattere"
					bind:value={newDocTags}
					disabled={savingDoc}
				/>
			</div>

			<div class="form-group">
				<label for="doc-content">Tekst/Innhold *</label>
				<textarea
					id="doc-content"
					rows="10"
					placeholder="Lim inn teksten eller innholdet her..."
					bind:value={newDocContent}
					disabled={savingDoc}
				></textarea>
			</div>

			<button
				type="button"
				onclick={createDocument}
				disabled={savingDoc}
			>
				{savingDoc ? 'Lagrer...' : 'Opprett dokument'}
			</button>
		</div>
	{/if}
</div>

<!-- Dokumenter liste -->
<div class="card">
	<h2 class="section-title">
		Dokumenter
		{#if filteredDocuments.length > 0}
			<span style="font-weight: 400; color: var(--color-text-light); font-size: 1rem;">
				({filteredDocuments.length})
			</span>
		{/if}
	</h2>

	{#if loading}
		<p style="color: var(--color-text-light);">Laster dokumenter...</p>
	{:else if documents.length === 0}
		<p style="color: var(--color-text-light);">Ingen dokumenter ennå. Lag ditt første dokument ovenfor!</p>
	{:else}
		<div class="form-group">
			<input
				type="text"
				placeholder="Søk etter dokumenttittel..."
				bind:value={filterText}
			/>
		</div>

		{#if filteredDocuments.length === 0}
			<p style="color: var(--color-text-light);">Ingen dokumenter samsvarer med søket.</p>
		{:else}
			<div style="display: grid; gap: var(--spacing-lg);">
				{#each filteredDocuments as doc}
					<div style="border-left: 4px solid var(--color-primary); padding-left: var(--spacing-md); padding-bottom: var(--spacing-md); border-bottom: 1px solid var(--color-border);">
						<h3 style="margin-bottom: var(--spacing-sm);">{doc.title}</h3>
						<div style="display: flex; gap: var(--spacing-md); margin-bottom: var(--spacing-sm); flex-wrap: wrap; font-size: 0.9rem;">
							<span style="background: var(--color-bg-light); padding: var(--spacing-xs) var(--spacing-sm); border-radius: var(--border-radius);">
								📁 {doc.collection}
							</span>
							<span style="background: var(--color-bg-light); padding: var(--spacing-xs) var(--spacing-sm); border-radius: var(--border-radius);">
								📚 Trinn {doc.grade}
							</span>
							<span style="background: var(--color-bg-light); padding: var(--spacing-xs) var(--spacing-sm); border-radius: var(--border-radius);">
								🌐 {doc.language}
							</span>
							<span style="color: var(--color-text-light);">
								{new Date(doc.created_at).toLocaleDateString('no-NO')}
							</span>
						</div>
						{#if parseTagsFromDoc(doc.tags).length > 0}
							<div style="display: flex; gap: var(--spacing-sm); margin-bottom: var(--spacing-sm); flex-wrap: wrap;">
								{#each parseTagsFromDoc(doc.tags) as tag}
									<span style="background: var(--color-primary); color: white; padding: var(--spacing-xs) var(--spacing-sm); border-radius: var(--border-radius); font-size: 0.85rem;">
										#{tag}
									</span>
								{/each}
							</div>
						{/if}
						<p style="color: var(--color-text-light); font-size: 0.9rem; line-height: 1.4;">
							{doc.content.substring(0, 150)}{doc.content.length > 150 ? '...' : ''}
						</p>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
