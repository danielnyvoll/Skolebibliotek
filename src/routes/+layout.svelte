<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<nav style="background:#1a56db;padding:0.6rem 1.5rem;display:flex;gap:1.5rem;align-items:center;">
	<a href="/" style="color:#fff;font-weight:700;font-size:1.1rem;text-decoration:none;">Skolebibliotek</a>
	<a href="/planner" style="color:#e0eaff;text-decoration:none;">Planlegger</a>
	<a href="/bank" style="color:#e0eaff;text-decoration:none;">Dokumentbank</a>
	<a href="/hjelp" style="color:#e0eaff;text-decoration:none;">Hjelp</a>
</nav>

{@render children()}
