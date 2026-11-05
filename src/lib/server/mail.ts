import nodemailer, { type Transporter } from 'nodemailer';
import { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_BCC } from '$app/env/private';
import { fmt, fmtBatterie, fmtKwc, type SimulationResult } from '#lib/simulation.ts';

export const mailConfigured = () => Boolean(SMTP_HOST && MAIL_FROM);

let transporter: Transporter | undefined;
function getTransporter() {
	transporter ??= nodemailer.createTransport({
		host: SMTP_HOST,
		port: SMTP_PORT,
		secure: SMTP_PORT === 465,
		auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
	});
	return transporter;
}

export async function sendSimulation(to: string, nom: string, r: SimulationResult, pdf: Buffer) {
	const [sans, avec] = r.scenarios;
	const batterie = avec.batterie ? fmtBatterie(avec.batterie) : '';
	const resume = `${fmt(r.input.consommation)} kWh/an de consommation, toit orienté ${r.input.orientation}, incliné à ${r.input.angle}°`;
	const text = `Bonjour ${nom},

Vous trouverez ci-joint l'étude de production de votre projet photovoltaïque (${resume}).

- Sans batterie : ${fmtKwc(sans.puissance)} kWc, environ ${fmt(sans.annuel)} kWh/an (${fmt(sans.couverture * 100)} % de votre consommation).
- Avec batterie : ${fmtKwc(avec.puissance)} kWc, environ ${fmt(avec.annuel)} kWh/an, batterie de ${batterie}.

Nos conseillers restent à votre disposition pour affiner cette étude et vous proposer le matériel adapté.

L'équipe MaterFrance
https://www.materfrance.fr`;

	const html = `<p>Bonjour ${escapeHtml(nom)},</p>
<p>Vous trouverez ci-joint l'étude de production de votre projet photovoltaïque (${escapeHtml(resume)}).</p>
<ul>
<li><strong style="color:#4054B2">Sans batterie : ${fmtKwc(sans.puissance)} kWc</strong>, environ ${fmt(sans.annuel)} kWh/an (${fmt(sans.couverture * 100)} % de votre consommation).</li>
<li><strong style="color:#4054B2">Avec batterie : ${fmtKwc(avec.puissance)} kWc</strong>, environ ${fmt(avec.annuel)} kWh/an, batterie de ${batterie}.</li>
</ul>
<p>Nos conseillers restent à votre disposition pour affiner cette étude et vous proposer le matériel adapté.</p>
<p>L'équipe MaterFrance<br><a href="https://www.materfrance.fr">www.materfrance.fr</a></p>`;

	await getTransporter().sendMail({
		from: MAIL_FROM,
		to,
		bcc: MAIL_BCC,
		subject: 'Votre étude de production photovoltaïque — MaterFrance',
		text,
		html,
		attachments: [{ filename: 'etude-production-materfrance.pdf', content: pdf, contentType: 'application/pdf' }]
	});
}

const escapeHtml = (s: string) =>
	s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
