import { error } from '@sveltejs/kit';
import { SimulationInput } from '#lib/simulation.ts';
import { simulate, PvgisError } from '#lib/server/pvgis.ts';
import { buildPdf } from '#lib/server/pdf.ts';
import { rateLimiter } from '#lib/server/rate-limit.ts';
import type { RequestHandler } from './$types';

const allow = rateLimiter(20, 60_000);

// On recalcule côté serveur (cache) : le PDF ne peut pas contenir de chiffres modifiés par le client.
export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!allow(getClientAddress())) error(429, 'Trop de demandes, patientez une minute.');

	const parsed = SimulationInput.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Paramètres de simulation invalides.');

	try {
		const result = await simulate(parsed.data);
		const pdf = await buildPdf(result);
		return new Response(new Uint8Array(pdf), {
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': 'attachment; filename="etude-production-materfrance.pdf"'
			}
		});
	} catch (e) {
		if (e instanceof PvgisError) error(e.status, e.message);
		throw e;
	}
};
