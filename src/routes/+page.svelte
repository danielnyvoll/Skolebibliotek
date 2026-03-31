<svelte:head>
	<title>Skolebibliotek – Planlegging og statistikk for lærere</title>
</svelte:head>

<!-- ── Hero ─────────────────────────────────────────────────────────────────── -->
<section class="hero">
	<div class="hero-text">
		<div class="hero-badge">Elevundersøkelsen · Planlegger · Dokumentbank</div>
		<h1 class="hero-title">Planlegging og statistikk<br />for norske lærere</h1>
		<p class="hero-desc">
			Skolebibliotek samler Udir-statistikk, ukeplaner og læremidler på ett sted — slik at du kan
			bruke mer tid på elevene og mindre tid på verktøy.
		</p>
		<div class="hero-actions">
			<a href="/statistikk" class="btn-primary">Se statistikk →</a>
			<a href="/planner" class="btn-outline">Åpne planlegger</a>
		</div>
	</div>
	<div class="hero-visual" aria-hidden="true">
		<img src="/icons/hero.svg" alt="" width="480" height="320" />
	</div>
</section>

<!-- ── Features ──────────────────────────────────────────────────────────────── -->
<section class="features-section">
	<h2 class="features-heading">Hva kan du gjøre?</h2>
	<div class="features-grid">
		<a href="/statistikk" class="feature-card">
			<div class="feature-icon" style="background:#eff6ff; color:#1a56db;">
				<img src="/icons/chart.svg" alt="" width="28" height="28" />
			</div>
			<h3>Statistikk</h3>
			<p>
				Utforsk resultater fra Elevundersøkelsen for ditt fylke, kommune eller skole. Se trender
				over år og sammenlign indikatorer.
			</p>
			<span class="feature-link">Gå til statistikk →</span>
		</a>

		<a href="/planner" class="feature-card">
			<div class="feature-icon" style="background:#f0fdf4; color:#059669;">
				<img src="/icons/calendar.svg" alt="" width="28" height="28" />
			</div>
			<h3>Planlegger</h3>
			<p>
				Bygg ukeplaner og leksjonssekvenser med veiviseren. Knytt kompetansemål til hver økt og
				lagre planer i nettleseren.
			</p>
			<span class="feature-link">Åpne planlegger →</span>
		</a>

		<a href="/bank" class="feature-card">
			<div class="feature-icon" style="background:#fff7ed; color:#d97706;">
				<img src="/icons/folder.svg" alt="" width="28" height="28" />
			</div>
			<h3>Dokumentbank</h3>
			<p>
				Søk i og lagre læreplaner, kompetansemål og undervisningsmateriell. Filtrer på trinn, fag
				og språk.
			</p>
			<span class="feature-link">Til dokumentbanken →</span>
		</a>
	</div>
</section>

<!-- ── Updates ────────────────────────────────────────────────────────────────── -->
<section class="updates-section">
	<div class="updates-panel card">
		<h2 style="font-size: 1.1rem; margin-bottom: 1rem;">Siste oppdateringer</h2>
		<ul class="updates-list">
			<li>
				<span class="update-dot dot-blue"></span>
				<div>
					<strong>Statistikk-dashboard</strong>
					<span class="update-meta">KPI-kort og ny tabellvelger for Elevundersøkelsen</span>
				</div>
				<time class="update-date">I dag</time>
			</li>
			<li>
				<span class="update-dot dot-green"></span>
				<div>
					<strong>Planlegger-veiviser</strong>
					<span class="update-meta">Bygg leksjonsplaner med fag, mål og økter</span>
				</div>
				<time class="update-date">I dag</time>
			</li>
			<li>
				<span class="update-dot dot-yellow"></span>
				<div>
					<strong>Dokumentbank</strong>
					<span class="update-meta">Filtrering på trinn, fag og språk</span>
				</div>
				<time class="update-date">I dag</time>
			</li>
			<li style="opacity: 0.5;">
				<span class="update-dot dot-gray"></span>
				<div>
					<strong>GREP-integrasjon</strong>
					<span class="update-meta">Nasjonal læreplanbase — planlegges</span>
				</div>
				<time class="update-date">Snart</time>
			</li>
		</ul>
	</div>

	<div class="info-panel card">
		<h2 style="font-size: 1.1rem; margin-bottom: 0.75rem;">Om dataene</h2>
		<p style="color: var(--color-text-light); font-size: 0.9rem; line-height: 1.7;">
			Statistikk hentes direkte fra Utdanningsdirektoratets Statistikkbanken-API. Geografidata
			hentes fra NXR Fellestjeneste. Planlegger og dokumentbank lagres i din egen database via
			Supabase.
		</p>
		<div style="margin-top: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
			<span class="badge badge-blue">Elevundersøkelsen</span>
			<span class="badge badge-green">Statistikkbanken</span>
			<span class="badge badge-gray">Supabase</span>
		</div>
	</div>
</section>

<style>
	/* ── Hero ─── */
	.hero {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 3rem;
		align-items: center;
		padding: 3rem 0 3.5rem;
		border-bottom: 1px solid var(--color-border);
		margin-bottom: 3rem;
	}

	.hero-badge {
		display: inline-block;
		background: var(--color-primary-light);
		color: var(--color-primary);
		border: 1px solid var(--color-primary-mid);
		border-radius: 999px;
		font-size: 0.78rem;
		font-weight: 600;
		padding: 0.3rem 0.85rem;
		margin-bottom: 1.25rem;
		letter-spacing: 0.03em;
	}

	.hero-title {
		font-size: 2.5rem;
		font-weight: 800;
		line-height: 1.15;
		letter-spacing: -0.03em;
		margin-bottom: 1rem;
		color: var(--color-text);
	}

	.hero-desc {
		font-size: 1.05rem;
		color: var(--color-text-light);
		max-width: 480px;
		line-height: 1.7;
		margin-bottom: 1.75rem;
	}

	.hero-actions {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.btn-primary {
		display: inline-flex;
		align-items: center;
		padding: 0.65rem 1.5rem;
		background: var(--color-primary);
		color: white;
		border-radius: var(--radius-md);
		font-weight: 600;
		font-size: 0.95rem;
		text-decoration: none;
		transition: background 0.15s, box-shadow 0.15s;
		box-shadow: var(--shadow-sm);
	}
	.btn-primary:hover {
		background: var(--color-primary-hover);
		box-shadow: var(--shadow-md);
		text-decoration: none;
	}

	.btn-outline {
		display: inline-flex;
		align-items: center;
		padding: 0.65rem 1.5rem;
		background: white;
		color: var(--color-text);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font-weight: 600;
		font-size: 0.95rem;
		text-decoration: none;
		transition: background 0.15s, border-color 0.15s;
	}
	.btn-outline:hover {
		background: var(--color-bg-subtle);
		border-color: var(--color-border-hover);
		text-decoration: none;
	}

	.hero-visual img {
		max-width: 400px;
		width: 100%;
		height: auto;
	}

	/* ── Features ─── */
	.features-section {
		margin-bottom: 3rem;
	}

	.features-heading {
		font-size: 1.375rem;
		margin-bottom: 1.25rem;
	}

	.features-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1.25rem;
	}

	.feature-card {
		background: white;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		padding: 1.5rem;
		text-decoration: none;
		color: inherit;
		transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		box-shadow: var(--shadow-xs);
	}
	.feature-card:hover {
		border-color: var(--color-primary-mid);
		box-shadow: var(--shadow-md);
		transform: translateY(-2px);
		text-decoration: none;
	}

	.feature-icon {
		width: 52px;
		height: 52px;
		border-radius: var(--radius-lg);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.feature-card h3 {
		font-size: 1.05rem;
		margin-bottom: 0;
	}

	.feature-card p {
		color: var(--color-text-light);
		font-size: 0.9rem;
		line-height: 1.6;
		flex: 1;
	}

	.feature-link {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-primary);
		margin-top: auto;
	}

	/* ── Updates ─── */
	.updates-section {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: 1.25rem;
	}

	.updates-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.updates-list li {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: start;
		gap: 0.75rem;
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--color-border);
	}
	.updates-list li:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}

	.update-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		margin-top: 0.3rem;
		flex-shrink: 0;
	}
	.dot-blue {
		background: var(--color-primary);
	}
	.dot-green {
		background: var(--color-success);
	}
	.dot-yellow {
		background: var(--color-warning);
	}
	.dot-gray {
		background: var(--color-text-muted);
	}

	.updates-list strong {
		display: block;
		font-size: 0.9rem;
		margin-bottom: 0.1rem;
	}

	.update-meta {
		display: block;
		font-size: 0.8rem;
		color: var(--color-text-light);
	}

	.update-date {
		font-size: 0.78rem;
		color: var(--color-text-muted);
		white-space: nowrap;
		margin-top: 0.1rem;
	}

	/* ── Responsive ─── */
	@media (max-width: 900px) {
		.hero {
			grid-template-columns: 1fr;
			padding: 2rem 0 2.5rem;
		}
		.hero-visual {
			display: none;
		}
		.features-grid {
			grid-template-columns: 1fr;
		}
		.updates-section {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.hero-title {
			font-size: 1.875rem;
		}
		.features-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
