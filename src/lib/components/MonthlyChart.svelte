<script lang="ts">
	import { MOIS, fmt, niceScale } from '#lib/simulation.ts';

	type Serie = { label: string; color: string; values: number[] };
	let { series }: { series: Serie[] } = $props();

	const W = 640, H = 250, padL = 44, padB = 24, padT = 26;
	const plotH = H - padB - padT;
	const step = (W - padL) / 12;
	const gap = 2;

	const barW = $derived((step * 0.7 - gap * (series.length - 1)) / series.length);
	// Marge en haut pour les valeurs écrites au-dessus des barres
	const scale = $derived(niceScale(Math.max(...series.flatMap((s) => s.values)) * 1.18));
	const max = $derived(scale.max);
	const ticks = $derived(scale.ticks);
	let hover = $state<number | null>(null);

	const y = (v: number) => padT + plotH - (v / max) * plotH;
	const groupX = (i: number) => padL + i * step + (step - (barW * series.length + gap * (series.length - 1))) / 2;
</script>

<div class="legend">
	{#each series as s (s.label)}
		<span><i style="background:{s.color}"></i>{s.label}</span>
	{/each}
</div>

<div class="chart">
<svg viewBox="0 0 {W} {H}" role="img" aria-label="Production mensuelle estimée en kWh">
	{#each ticks as t (t)}
		<line x1={padL} x2={W} y1={y(t)} y2={y(t)} class="grid" />
		<text x={padL - 8} y={y(t) + 4} text-anchor="end" class="axis">{fmt(t)}</text>
	{/each}
	{#each MOIS as mois, i (i)}
		<g role="presentation" onmouseenter={() => (hover = i)} onmouseleave={() => (hover = null)}>
			<rect x={padL + i * step} y={padT} width={step} height={plotH} fill="transparent" />
			{#each series as s, k (s.label)}
				{@const x = groupX(i) + k * (barW + gap)}
				<rect
					{x}
					y={y(s.values[i])}
					width={barW}
					height={plotH - (y(s.values[i]) - padT)}
					fill={s.color}
					class="bar"
					class:dim={hover !== null && hover !== i}
				/>
				<text
					class="bar-value"
					x={x + barW / 2 + 3.5}
					y={y(s.values[i]) - 4}
					transform="rotate(-90 {x + barW / 2 + 3.5} {y(s.values[i]) - 4})"
				>{fmt(s.values[i])}</text>
			{/each}
			<text x={padL + i * step + step / 2} y={H - 6} text-anchor="middle" class="axis">{mois}</text>
		</g>
	{/each}
</svg>

<!-- Infobulle au survol : un carré de la couleur de chaque série devant sa valeur -->
{#if hover !== null}
	{@const i = hover}
	<div
		class="tooltip"
		class:start={i < 2}
		class:end={i > 9}
		style="left:{((i < 2 ? padL + i * step : i > 9 ? padL + (i + 1) * step : padL + i * step + step / 2) / W) * 100}%"
		role="status"
	>
		<span class="tt-month">{MOIS[i]}</span>
		{#each series as s (s.label)}
			<span class="tt-row"><i style="background:{s.color}"></i>{fmt(s.values[i])} kWh</span>
		{/each}
	</div>
{/if}
</div>

<style>
	svg {
		width: 100%;
		height: auto;
		display: block;
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 18px;
		font-size: 0.85rem;
		color: var(--muted);
		margin-bottom: 4px;
	}
	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.legend i {
		width: 12px;
		height: 12px;
		display: inline-block;
	}
	.grid {
		stroke: var(--border);
		stroke-width: 1;
	}
	.axis {
		font-size: 11px;
		fill: var(--muted);
	}
	.chart {
		position: relative;
	}
	.tooltip {
		position: absolute;
		top: 0;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 4px 10px;
		background: var(--surface);
		border: 1px solid var(--border);
		box-shadow: 0 2px 8px rgb(22 29 62 / 0.12);
		font-size: 0.8rem;
		font-weight: 600;
		white-space: nowrap;
		pointer-events: none;
		font-variant-numeric: tabular-nums;
	}
	.tooltip.start {
		transform: none;
	}
	.tooltip.end {
		transform: translateX(-100%);
	}
	.tt-month {
		color: var(--muted);
		font-weight: 500;
	}
	.tt-row {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.tt-row i {
		width: 10px;
		height: 10px;
		display: inline-block;
	}
	.bar {
		transition: opacity 0.15s;
	}
	.bar-value {
		font-size: 10px;
		font-weight: 600;
		fill: var(--text);
		pointer-events: none;
	}
	/* Sur petit écran, les valeurs deviennent illisibles : on garde l'infobulle au survol / toucher */
	@media (max-width: 520px) {
		.bar-value {
			display: none;
		}
	}
	.bar.dim {
		opacity: 0.4;
	}
</style>
