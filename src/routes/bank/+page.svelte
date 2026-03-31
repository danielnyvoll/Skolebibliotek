<script lang="ts">
	import Feedback from '$lib/components/Feedback.svelte';
	import type { DocumentItem } from '$lib/types/domain';
	import { getJSON, postJSON } from '$lib/api/client';

	let documents = $state<DocumentItem[]>([]);
	let loading = $state(true);
	let feedback = $state<{ message: string; type: 'success' | 'error' } | null>(null);
	let showNewDocForm = $state(false);
	let selectedDoc = $state<DocumentItem | null>(null);

	// Form state
	let newDocTitle = $state('');
	let newDocCollection = $state('');
	let newDocGrade = $state<1 | 2 | 3 | 4>(1);
	let newDocLanguage = $state('norsk');
	let newDocTags = $state('');
	let newDocContent = $state('');
	let savingDoc = $state(false);

	// Filters
	let filterText = $state('');
	let filterCollection = $state('');
	let filterGrade = $state('');
	let filterLanguage = $state('');

	async function loadDocuments() {
		loading = true;
		try {
			const res = await getJSON<{ documents: DocumentItem[] }>('/api/documents');
			documents = res.documents || [];
		} catch {
			feedback = { message: 'Feil ved lasting av dokumenter', type: 'error' };
		} finally {
			loading = false;
		}
	}

	async function createDocument() {
		if (!newDocTitle || !newDocCollection || !newDocContent) {
			feedback = { message: 'Tittel, kategori og innhold er påkrevd', type: 'error' };
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
			feedback = { message: 'Dokument opprettet', type: 'success' };
			await loadDocuments();
		} catch {
			feedback = { message: 'Feil ved opprettelse av dokument', type: 'error' };
		} finally {
			savingDoc = false;
		}
	}

	function parseTags(tagsStr: string | string[]): string[] {
		if (Array.isArray(tagsStr)) return tagsStr;
		if (typeof tagsStr === 'string') {
			try {
				const parsed = JSON.parse(tagsStr);
				return Array.isArray(parsed) ? parsed : [];
			} catch {
				return tagsStr
					.split(',')
					.map(t => t.trim())
					.filter(Boolean);
			}
		}
		return [];
	}

	const collections = $derived.by(() => {
		const cols = new Set<string>();
		documents.forEach(d => cols.add(d.collection));
		return Array.from(cols).sort();
	});

	const filteredDocuments = $derived(
		documents.filter(doc => {
			const q = filterText.toLowerCase();
			const matchText =
				!q ||
				doc.title.toLowerCase().includes(q) ||
				doc.collection.toLowerCase().includes(q) ||
				parseTags(doc.tags).some(t => t.toLowerCase().includes(q));
			const matchCol = !filterCollection || doc.collection === filterCollection;
			const matchGrade = !filterGrade || String(doc.grade) === filterGrade;
			const matchLang = !filterLanguage || doc.language === filterLanguage;
			return matchText && matchCol && matchGrade && matchLang;
		})
	);

	loadDocuments();
</script>

<svelte:head>
	<title>Dokumentbank – Skolebibliotek</title>
</svelte:head>

<div class="page-header">
	<h1>Dokumentbank</h1>
	<p class="subtitle">Søk og lagre læreplaner og undervisningsmateriell</p>
</div>

<!-- Coming next banner -->
<div class="alert alert-info" style="margin-bottom: 1.5rem; align-items: center;">
	<span style="font-size: 1.1rem;">🔗</span>
	<div>
		<strong>Kommer i neste iterasjon:</strong>
		Kobling til GREP-api og nasjonal læreplanbase — søk direkte i kompetansemål og læreplankoder.
	</div>
</div>

{#if feedback}
	<Feedback message={feedback.message} type={feedback.type} onDismiss={() => (feedback = null)} />
{/if}

<div class="bank-layout">
	<!-- ── Left: search + list ────────────────────────────────────────────── -->
	<div class="bank-main">
		<!-- Filters card -->
		<div class="card" style="margin-bottom: 1rem;">
			<div class="filter-row">
				<div class="search-wrap">
					<img src="/icons/search.svg" alt="" width="16" height="16" class="search-icon" />
					<input
						type="text"
						placeholder="Søk på tittel, kategori eller tag…"
						bind:value={filterText}
						class="search-input"
					/>
				</div>

				<select bind:value={filterCollection} style="width: auto; min-width: 130px;">
					<option value="">Alle kategorier</option>
					{#each collections as col}
						<option value={col}>{col}</option>
					{/each}
				</select>

				<select bind:value={filterGrade} style="width: auto; min-width: 110px;">
					<option value="">Alle trinn</option>
					<option value="1">Trinn 1</option>
					<option value="2">Trinn 2</option>
					<option value="3">Trinn 3</option>
					<option value="4">Trinn 4</option>
				</select>

				<select bind:value={filterLanguage} style="width: auto; min-width: 110px;">
					<option value="">Alle språk</option>
					<option value="norsk">Norsk</option>
					<option value="engelsk">Engelsk</option>
					<option value="annet">Annet</option>
				</select>
			</div>

			<div class="filter-footer">
				<span style="font-size: 0.8rem; color: var(--color-text-light);">
					{#if loading}
						Laster…
					{:else}
						{filteredDocuments.length} av {documents.length} dokumenter
					{/if}
				</span>
				<button
					class="button-secondary button-sm"
					onclick={() => (showNewDocForm = !showNewDocForm)}
				>
					{showNewDocForm ? '✕ Avbryt' : '+ Nytt dokument'}
				</button>
			</div>
		</div>

		<!-- New document form -->
		{#if showNewDocForm}
			<div class="card" style="margin-bottom: 1rem; border-color: var(--color-primary-mid);">
				<h2 style="font-size: 1.05rem; margin-bottom: 1rem;">Nytt dokument</h2>
				<div class="form-group">
					<label for="doc-title">Tittel *</label>
					<input id="doc-title" type="text" placeholder="f.eks. Leseoppsummering – Snøhvit" bind:value={newDocTitle} disabled={savingDoc} />
				</div>
				<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
					<div class="form-group">
						<label for="doc-collection">Kategori *</label>
						<input id="doc-collection" type="text" placeholder="f.eks. norsk-7" list="collections-list" bind:value={newDocCollection} disabled={savingDoc} />
						<datalist id="collections-list">
							{#each collections as col}
								<option value={col} />
							{/each}
						</datalist>
					</div>
					<div class="form-group">
						<label for="doc-grade">Trinn</label>
						<select id="doc-grade" bind:value={newDocGrade} disabled={savingDoc}>
							<option value={1}>Trinn 1</option>
							<option value={2}>Trinn 2</option>
							<option value={3}>Trinn 3</option>
							<option value={4}>Trinn 4</option>
						</select>
					</div>
				</div>
				<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
					<div class="form-group">
						<label for="doc-language">Språk</label>
						<select id="doc-language" bind:value={newDocLanguage} disabled={savingDoc}>
							<option value="norsk">Norsk</option>
							<option value="engelsk">Engelsk</option>
							<option value="annet">Annet</option>
						</select>
					</div>
					<div class="form-group">
						<label for="doc-tags">Tags (kommaseparert)</label>
						<input id="doc-tags" type="text" placeholder="f.eks. lesing, eventyr" bind:value={newDocTags} disabled={savingDoc} />
					</div>
				</div>
				<div class="form-group">
					<label for="doc-content">Innhold *</label>
					<textarea id="doc-content" rows="6" placeholder="Lim inn innholdet her…" bind:value={newDocContent} disabled={savingDoc}></textarea>
				</div>
				<button onclick={createDocument} disabled={savingDoc}>
					{savingDoc ? 'Lagrer…' : 'Opprett dokument'}
				</button>
			</div>
		{/if}

		<!-- Document list -->
		{#if loading}
			<div class="doc-skeleton-list">
				{#each [1, 2, 3] as _}
					<div class="skeleton-block" style="height: 90px; border-radius: var(--radius-lg);"></div>
				{/each}
			</div>
		{:else if documents.length === 0}
			<div class="empty-state">
				<div class="empty-icon">📄</div>
				<p>Ingen dokumenter ennå. Bruk "Nytt dokument" for å legge til ditt første.</p>
			</div>
		{:else if filteredDocuments.length === 0}
			<div class="empty-state">
				<div class="empty-icon">🔍</div>
				<p>Ingen dokumenter samsvarer med søket ditt. Prøv å endre filtrene.</p>
			</div>
		{:else}
			<div class="doc-list">
				{#each filteredDocuments as doc}
					<button
						class="doc-item"
						class:active={selectedDoc?.id === doc.id}
						onclick={() => (selectedDoc = selectedDoc?.id === doc.id ? null : doc)}
					>
						<div class="doc-item-top">
							<h3 class="doc-title">{doc.title}</h3>
							<span class="doc-date">{new Date(doc.created_at).toLocaleDateString('nb-NO')}</span>
						</div>
						<div class="doc-meta">
							<span class="badge badge-gray">📁 {doc.collection}</span>
							<span class="badge badge-gray">Trinn {doc.grade}</span>
							<span class="badge badge-gray">{doc.language}</span>
						</div>
						{#if parseTags(doc.tags).length > 0}
							<div class="doc-tags">
								{#each parseTags(doc.tags).slice(0, 4) as tag}
									<span class="badge badge-blue">#{tag}</span>
								{/each}
							</div>
						{/if}
						<p class="doc-preview">{doc.content.substring(0, 120)}{doc.content.length > 120 ? '…' : ''}</p>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- ── Right: detail panel ────────────────────────────────────────────── -->
	{#if selectedDoc}
		<aside class="detail-panel card">
			<div class="detail-header">
				<h2 style="font-size: 1.05rem; margin-bottom: 0; flex: 1;">{selectedDoc.title}</h2>
				<button class="button-ghost button-sm" onclick={() => (selectedDoc = null)} aria-label="Lukk">✕</button>
			</div>
			<div class="detail-meta">
				<span class="badge badge-blue">{selectedDoc.collection}</span>
				<span class="badge badge-gray">Trinn {selectedDoc.grade}</span>
				<span class="badge badge-gray">{selectedDoc.language}</span>
			</div>
			{#if parseTags(selectedDoc.tags).length > 0}
				<div class="detail-tags">
					{#each parseTags(selectedDoc.tags) as tag}
						<span class="badge badge-blue">#{tag}</span>
					{/each}
				</div>
			{/if}
			<p style="font-size: 0.75rem; color: var(--color-text-muted); margin: 0.75rem 0;">
				Opprettet {new Date(selectedDoc.created_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })}
			</p>
			<hr style="border: none; border-top: 1px solid var(--color-border); margin: 0.75rem 0;" />
			<div class="detail-content">
				<pre>{selectedDoc.content}</pre>
			</div>
		</aside>
	{/if}
</div>

<style>
	.bank-layout {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 1.25rem;
		align-items: start;
	}

	.bank-main {
		min-width: 0;
	}

	/* Filters */
	.filter-row {
		display: flex;
		gap: 0.625rem;
		flex-wrap: wrap;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.search-wrap {
		position: relative;
		flex: 1;
		min-width: 200px;
	}
	.search-icon {
		position: absolute;
		left: 0.625rem;
		top: 50%;
		transform: translateY(-50%);
		opacity: 0.4;
		pointer-events: none;
	}
	.search-input {
		padding-left: 2rem;
	}

	.filter-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	/* Document list */
	.doc-skeleton-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.doc-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.doc-item {
		background: white;
		border: 2px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: 1rem;
		text-align: left;
		cursor: pointer;
		transition: border-color 0.15s, box-shadow 0.15s;
		width: 100%;
		display: block;
		color: var(--color-text);
		font-weight: normal;
		box-shadow: var(--shadow-xs);
	}
	.doc-item:hover {
		border-color: var(--color-primary-mid);
		box-shadow: var(--shadow-sm);
		background: white;
	}
	.doc-item.active {
		border-color: var(--color-primary);
		background: var(--color-primary-light);
	}

	.doc-item-top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 0.5rem;
	}
	.doc-title {
		font-size: 0.95rem;
		font-weight: 600;
		margin-bottom: 0;
		color: var(--color-text);
	}
	.doc-date {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		white-space: nowrap;
		margin-left: 0.5rem;
	}

	.doc-meta {
		display: flex;
		gap: 0.375rem;
		flex-wrap: wrap;
		margin-bottom: 0.375rem;
	}
	.doc-tags {
		display: flex;
		gap: 0.3rem;
		flex-wrap: wrap;
		margin-bottom: 0.375rem;
	}
	.doc-preview {
		font-size: 0.8rem;
		color: var(--color-text-light);
		line-height: 1.5;
		margin-top: 0.375rem;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	/* Detail panel */
	.detail-panel {
		width: 340px;
		position: sticky;
		top: 72px;
		max-height: calc(100vh - 90px);
		overflow-y: auto;
	}

	.detail-header {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}
	.detail-meta {
		display: flex;
		gap: 0.375rem;
		flex-wrap: wrap;
		margin-bottom: 0.5rem;
	}
	.detail-tags {
		display: flex;
		gap: 0.3rem;
		flex-wrap: wrap;
		margin-bottom: 0.25rem;
	}
	.detail-content pre {
		font-family: inherit;
		font-size: 0.875rem;
		line-height: 1.7;
		white-space: pre-wrap;
		word-break: break-word;
		color: var(--color-text);
	}

	@media (max-width: 900px) {
		.bank-layout {
			grid-template-columns: 1fr;
		}
		.detail-panel {
			width: 100%;
			position: static;
			max-height: none;
		}
	}

	@media (max-width: 640px) {
		.filter-row {
			flex-direction: column;
			align-items: stretch;
		}
		.filter-row select {
			width: 100% !important;
		}
	}
</style>
