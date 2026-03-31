<script lang="ts">
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();

	function isActive(path: string) {
		return page.url.pathname === path || page.url.pathname.startsWith(path + '/');
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<header class="app-header">
	<div class="header-inner">
		<a href="/" class="logo">
			<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
				<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
			</svg>
			Skolebibliotek
		</a>
		<nav class="main-nav" aria-label="Hovednavigasjon">
			<a href="/statistikk" class="nav-link" class:active={isActive('/statistikk')}>Statistikk</a>
			<a href="/planner" class="nav-link" class:active={isActive('/planner')}>Planlegger</a>
			<a href="/bank" class="nav-link" class:active={isActive('/bank')}>Dokumentbank</a>
		</nav>
	</div>
</header>

<main class="app-main">
	{@render children()}
</main>

<style>
	.app-header {
		background: #0f172a;
		position: sticky;
		top: 0;
		z-index: 50;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.header-inner {
		max-width: 1280px;
		margin: 0 auto;
		padding: 0 1.5rem;
		height: 56px;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.logo {
		color: white;
		font-weight: 700;
		font-size: 1.05rem;
		text-decoration: none;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		letter-spacing: -0.01em;
	}
	.logo:hover {
		text-decoration: none;
		opacity: 0.9;
	}

	.main-nav {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.nav-link {
		color: rgba(255, 255, 255, 0.65);
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 500;
		padding: 0.4rem 0.75rem;
		border-radius: 6px;
		transition: color 0.15s, background 0.15s;
	}
	.nav-link:hover {
		color: white;
		background: rgba(255, 255, 255, 0.08);
		text-decoration: none;
	}
	.nav-link.active {
		color: white;
		background: rgba(255, 255, 255, 0.12);
	}

	.app-main {
		max-width: 1280px;
		margin: 0 auto;
		padding: 2rem 1.5rem 4rem;
	}

	@media (max-width: 640px) {
		.header-inner {
			padding: 0 1rem;
		}
		.nav-link {
			padding: 0.35rem 0.5rem;
			font-size: 0.82rem;
		}
		.app-main {
			padding: 1.25rem 1rem 3rem;
		}
	}
</style>
