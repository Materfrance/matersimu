<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
	import logo from '#lib/assets/logo-materfrance.svg';
	import { page } from '$app/state';
	import '../app.css';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const nav = [
		{ href: '/', label: 'Simulateur' }
	];
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="description" content="Estimez gratuitement la production de votre installation photovoltaïque avec les données PVGIS." />
</svelte:head>

<header class="top">
	<div class="wrap">
		<a href="https://www.materfrance.fr" class="logo"><img src={logo} alt="MaterFrance" width="1010" height="200" /></a>
		<span class="tag">Simulateur de production solaire</span>
		<nav aria-label="Navigation principale">
			{#each nav as item (item.href)}
				<a href={item.href} aria-current={page.url.pathname === item.href ? 'page' : undefined}>{item.label}</a>
			{/each}
		</nav>
	</div>
</header>

{@render children()}

<footer class="wrap">
	Données : PVGIS © Union européenne (JRC). Estimation indicative, sans valeur contractuelle ·
	<a href="/methode" target="_blank" rel="noopener">Détail du calcul</a>
</footer>

<style>
	.top {
		background: var(--surface);
		border-bottom: 1px solid var(--border);
	}
	.top .wrap {
		display: flex;
		gap: 20px;
		height: 72px;
		align-items: center;
	}
	.logo {
		display: block;
		line-height: 0;
	}
	.logo img {
		height: 36px;
		width: auto;
	}
	.tag {
		color: var(--muted);
		font-size: 0.9rem;
		padding-left: 20px;
		border-left: 1px solid var(--border);
	}
	nav {
		margin-left: auto;
		display: flex;
		gap: 4px;
	}
	nav a {
		padding: 8px 12px;
		border-radius: var(--radius-control);
		color: var(--text);
		font-family: var(--font-title);
		font-weight: 500;
		font-size: 0.9rem;
		text-decoration: none;
	}
	nav a:hover {
		background: var(--primary-soft);
	}
	nav a[aria-current='page'] {
		color: var(--primary);
		background: var(--primary-soft);
	}
	footer {
		color: var(--muted);
		font-size: 0.8rem;
		text-align: center;
		padding: 24px 16px 40px;
	}
	footer a {
		color: var(--primary);
	}
	@media (max-width: 720px) {
		.tag {
			display: none;
		}
	}
	@media (max-width: 520px) {
		.top .wrap {
			gap: 12px;
		}
		.logo img {
			height: 24px;
		}
		nav a {
			padding: 6px 8px;
			font-size: 0.8rem;
		}
	}
</style>
