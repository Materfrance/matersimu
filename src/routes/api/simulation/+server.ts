import { error, json } from '@sveltejs/kit';
import { SimulationInput } from '#lib/simulation.ts';
import { simulate, PvgisError } from '#lib/server/pvgis.ts';
import { rateLimiter } from '#lib/server/rate-limit.ts';
import type { RequestHandler } from './$types';

const allow = rateLimiter(30, 60_000); // 30 simulations / minute / IP

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!allow(getClientAddress())) error(429, 'Trop de simulations, patientez une minute.');

	const parsed = SimulationInput.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Paramètres de simulation invalides.');

	try {
		return json(await simulate(parsed.data));
	} catch (e) {
		if (e instanceof PvgisError) error(e.status, e.message);
		throw e;
	}
};
