<script lang="ts">
	import AddressSearch from '#lib/components/AddressSearch.svelte';
	import MapPicker from '#lib/components/MapPicker.svelte';
	import MonthlyChart from '#lib/components/MonthlyChart.svelte';
	import {
		ORIENTATIONS,
		INCLINAISONS,
		DEFAULTS,
		fmt,
		fmtKwc,
		fmtBatterie,
		FAQ,
		type OrientationLabel,
		type SimulationInput,
		type SimulationResult
	} from '#lib/simulation.ts';

	// --- Formulaire ---
	let adresse = $state<string | undefined>();
	let lat = $state<number | null>(null);
	let lon = $state<number | null>(null);
	let consommation = $state<number | null>(null);
	let orientation = $state<OrientationLabel>('Sud');
	let inclinaisonChoix = $state<number | 'autre'>(30);
	let angleLibre = $state(30);

	const angle = $derived(inclinaisonChoix === 'autre' ? angleLibre : inclinaisonChoix);
	const consoValid = $derived(consommation != null && consommation >= DEFAULTS.minConso && consommation <= DEFAULTS.maxConso);
	const angleValid = $derived(angle >= 0 && angle <= 90);
	const canSubmit = $derived(lat != null && lon != null && consoValid && angleValid);

	const input = $derived<SimulationInput | null>(
		canSubmit
			? { lat: lat!, lon: lon!, adresse, consommation: Number(consommation), orientation, angle: Number(angle) }
			: null
	);

	// --- Résultat ---
	let result = $state<SimulationResult | null>(null);
	let loading = $state(false);
	let errorMsg = $state('');
	const stale = $derived(result != null && JSON.stringify(input) !== JSON.stringify(result.input));

	async function simulate(e: SubmitEvent) {
		e.preventDefault();
		if (!input) return;
		loading = true;
		errorMsg = '';
		mailState = 'idle';
		try {
			const res = await fetch('/api/simulation', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(input)
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message ?? 'Erreur inattendue');
			result = data;
			requestAnimationFrame(() => document.getElementById('resultats')?.scrollIntoView({ behavior: 'smooth' }));
		} catch (err) {
			errorMsg = (err as Error).message;
		} finally {
			loading = false;
		}
	}

	// --- Export PDF ---
	let pdfLoading = $state(false);
	async function downloadPdf() {
		if (!result) return;
		pdfLoading = true;
		try {
			const res = await fetch('/api/pdf', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(result.input)
			});
			if (!res.ok) throw new Error((await res.json()).message);
			const url = URL.createObjectURL(await res.blob());
			const a = Object.assign(document.createElement('a'), { href: url, download: 'etude-production-materfrance.pdf' });
			a.click();
			URL.revokeObjectURL(url);
		} catch (err) {
			errorMsg = (err as Error).message || 'Le PDF n’a pas pu être généré.';
		} finally {
			pdfLoading = false;
		}
	}

	// --- Envoi par e-mail ---
	let nom = $state('');
	let email = $state('');
	let consentement = $state(false);
	let website = $state(''); // piège anti-bot
	let mailState = $state<'idle' | 'sending' | 'sent' | 'error'>('idle');
	let mailError = $state('');

	async function sendMail(e: SubmitEvent) {
		e.preventDefault();
		if (!result) return;
		mailState = 'sending';
		try {
			const res = await fetch('/api/email', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ simulation: result.input, nom, email, consentement, website })
			});
			if (!res.ok) throw new Error((await res.json()).message);
			mailState = 'sent';
		} catch (err) {
			mailError = (err as Error).message || 'Envoi impossible.';
			mailState = 'error';
		}
	}
</script>

<svelte:head>
	<title>Simulateur de production solaire — MaterFrance</title>
</svelte:head>

<main class="wrap">
	<section class="intro">
		<h1>Combien produira votre <em>installation photovoltaïque</em>&nbsp;?</h1>
		<p>Estimation gratuite basée sur les données d'ensoleillement européennes PVGIS, pour une installation raccordée au réseau en silicium cristallin.</p>
	</section>

	<form class="card" onsubmit={simulate}>
		<div class="step">
			<h2><span>1</span> Localisation</h2>
			<label for="adr">Adresse de l'installation</label>
			<AddressSearch
				onselect={(s) => {
					adresse = s.label;
					lat = s.lat;
					lon = s.lon;
				}}
			/>
			<div class="mapbox">
				<MapPicker bind:lat bind:lon />
			</div>
			{#if lat != null && lon != null}
				<p class="coords">Position retenue : {lat.toFixed(5)}, {lon.toFixed(5)}</p>
			{/if}
		</div>

		<div class="step">
			<h2><span>2</span> Votre consommation</h2>
			<div class="conso">
				<label for="conso">Consommation électrique annuelle</label>
				<div class="unit">
					<input
						id="conso"
						type="number"
						inputmode="numeric"
						min={DEFAULTS.minConso}
						max={DEFAULTS.maxConso}
						step="1"
						placeholder="Ex. 6000"
						aria-invalid={consommation != null && !consoValid}
						aria-describedby="conso-aide"
						bind:value={consommation}
					/>
					<span>kWh/an</span>
				</div>
				<p id="conso-aide" class="hint">
					Elle figure sur votre facture d'électricité annuelle ou dans votre espace client fournisseur.
				</p>
				{#if consommation != null && !consoValid}
					<p class="err">Entre {fmt(DEFAULTS.minConso)} et {fmt(DEFAULTS.maxConso)} kWh/an.</p>
				{/if}
			</div>
		</div>

		<div class="step">
			<h2><span>3</span> Votre toiture</h2>
			<div class="grid">
				<div>
					<label for="orientation">Orientation de votre toiture</label>
					<select id="orientation" bind:value={orientation}>
						{#each ORIENTATIONS as o (o.label)}
							<option value={o.label}>{o.label}</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="incl">Inclinaison</label>
					<select id="incl" bind:value={inclinaisonChoix}>
						{#each INCLINAISONS as i (i.angle)}
							<option value={i.angle}>{i.label}</option>
						{/each}
						<option value="autre">Autre (préciser)</option>
					</select>
					{#if inclinaisonChoix === 'autre'}
						<input class="mt" type="number" min="0" max="90" step="1" bind:value={angleLibre} aria-invalid={!angleValid} aria-label="Inclinaison en degrés" />
						{#if !angleValid}<p class="err">Entre 0 et 90°.</p>{/if}
					{/if}
				</div>
			</div>
		</div>

		<div class="submit">
			{#if lat == null}<span class="muted">Indiquez d'abord votre adresse.</span>
			{:else if !consoValid}<span class="muted">Indiquez votre consommation annuelle.</span>{/if}
			<button class="btn accent" type="submit" disabled={!canSubmit || loading}>
				{loading ? 'Calcul en cours…' : 'Calculer mon installation'}
			</button>
		</div>
		{#if errorMsg}<p class="err" role="alert">{errorMsg}</p>{/if}
	</form>

	{#if result}
		<section id="resultats" class="card results" class:stale>
			{#if stale}
				<p class="warn">Vous avez modifié les paramètres : relancez le calcul pour mettre à jour les résultats.</p>
			{/if}
			<h2>Résultats</h2>
			<p class="lead">
				Pour une consommation de <strong>{fmt(result.input.consommation)} kWh/an</strong>, voici nos recommandations&nbsp;:
			</p>

			<div class="scenarios">
				{#each result.scenarios as sc (sc.id)}
					<article class="scenario {sc.id}">
						<header class="sc-head">
							<h3 class="sc-title">
								Installation photovoltaïque
								<span class="sc-tag">{sc.label}</span>
							</h3>
						</header>
						<div class="sc-body">
						<div class="sc-kpis">
							<div>
								<p class="sc-sub">Puissance d'installation conseillée</p>
								<p class="sc-big"><strong>{fmtKwc(sc.puissance)}</strong> kWc</p>
							</div>
							<div>
								<p class="sc-sub">Production estimée</p>
								<!-- Chiffre clé sur aplat Jaune Mater, comme les chiffres mis en avant dans la charte -->
								<p class="sc-big sc-key"><strong>{fmt(sc.annuel)}</strong> kWh/an</p>
							</div>
							{#if sc.batterie}
								<div>
									<p class="sc-sub">Batterie conseillée</p>
									<p class="sc-big sc-small"><strong>{fmtBatterie(sc.batterie)}</strong></p>
								</div>
							{/if}
						</div>
						</div>
					</article>
				{/each}
			</div>

			<h3>Production mois par mois (kWh)</h3>
			<MonthlyChart
				series={[
					{ label: `Sans batterie — ${fmtKwc(result.scenarios[0].puissance)} kWc`, color: 'var(--jaune)', values: result.scenarios[0].mensuel },
					{ label: `Avec batterie — ${fmtKwc(result.scenarios[1].puissance)} kWc`, color: 'var(--bleu)', values: result.scenarios[1].mensuel }
				]}
			/>


			<div class="actions">
				<button class="btn secondary" type="button" onclick={downloadPdf} disabled={pdfLoading || stale}>
					{pdfLoading ? 'Génération…' : 'Télécharger le PDF'}
				</button>
			</div>

			<form class="mail" onsubmit={sendMail}>
				<h3>Recevoir l'étude par e-mail</h3>
				{#if mailState === 'sent'}
					<p class="ok" role="status">C'est envoyé ! Pensez à vérifier vos courriers indésirables.</p>
				{:else}
					<div class="grid">
						<div>
							<label for="nom">Nom</label>
							<input id="nom" type="text" required maxlength="120" bind:value={nom} autocomplete="name" />
						</div>
						<div>
							<label for="email">E-mail</label>
							<input id="email" type="email" required maxlength="200" bind:value={email} autocomplete="email" />
						</div>
					</div>
					<input class="hp" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" bind:value={website} />
					<label class="check">
						<input type="checkbox" required bind:checked={consentement} />
						<span>J'accepte que MaterFrance utilise mon e-mail pour m'envoyer cette étude et me recontacter à son sujet.</span>
					</label>
					<div class="mail-actions">
						<button class="btn" type="submit" disabled={mailState === 'sending' || stale}>
							{mailState === 'sending' ? 'Envoi…' : 'Envoyer par e-mail'}
						</button>
					</div>
					{#if mailState === 'error'}<p class="err" role="alert">{mailError}</p>{/if}
				{/if}
			</form>
		</section>
	{/if}

	<section class="card faq" aria-labelledby="faq-titre">
		<h2 id="faq-titre">Questions fréquentes</h2>
		{#each FAQ as item (item.q)}
			<details>
				<summary>{item.q}</summary>
				<p>{item.r}</p>
			</details>
		{/each}
	</section>
</main>

<style>
	.intro {
		padding: 40px 0 20px;
	}
	/* Titre façon charte (« MISE EN SITUATION ») : capitales très grasses, mot clé en Bleu Mater */
	h1 {
		font-size: clamp(1.8rem, 4.6vw, 2.9rem);
		font-weight: 900;
		line-height: 1.05;
		letter-spacing: -0.01em;
		text-transform: uppercase;
		color: #1c1b1f;
		margin: 0 0 14px;
	}
	h1 em {
		font-style: normal;
		color: var(--bleu);
	}
	.intro p {
		color: var(--muted);
		margin: 0;
		max-width: 60ch;
	}
	.step + .step {
		margin-top: 28px;
	}
	h2 {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 1.2rem;
		margin: 0 0 16px;
	}
	h2 span {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		background: var(--jaune);
		color: var(--bleu-darker);
		font-size: 0.9rem;
	}
	h3 {
		font-size: 1rem;
		margin: 24px 0 8px;
	}
	.mapbox {
		margin-top: 12px;
	}
	.coords {
		font-size: 0.85rem;
		color: var(--muted);
		margin: 4px 0 0;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 18px;
	}
	.conso {
		max-width: 360px;
	}
	.unit {
		position: relative;
	}
	.unit input {
		padding-right: 78px;
	}
	.unit span {
		position: absolute;
		right: 16px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--muted);
		font-weight: 500;
		pointer-events: none;
	}
	.hint {
		font-size: 0.85rem;
		color: var(--muted);
		margin: 6px 0 0;
	}

	.mt {
		margin-top: 8px;
	}
	.submit {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 16px;
		flex-wrap: wrap;
		margin-top: 28px;
	}
	.muted {
		color: var(--muted);
	}
	.small {
		font-size: 0.85rem;
	}
	.err {
		color: var(--danger);
		font-size: 0.9rem;
		margin: 6px 0 0;
	}
	.ok {
		color: var(--primary);
		font-weight: 600;
	}
	.warn {
		background: var(--jaune-light);
		border: 1px solid var(--jaune-light-active);
		border-radius: var(--radius);
		padding: 10px 12px;
		margin: 0 0 16px;
	}
	.results.stale .scenarios,
	.results.stale :global(svg) {
		opacity: 0.5;
	}
	.results h2 {
		margin-bottom: 8px;
	}
	.lead {
		margin: 0 0 16px;
		max-width: 70ch;
	}
	.scenarios {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 16px;
	}
	/* Cartes : corps blanc, bordure jaune (sans batterie) ou bleue (avec batterie) */
	.scenario {
		display: flex;
		flex-direction: column;
		background: var(--surface);
		border: 2px solid var(--sc-color);
		border-radius: var(--radius);
		overflow: hidden;
	}
	.scenario.sansBatterie {
		--sc-color: var(--jaune);
	}
	.scenario.avecBatterie {
		--sc-color: var(--bleu);
	}
	/* « sans / avec batterie » : même style que « installation photovoltaïque » du titre principal */
	/* Bandeau de titre façon charte : aplat Jaune Mater (sans batterie) / Bleu Mater, texte blanc (avec batterie) */
	.sc-head {
		padding: 14px 20px 16px;
		background: var(--sc-color);
	}
	.sansBatterie .sc-head {
		color: #1c1b1f;
	}
	.avecBatterie .sc-head {
		color: #fff;
	}
	.sc-title {
		margin: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		font-size: 1.05rem;
		line-height: 1.2;
		color: inherit;
	}
	.sc-tag {
		font-size: 1.5rem;
		font-weight: 900;
		letter-spacing: 0.01em;
		text-transform: uppercase;
		white-space: nowrap;
	}
	/* Puissance puis production, empilées */
	.sc-kpis {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.sc-kpis > div + div {
		padding-top: 16px;
		border-top: 1px solid rgb(22 29 62 / 0.08);
	}
	/* Chiffres façon charte : Owners Black, noir de la charte */
	.sc-big {
		margin: 6px 0 0;
		font-family: var(--font-title);
		font-weight: 700;
		font-size: 1rem;
		color: #1c1b1f;
		line-height: 1;
		white-space: nowrap;
	}
	.sc-big strong {
		font-size: 2.4rem;
		font-weight: 900;
		letter-spacing: -0.01em;
		font-variant-numeric: tabular-nums;
	}
	/* Production : chiffre clé sur aplat Jaune Mater */
	.sc-key {
		display: inline-block;
		align-self: flex-start;
		padding: 6px 12px 4px;
		background: var(--jaune);
	}
	.sc-small strong {
		font-size: 1.5rem;
	}
	.sc-body {
		padding: 18px 20px 20px;
		display: flex;
		flex-direction: column;
	}
	/* Libellés façon « sous-titre » de la charte : petites capitales */
	.sc-sub {
		margin: 0;
		font-family: var(--font-body);
		font-weight: 600;
		font-size: 0.75rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.actions,
	.mail-actions {
		display: flex;
		justify-content: flex-end;
		margin-top: 16px;
	}
	.mail {
		border-top: 1px solid var(--border);
		margin-top: 24px;
		padding-top: 4px;
	}
	.check {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		font-family: var(--font-body);
		font-weight: 400;
		font-size: 0.9rem;
		margin-top: 14px;
	}
	.check input {
		margin-top: 1px;
	}
	.hp {
		position: absolute;
		left: -9999px;
		width: 1px;
		height: 1px;
	}
	.faq h2 {
		margin-bottom: 8px;
	}
	.faq details {
		border-top: 1px solid var(--border);
	}
	.faq details:last-child {
		border-bottom: 1px solid var(--border);
	}
	.faq summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 14px 0;
		cursor: pointer;
		list-style: none;
		font-family: var(--font-title);
		font-weight: 700;
		color: #1c1b1f;
	}
	.faq summary::-webkit-details-marker {
		display: none;
	}
	/* Chevron Bleu Mater, pivote à l'ouverture */
	.faq summary::after {
		content: '';
		flex: none;
		width: 8px;
		height: 8px;
		border-right: 2px solid var(--bleu);
		border-bottom: 2px solid var(--bleu);
		transform: translateY(-2px) rotate(45deg);
		transition: transform 0.15s;
	}
	.faq details[open] summary::after {
		transform: translateY(2px) rotate(-135deg);
	}
	.faq summary:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}
	.faq details p {
		margin: 0 0 14px;
		color: var(--muted);
		max-width: 70ch;
	}
</style>
