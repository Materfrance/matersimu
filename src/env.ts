// Variables d'environnement (voir .env.example). Accessibles via `$app/env/private`.
import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => (value ? value : undefined);

export const variables = defineEnvVars({
	PVGIS_BASE_URL: {
		description: "URL de base de l'API PVGIS",
		schema: (v) => v || 'https://re.jrc.ec.europa.eu/api/v5_3'
	},
	SMTP_HOST: { description: 'Serveur SMTP', schema: optional },
	SMTP_PORT: {
		description: 'Port SMTP (465 = SSL, 587 = STARTTLS)',
		schema: (v) => (v ? Number(v) : 587)
	},
	SMTP_USER: { description: 'Utilisateur SMTP', schema: optional },
	SMTP_PASS: { description: 'Mot de passe SMTP', schema: optional },
	MAIL_FROM: {
		description: 'Expéditeur, ex. "MaterFrance <simulation@materfrance.fr>"',
		schema: optional
	},
	MAIL_BCC: {
		description: 'Copie cachée de chaque simulation envoyée (suivi commercial), optionnel',
		schema: optional
	}
});
