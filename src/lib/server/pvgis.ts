import { PVGIS_BASE_URL } from '$app/env/private';
import { DEFAULTS, aspectFor, buildScenarios, type SimulationInput, type SimulationResult } from '#lib/simulation.ts';

/** Résultat PVGIS pour 1 kWc sur un toit donné (indépendant de la consommation). */
type Reference = Omit<SimulationResult, 'input' | 'scenarios' | 'date'>;

export class PvgisError extends Error {
	constructor(
		message: string,
		public status: number
	) {
		super(message);
	}
}

// Petit cache mémoire : même toit, même config → pas de nouvel appel PVGIS.
const cache = new Map<string, { at: number; data: Reference }>();
const TTL = 24 * 3600 * 1000;
const MAX_ENTRIES = 500;

/**
 * La production PVGIS est proportionnelle à la puissance crête : on simule 1 kWc sur le toit,
 * puis on en déduit la puissance nécessaire et la production de chaque scénario.
 */
export async function simulate(input: SimulationInput): Promise<SimulationResult> {
	const ref = await reference(input);
	return {
		...ref,
		input,
		scenarios: buildScenarios(input.consommation, ref.specifique, ref.mensuelParKwc),
		date: new Date().toISOString()
	};
}

async function reference(input: SimulationInput): Promise<Reference> {
	const aspect = aspectFor(input.orientation);
	const params = {
		lat: input.lat.toFixed(4),
		lon: input.lon.toFixed(4),
		peakpower: '1',
		loss: String(DEFAULTS.loss),
		angle: String(input.angle),
		aspect: String(aspect),
		pvtechchoice: DEFAULTS.pvtechchoice,
		mountingplace: DEFAULTS.mountingplace,
		raddatabase: DEFAULTS.raddatabase,
		outputformat: 'json'
	};
	const qs = new URLSearchParams(params).toString();

	const hit = cache.get(qs);
	if (hit && Date.now() - hit.at < TTL) return hit.data;

	const res = await fetchWithRetry(`${PVGIS_BASE_URL}/PVcalc?${qs}`);
	const body = await res.json().catch(() => null);

	if (!res.ok || !body?.outputs) {
		console.warn('[pvgis]', res.status, body?.message);
		// 4xx : emplacement hors couverture (mer, zone sans données…) ou paramètre refusé
		if (res.status >= 400 && res.status < 500) {
			throw new PvgisError(
				"PVGIS n'a pas de données pour cet emplacement. Vérifiez la position du repère sur la carte.",
				400
			);
		}
		throw new PvgisError('Le service PVGIS est momentanément indisponible, réessayez dans un instant.', 502);
	}

	const totals = body.outputs.totals.fixed;
	const monthly: { E_m: number }[] = body.outputs.monthly.fixed;

	const data: Reference = {
		aspect,
		specifique: totals.E_y,
		mensuelParKwc: monthly.map((m) => m.E_m),
		irradiation: totals['H(i)_y'],
		pertesTotales: totals.l_total,
		ecartTypeParKwc: totals.SD_y,
		elevation: body.inputs?.location?.elevation ?? null
	};

	if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
	cache.set(qs, { at: Date.now(), data });
	return data;
}

/** PVGIS renvoie 429 (trop d'appels) ou 529 (surcharge) : on réessaie 2 fois. */
async function fetchWithRetry(url: string, tries = 3): Promise<Response> {
	for (let i = 0; ; i++) {
		let res: Response;
		try {
			res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
		} catch {
			if (i < tries - 1) {
				await sleep(800 * (i + 1));
				continue;
			}
			throw new PvgisError('Le service PVGIS ne répond pas, réessayez dans un instant.', 504);
		}
		if ((res.status === 429 || res.status === 529) && i < tries - 1) {
			await sleep(1000 * (i + 1));
			continue;
		}
		if (res.status === 429 || res.status === 529) {
			throw new PvgisError('Le service PVGIS est surchargé, réessayez dans un instant.', 503);
		}
		return res;
	}
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
