<script lang="ts">
	import { onMount } from 'svelte';
	import 'leaflet/dist/leaflet.css';
	import type { Map as LMap, Marker } from 'leaflet';

	let {
		lat = $bindable(),
		lon = $bindable()
	}: { lat: number | null; lon: number | null } = $props();

	let el: HTMLDivElement;
	// $state.raw : l'effet ci-dessous doit se relancer quand la carte est prête
	let map = $state.raw<LMap | undefined>();
	let marker: Marker | undefined;
	let L: typeof import('leaflet') | undefined;

	const FRANCE: [number, number] = [46.6, 2.4];

	onMount(() => {
		let destroyed = false;
		(async () => {
			L = (await import('leaflet')).default;
			if (destroyed) return;

			// Photos aériennes IGN (Géoplateforme, sans clé) : idéal pour viser le toit
			const satellite = L.tileLayer(
				'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
				{ maxZoom: 20, maxNativeZoom: 19, attribution: '© IGN Géoplateforme' }
			);
			const plan = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				attribution: '© OpenStreetMap'
			});

			map = L.map(el, { layers: [satellite], zoomControl: true }).setView(FRANCE, 5);
			L.control.layers({ 'Vue satellite': satellite, Plan: plan }, undefined, { position: 'topright' }).addTo(map);
			map.on('click', (e) => setPoint(e.latlng.lat, e.latlng.lng, false));
		})();
		return () => {
			destroyed = true;
			map?.remove();
		};
	});

	// Quand l'adresse change depuis l'extérieur, on recentre la carte
	$effect(() => {
		// Lire lat/lon AVANT de tester map, sinon Svelte ne les suit pas comme dépendances
		const la = lat;
		const lo = lon;
		if (!map || la == null || lo == null) return;
		const cur = marker?.getLatLng();
		if (!cur || Math.abs(cur.lat - la) > 1e-7 || Math.abs(cur.lng - lo) > 1e-7) placeMarker(la, lo, true);
	});

	function setPoint(la: number, lo: number, fly: boolean) {
		lat = la;
		lon = lo;
		placeMarker(la, lo, fly);
	}

	function placeMarker(la: number, lo: number, fly: boolean) {
		if (!map || !L) return;
		if (!marker) {
			const icon = L.divIcon({ className: 'pin', html: '<span></span>', iconSize: [20, 27], iconAnchor: [10, 27] });
			marker = L.marker([la, lo], { draggable: true, icon }).addTo(map);
			marker.on('dragend', () => {
				const p = marker!.getLatLng();
				lat = p.lat;
				lon = p.lng;
			});
		} else {
			marker.setLatLng([la, lo]);
		}
		if (fly) map.setView([la, lo], 19);
	}
</script>

<div class="map" bind:this={el}></div>
<p class="hint">Cliquez sur votre toit ou déplacez le repère pour affiner la position.</p>

<style>
	.map {
		height: 340px;
		border-radius: var(--radius);
		border: 1px solid var(--border);
		overflow: hidden;
		z-index: 0;
	}
	.hint {
		margin: 6px 0 0;
		font-size: 0.85rem;
		color: var(--muted);
	}
	/* Repère carré façon charte : bloc Bleu Mater, bord blanc, pointe vers le toit */
	:global(.pin span) {
		position: relative;
		display: block;
		width: 20px;
		height: 20px;
		background: var(--primary);
		border: 2px solid #fff;
	}
	/* Pointe : triangle blanc, puis triangle bleu à l'intérieur */
	:global(.pin span::before),
	:global(.pin span::after) {
		content: '';
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		width: 0;
		height: 0;
		border-style: solid;
		border-color: transparent;
	}
	:global(.pin span::before) {
		top: calc(100% + 2px);
		border-width: 7px 5px 0;
		border-top-color: #fff;
	}
	:global(.pin span::after) {
		top: calc(100% + 1px);
		border-width: 4px 3px 0;
		border-top-color: var(--primary);
	}
</style>
