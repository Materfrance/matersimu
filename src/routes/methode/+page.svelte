<script lang="ts">
	import { DEFAULTS, INCLINAISONS, ORIENTATIONS, SCENARIOS, buildScenarios, fmt, fmtBatterie, fmtKwc } from '#lib/simulation.ts';

	// Exemple chiffré, calculé avec la même fonction que le simulateur
	const exConso = 6000;
	const exY = 1160;
	const [exSans, exAvec] = buildScenarios(exConso, exY, Array(12).fill(exY / 12));
	const sb = SCENARIOS.sansBatterie;
	const ab = SCENARIOS.avecBatterie;

	const azimut = (a: number) => (a === 0 ? '0°' : a === 180 ? '180°' : `${a > 0 ? '+' : '−'}${Math.abs(a)}°`);

	const fixes = [
		{ label: 'Raccordement', value: 'Raccordé au réseau', api: 'PVcalc (grid-connected)' },
		{ label: 'Technologie des modules', value: 'Silicium cristallin', api: `pvtechchoice=${DEFAULTS.pvtechchoice}` },
		{ label: 'Pertes système', value: `${DEFAULTS.loss} %`, api: `loss=${DEFAULTS.loss}` },
		{ label: 'Type de pose', value: `${DEFAULTS.mountingLabel} (modules ventilés)`, api: `mountingplace=${DEFAULTS.mountingplace}` },
		{ label: "Données d'ensoleillement", value: 'Satellite SARAH-3, moyenne pluriannuelle', api: `raddatabase=${DEFAULTS.raddatabase}` },
		{ label: 'Relief / horizon lointain', value: 'Pris en compte automatiquement', api: 'usehorizon=1 (défaut)' },
		{ label: 'Puissance simulée', value: '1 kWc (référence, voir plus bas)', api: 'peakpower=1' },
		{ label: 'Version du service', value: 'PVGIS 5.3', api: 'api/v5_3' }
	];
</script>

<svelte:head>
	<title>Détail du calcul — Simulateur MaterFrance</title>
	<meta name="description" content="Méthode de calcul et paramètres utilisés par le simulateur de production photovoltaïque MaterFrance (données PVGIS)." />
</svelte:head>

<main class="wrap">
	<section class="intro">
		<h1>Détail du calcul</h1>
		<p>
			Le simulateur s'appuie sur <strong>PVGIS</strong> (Photovoltaic Geographical Information System), l'outil de référence du Centre commun de
			recherche de la Commission européenne. Voici exactement ce qui est envoyé à PVGIS et comment les résultats sont obtenus.
		</p>
	</section>

	<section class="card">
		<h2>Paramètres fixes</h2>
		<p class="muted">Identiques pour toutes les simulations : ils correspondent aux installations proposées par MaterFrance.</p>
		<div class="table-wrap">
			<table>
				<thead>
					<tr><th>Paramètre</th><th>Valeur</th><th>Paramètre PVGIS</th></tr>
				</thead>
				<tbody>
					{#each fixes as f (f.label)}
						<tr><td>{f.label}</td><td><strong>{f.value}</strong></td><td><code>{f.api}</code></td></tr>
					{/each}
				</tbody>
			</table>
		</div>
		<h3>Que recouvrent les {DEFAULTS.loss} % de pertes système&nbsp;?</h3>
		<p>
			C'est la valeur recommandée par PVGIS pour une installation standard. Elle regroupe les pertes dans les câbles, le rendement de
			l'onduleur, l'encrassement des modules et les écarts entre modules. Les pertes liées à la température
			et à l'angle du soleil sont calculées <em>en plus</em> par PVGIS (voir plus bas).
		</p>
	</section>

	<section class="card">
		<h2>Paramètres que vous choisissez</h2>
		<div class="table-wrap">
			<table>
				<thead>
					<tr><th>Paramètre</th><th>Valeurs possibles</th><th>Paramètre PVGIS</th></tr>
				</thead>
				<tbody>
					<tr>
						<td>Localisation</td>
						<td>Adresse, position GPS ou point placé sur la carte</td>
						<td><code>lat</code>, <code>lon</code></td>
					</tr>
					<tr>
						<td>Consommation annuelle</td>
						<td>De {fmt(DEFAULTS.minConso)} à {fmt(DEFAULTS.maxConso)} kWh/an</td>
						<td>— (sert au dimensionnement)</td>
					</tr>
					<tr>
						<td>Orientation</td>
						<td>8 orientations, converties en azimut (tableau ci-dessous)</td>
						<td><code>aspect</code></td>
					</tr>
					<tr>
						<td>Inclinaison</td>
						<td>De 0° (à plat) à 90° (vertical)</td>
						<td><code>angle</code></td>
					</tr>
				</tbody>
			</table>
		</div>

		<div class="two">
			<div>
				<h3>Orientation</h3>
				<p class="muted small">PVGIS mesure l'azimut à partir du Sud : 0° = Sud, +90° = Ouest, −90° = Est, 180° = Nord.</p>
				<table class="compact">
					<thead><tr><th>Orientation</th><th>Azimut</th></tr></thead>
					<tbody>
						{#each ORIENTATIONS as o (o.label)}
							<tr><td>{o.label}</td><td><code>{azimut(o.aspect)}</code></td></tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div>
				<h3>Inclinaisons proposées</h3>
				<p class="muted small">L'option « Autre » permet de saisir n'importe quel angle entre 0 et 90°.</p>
				<table class="compact">
					<thead><tr><th>Choix</th><th>Angle</th></tr></thead>
					<tbody>
						{#each INCLINAISONS as i (i.angle)}
							<tr><td>{i.label.replace(/\s*\(\d+°\)/, '')}</td><td><code>{i.angle}°</code></td></tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</section>

	<section class="card">
		<h2>Comment la production est calculée</h2>
		<ol class="steps">
			<li>
				<strong>Ensoleillement du site.</strong> PVGIS utilise des mesures satellitaires heure par heure sur de nombreuses années
				pour votre point exact, ainsi que la température ambiante.
			</li>
			<li>
				<strong>Ensoleillement sur les panneaux.</strong> Cet ensoleillement est projeté sur le plan de vos modules selon
				l'orientation et l'inclinaison choisies, en tenant compte des montagnes ou collines à l'horizon. On obtient l'irradiation
				annuelle sur les panneaux, notée <em>H(i)</em>, en kWh/m².
			</li>
			<li>
				<strong>Conversion en électricité.</strong> Le modèle silicium cristallin de PVGIS calcule, heure par heure, la perte de
				rendement quand les modules chauffent ou que la lumière est faible, et la part de lumière réfléchie quand le soleil est
				rasant.
			</li>
			<li>
				<strong>Pertes système.</strong> Les {DEFAULTS.loss} % de pertes système sont ensuite appliqués.
			</li>
			<li>
				<strong>Moyennes.</strong> Les résultats sont moyennés sur toutes les années disponibles pour obtenir une production
				mensuelle et annuelle typique.
			</li>
		</ol>

		<div class="formula">
			<p class="f">
				Production annuelle&nbsp;(kWh) = Puissance crête&nbsp;(kWc) × <em>H(i)</em>&nbsp;(kWh/m²) ÷ 1&nbsp;kW/m² × (1 − pertes totales)
			</p>
			<p class="muted small">
				1 kW/m² est l'ensoleillement de référence auquel la puissance crête des modules est mesurée. Les « pertes totales » combinent
				l'angle d'incidence, la température et l'éclairement, et les {DEFAULTS.loss} % de pertes système : elles se situent
				généralement entre 18 et 25 %.
			</p>
		</div>

		<h3>Exemple</h3>
		<p>
			1 kWc orienté Sud, incliné à 30°, avec une irradiation sur les panneaux de 1&nbsp;450 kWh/m² et 20 % de pertes totales :<br />
			<strong>1 × 1&nbsp;450 × (1 − 0,20) ≈ {fmt(exY)} kWh/an</strong>. C'est la production de votre toit par kWc installé.
		</p>
	</section>

	<section class="card">
		<h2>Comment nous dimensionnons votre installation</h2>
		<p>
			À partir de votre consommation annuelle, le simulateur calcule <strong>deux installations</strong>. La production étant
			proportionnelle à la puissance installée, PVGIS simule d'abord 1&nbsp;kWc sur votre toit&nbsp;: on obtient la production
			par kWc, puis la puissance nécessaire pour chaque scénario.
		</p>

		<div class="two">
			<div class="sc sans">
				<h3>Sans batterie : {fmt(sb.taux * 100)}&nbsp;% de votre consommation</h3>
				<p>
					Sans stockage, vous ne profitez que de l'électricité consommée au moment où les panneaux produisent, c'est-à-dire en
					journée. On vise donc une production égale à {fmt(sb.taux * 100)}&nbsp;% de votre consommation annuelle, ce qui
					équivaut à votre consommation en journée.
				</p>
				<p class="f">Puissance = consommation × {fmt(sb.taux, 2)} ÷ production par kWc</p>
			</div>
			<div class="sc avec">
				<h3>Avec batterie : 100&nbsp;% de votre consommation</h3>
				<p>
					La batterie stocke l'énergie produite en journée pour la restituer le soir et la nuit. On vise donc une production
					égale à la totalité de votre consommation annuelle.
				</p>
				<p class="f">Puissance = consommation ÷ production par kWc</p>
				<p class="f">
					Batterie = {fmt(ab.batterieRatio[0], 1)} à {fmt(ab.batterieRatio[1])} × puissance du kit (en kWh), minimum
					{fmt(ab.batterieMin)}&nbsp;kWh
				</p>
			</div>
		</div>

		<h3>Exemple</h3>
		<p>Consommation de {fmt(exConso)} kWh/an, toit produisant {fmt(exY)} kWh par kWc :</p>
		<ul>
			<li>
				<strong>Sans batterie</strong> : {fmt(exConso)} × {fmt(sb.taux, 2)} ÷ {fmt(exY)} ≈ <strong>{fmtKwc(exSans.puissance)} kWc</strong>,
				soit {fmt(exSans.annuel)} kWh/an ({fmt(exSans.couverture * 100)}&nbsp;% de la consommation).
			</li>
			<li>
				<strong>Avec batterie</strong> : {fmt(exConso)} ÷ {fmt(exY)} ≈ <strong>{fmtKwc(exAvec.puissance)} kWc</strong>,
				soit {fmt(exAvec.annuel)} kWh/an, avec une batterie de
				<strong>{fmtBatterie(exAvec.batterie!)}</strong>.
			</li>
		</ul>
	</section>

	<section class="card">
		<h2>Les résultats affichés</h2>
		<dl>
			<dt>Puissance conseillée (kWc)</dt>
			<dd>Puissance crête de l'installation pour chaque scénario, calculée comme ci-dessus.</dd>
			<dt>Production estimée (kWh/an)</dt>
			<dd>Énergie électrique produite en moyenne sur une année par cette installation.</dd>
			<dt>Part de votre consommation</dt>
			<dd>Production annuelle divisée par votre consommation annuelle.: {fmt(sb.taux * 100)}&nbsp;% sans batterie, 100&nbsp;% avec batterie.</dd>
			<dt>Batterie conseillée (kWh)</dt>
			<dd>Capacité de stockage recommandée pour le scénario avec batterie.</dd>
			<dt>Production de votre toit (kWh/kWc)</dt>
			<dd>Production annuelle d'1 kWc installé sur votre toit. Elle dépend de la région, de l'orientation et de l'inclinaison.</dd>
			<dt>Production mois par mois (kWh)</dt>
			<dd>Répartition moyenne de la production sur l'année, pour les deux scénarios.</dd>
		</dl>
	</section>

	<section class="card">
		<h2>Ce que l'estimation ne prend pas en compte</h2>
		<ul>
			<li>Les ombrages proches : arbres, cheminées, bâtiments voisins, lucarnes.</li>
			<li>La baisse de rendement des modules au fil des années.</li>
			<li>Vos habitudes de consommation : les {fmt(sb.taux * 100)}&nbsp;% consommés en journée sont une moyenne. Le simulateur ne calcule pas les économies réalisées.</li>
			<li>Les spécificités du matériel : modèle exact de module, d'onduleur ou de micro-onduleur.</li>
		</ul>
		<p class="muted">
			Il s'agit d'une estimation moyenne et indicative, sans valeur contractuelle. Pour une étude détaillée de votre projet, contactez
			un conseiller MaterFrance.
		</p>
		<p class="cta"><a class="btn accent" href="/">Faire une simulation</a></p>
	</section>

	<p class="source">
		Source : <a href="https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis_en" rel="noopener" target="_blank">PVGIS © Union européenne, Centre commun de recherche (JRC)</a>.
	</p>
</main>

<style>
	.intro {
		padding: 40px 0 8px;
	}
	h1 {
		font-size: clamp(1.7rem, 4vw, 2.4rem);
		line-height: 1.2;
		margin: 0 0 10px;
	}
	.intro p {
		color: var(--muted);
		margin: 0;
		max-width: 70ch;
	}
	h2 {
		font-size: 1.2rem;
		margin: 0 0 8px;
	}
	h3 {
		font-size: 1rem;
		margin: 24px 0 6px;
	}
	.muted {
		color: var(--muted);
	}
	.small {
		font-size: 0.85rem;
	}
	.table-wrap {
		overflow-x: auto;
		margin-top: 12px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.92rem;
	}
	th {
		text-align: left;
		font-family: var(--font-title);
		font-weight: 600;
		font-size: 0.8rem;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.03em;
		padding: 8px 12px;
		border-bottom: 2px solid var(--border);
	}
	td {
		padding: 10px 12px;
		border-bottom: 1px solid var(--border);
		vertical-align: top;
	}
	table.compact td {
		padding: 6px 12px;
	}
	code {
		font-size: 0.82rem;
		background: var(--primary-soft);
		color: var(--bleu-dark);
		padding: 2px 6px;
		border-radius: var(--radius);
		white-space: nowrap;
	}
	.two {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 24px;
	}
	.sc {
		border-radius: var(--radius);
		padding: 16px 20px;
	}
	.sc.sans {
		background: var(--jaune-light);
		border: 1px solid var(--jaune-light-active);
	}
	.sc.avec {
		background: var(--primary-soft);
		border: 1px solid var(--bleu-light-active);
	}
	.sc h3 {
		margin-top: 0;
	}
	.sc .f {
		font-family: var(--font-title);
		font-weight: 600;
		color: var(--bleu-darker);
		margin: 8px 0 0;
	}
	.steps {
		padding-left: 0;
		list-style: none;
		counter-reset: step;
		margin: 16px 0;
	}
	.steps li {
		counter-increment: step;
		position: relative;
		padding: 0 0 14px 44px;
	}
	.steps li::before {
		content: counter(step);
		position: absolute;
		left: 0;
		top: 0;
		width: 28px;
		height: 28px;
		display: grid;
		place-items: center;
		background: var(--jaune);
		color: var(--bleu-darker);
		font-family: var(--font-title);
		font-weight: 700;
		font-size: 0.85rem;
	}
	.formula {
		background: var(--jaune-light);
		border: 1px solid var(--jaune-light-active);
		border-radius: var(--radius);
		padding: 16px 20px;
		margin: 8px 0 0;
	}
	.formula .f {
		font-family: var(--font-title);
		font-weight: 600;
		color: var(--bleu-darker);
		margin: 0 0 8px;
	}
	.formula .muted {
		margin: 0;
	}
	dl {
		margin: 12px 0 0;
	}
	dt {
		font-weight: 600;
		margin-top: 12px;
	}
	dd {
		margin: 2px 0 0;
		color: var(--muted);
	}
	ul {
		padding-left: 20px;
	}
	ul li {
		margin-bottom: 6px;
	}
	.cta {
		margin: 20px 0 0;
	}
	.cta .btn {
		text-decoration: none;
	}
	.source {
		font-size: 0.85rem;
		color: var(--muted);
		text-align: center;
	}
	.source a {
		color: var(--primary);
	}
</style>
