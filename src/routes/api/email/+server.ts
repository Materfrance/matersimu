import { error, json } from '@sveltejs/kit';
import { EmailInput } from '#lib/simulation.ts';
import { simulate, PvgisError } from '#lib/server/pvgis.ts';
import { buildPdf } from '#lib/server/pdf.ts';
import { mailConfigured, sendSimulation } from '#lib/server/mail.ts';
import { rateLimiter } from '#lib/server/rate-limit.ts';
import type { RequestHandler } from './$types';

const allowIp = rateLimiter(5, 60 * 60_000); // 5 envois / heure / IP
const allowTo = rateLimiter(3, 24 * 3600_000); // 3 envois / jour / adresse

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!mailConfigured()) error(503, "L'envoi par e-mail n'est pas configuré.");

	const parsed = EmailInput.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Merci de vérifier votre nom, votre e-mail et votre consentement.');
	const { simulation, nom, email } = parsed.data;

	if (!allowIp(getClientAddress()) || !allowTo(email.toLowerCase())) {
		error(429, "Limite d'envoi atteinte, réessayez plus tard.");
	}

	try {
		const result = await simulate(simulation);
		const pdf = await buildPdf(result, nom);
		await sendSimulation(email, nom, result, pdf);
		return json({ ok: true });
	} catch (e) {
		if (e instanceof PvgisError) error(e.status, e.message);
		console.error('[email]', e);
		error(502, "L'e-mail n'a pas pu être envoyé, réessayez plus tard.");
	}
};
