<script lang="ts">
	// Autocomplétion d'adresse via le géocodeur IGN Géoplateforme (ex-API Adresse, gratuit, sans clé).
	const GEOCODER = 'https://data.geopf.fr/geocodage/search';

	type Suggestion = { label: string; lat: number; lon: number };

	let { onselect }: { onselect: (s: Suggestion) => void } = $props();

	let query = $state('');
	let suggestions = $state<Suggestion[]>([]);
	let open = $state(false);
	let active = $state(-1);
	let loading = $state(false);
	let timer: ReturnType<typeof setTimeout>;
	let controller: AbortController | undefined;

	function oninput() {
		clearTimeout(timer);
		if (query.trim().length < 3) {
			suggestions = [];
			open = false;
			return;
		}
		timer = setTimeout(search, 250);
	}

	async function search() {
		controller?.abort();
		controller = new AbortController();
		loading = true;
		try {
			const url = `${GEOCODER}?q=${encodeURIComponent(query)}&autocomplete=1&limit=6&index=address`;
			const res = await fetch(url, { signal: controller.signal });
			const data = await res.json();
			// Le géocodeur peut renvoyer plusieurs résultats au libellé identique (ex. « Paris 31560 Saint-Léon ») :
			// on ne garde que le premier, le mieux classé.
			const seen = new Set<string>();
			suggestions = (data.features ?? [])
				.map((f: any) => ({
					label: f.properties.label as string,
					lon: f.geometry.coordinates[0] as number,
					lat: f.geometry.coordinates[1] as number
				}))
				.filter((s: Suggestion) => !seen.has(s.label) && seen.add(s.label));
			open = suggestions.length > 0;
			active = -1;
		} catch (e) {
			if ((e as Error).name !== 'AbortError') suggestions = [];
		} finally {
			loading = false;
		}
	}

	// --- Bouton « Utiliser ma position » (GPS du navigateur, HTTPS requis) ---
	let locating = $state(false);
	let geoError = $state('');

	function locate() {
		geoError = '';
		if (!('geolocation' in navigator)) {
			geoError = "La géolocalisation n'est pas disponible sur ce navigateur.";
			return;
		}
		locating = true;
		navigator.geolocation.getCurrentPosition(
			async ({ coords }) => {
				const lat = coords.latitude;
				const lon = coords.longitude;
				let label = `Position GPS (${lat.toFixed(5)}, ${lon.toFixed(5)})`;
				try {
					const res = await fetch(`${GEOCODER.replace('/search', '/reverse')}?lat=${lat}&lon=${lon}&index=address&limit=1`);
					const f = (await res.json()).features?.[0];
					if (f) label = f.properties.label;
				} catch {
					/* adresse inconnue : on garde les coordonnées */
				}
				locating = false;
				choose({ label, lat, lon });
			},
			(err) => {
				locating = false;
				geoError =
					err.code === err.PERMISSION_DENIED
						? 'Autorisez la localisation dans votre navigateur, ou saisissez votre adresse.'
						: 'Position introuvable, saisissez votre adresse.';
			},
			{ enableHighAccuracy: true, timeout: 10_000 }
		);
	}

	function choose(s: Suggestion) {
		query = s.label;
		open = false;
		onselect(s);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') e.preventDefault(); // ne jamais soumettre le formulaire depuis ce champ
		if (!open) return;
		if (e.key === 'ArrowDown') {
			active = (active + 1) % suggestions.length;
			e.preventDefault();
		} else if (e.key === 'ArrowUp') {
			active = (active - 1 + suggestions.length) % suggestions.length;
			e.preventDefault();
		} else if (e.key === 'Enter' && suggestions.length) {
			// Entrée sans flèche → première suggestion
			choose(suggestions[Math.max(active, 0)]);
			e.preventDefault();
		} else if (e.key === 'Escape') {
			open = false;
		}
	}
</script>

<div class="row">
<div class="search">
	<input
		type="search"
		placeholder="Ex. 12 rue de la République, 69002 Lyon"
		autocomplete="off"
		role="combobox"
		aria-expanded={open}
		aria-controls="adresse-liste"
		id="adr"
		bind:value={query}
		{oninput}
		{onkeydown}
		onblur={() => setTimeout(() => (open = false), 150)}
	/>
	{#if loading}<span class="spinner" aria-hidden="true"></span>{/if}
	{#if open}
		<ul id="adresse-liste" role="listbox">
			{#each suggestions as s, i (`${s.label}|${s.lat}|${s.lon}`)}
				<li role="option" aria-selected={i === active}>
					<button type="button" class:active={i === active} onmousedown={() => choose(s)}>{s.label}</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
	<button type="button" class="locate" onclick={locate} disabled={locating}>
		{locating ? 'Localisation…' : 'Utiliser ma position'}
	</button>
</div>
{#if geoError}<p class="geo-err" role="alert">{geoError}</p>{/if}

<style>
	.row {
		display: flex;
		gap: 8px;
	}
	.search {
		position: relative;
		flex: 1;
	}
	.locate {
		flex: none;
		height: 48px;
		padding: 0 18px;
		border: 2px solid var(--jaune);
		border-radius: var(--radius-control);
		background: var(--surface);
		color: var(--bleu-darker);
		font-family: var(--font-title);
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
		transition: box-shadow 0.15s, background 0.15s;
	}
	.locate:hover:not(:disabled) {
		box-shadow: -5px 5px 0 0 var(--jaune);
	}
	.locate:active:not(:disabled) {
		background: var(--jaune);
		box-shadow: none;
	}
	.locate:disabled {
		opacity: 0.6;
		cursor: wait;
	}
	.geo-err {
		color: var(--danger);
		font-size: 0.85rem;
		margin: 6px 0 0;
	}
	@media (max-width: 520px) {
		.row {
			flex-direction: column;
		}
	}
	input {
		width: 100%;
	}
	ul {
		position: absolute;
		z-index: 1000;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		margin: 0;
		padding: 4px;
		list-style: none;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.12);
	}
	li button {
		all: unset;
		box-sizing: border-box;
		display: block;
		width: 100%;
		padding: 8px 10px;
		border-radius: var(--radius);
		cursor: pointer;
	}
	li button:hover,
	li button.active {
		background: var(--primary-soft);
	}
	.spinner {
		position: absolute;
		right: 12px;
		top: 50%;
		width: 14px;
		height: 14px;
		margin-top: -7px;
		border: 2px solid var(--border);
		border-top-color: var(--primary);
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
