<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<nav style="background: var(--color-primary); padding: var(--spacing-md) var(--spacing-lg); display: flex; gap: var(--spacing-lg); align-items: center;">
	<a href="/" style="color: white; font-weight: 700; font-size: 1.1rem; text-decoration: none;">Skolebibliotek</a>
	<a href="/planner" style="color: var(--color-primary-light); text-decoration: none; font-weight: 500;">Planlegger</a>
	<a href="/bank" style="color: var(--color-primary-light); text-decoration: none; font-weight: 500;">Dokumentbank</a>
	<a href="/statistikk" style="color: var(--color-primary-light); text-decoration: none; font-weight: 500;">Statistikk</a>
</nav>

<main style="padding: var(--spacing-xl) var(--spacing-lg); max-width: 1200px; margin: 0 auto;">
	{@render children()}
</main>
