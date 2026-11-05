// Code partagé client / serveur : listes, schéma de validation, types.
import { z } from 'zod';

/** Orientation lisible → azimut PVGIS (0 = Sud, 90 = Ouest, -90 = Est, 180 = Nord). */
export const ORIENTATIONS = [
	{ label: 'Sud', aspect: 0 },
	{ label: 'Sud-Est', aspect: -45 },
	{ label: 'Sud-Ouest', aspect: 45 },
	{ label: 'Est', aspect: -90 },
	{ label: 'Ouest', aspect: 90 },
	{ label: 'Nord-Est', aspect: -135 },
	{ label: 'Nord-Ouest', aspect: 135 },
	{ label: 'Nord', aspect: 180 }
] as const;

export type OrientationLabel = (typeof ORIENTATIONS)[number]['label'];
const ORIENTATION_LABELS = ORIENTATIONS.map((o) => o.label) as [OrientationLabel, ...OrientationLabel[]];

export function aspectFor(label: OrientationLabel): number {
	return ORIENTATIONS.find((o) => o.label === label)!.aspect;
}

/** Inclinaisons proposées au client. */
export const INCLINAISONS = [
	{ label: 'Toit plat / bac lesté (10°)', angle: 10 },
	{ label: 'Faible pente (15°)', angle: 15 },
	{ label: 'Pente standard (30°)', angle: 30 },
	{ label: 'Forte pente (45°)', angle: 45 },
	{ label: 'Très forte pente (60°)', angle: 60 },
	{ label: 'Façade / vertical (90°)', angle: 90 }
] as const;

/** Paramètres figés côté MaterFrance. */
export const DEFAULTS = {
	loss: 14,
	pvtechchoice: 'crystSi',
	/** Pose toujours en surimposition / au sol (modules ventilés). */
	mountingplace: 'free',
	mountingLabel: 'Surimposition / au sol',
	raddatabase: 'PVGIS-SARAH3',
	/** Bornes de la consommation annuelle saisie (kWh/an). */
	minConso: 500,
	maxConso: 200_000,
	/** Précision d'affichage de la puissance conseillée (kWc). */
	powerStep: 0.1
} as const;

/** Les deux scénarios calculés à partir de la consommation annuelle. */
export const SCENARIOS = {
	sansBatterie: {
		label: 'Sans batterie',
		/** Part de la consommation couverte : ≈ la consommation en journée. */
		taux: 0.65
	},
	avecBatterie: {
		label: 'Avec batterie',
		taux: 1,
		/** Capacité batterie = 1,7× à 2× la puissance du kit (kWc → kWh). */
		batterieRatio: [1.7, 2] as const,
		/** Capacité minimale proposée (kWh). */
		batterieMin: 2
	}
} as const;

export const SimulationInput = z.object({
	lat: z.number().min(-60).max(70),
	lon: z.number().min(-180).max(180),
	adresse: z.string().max(300).optional(),
	/** Consommation électrique annuelle du foyer (kWh/an). */
	consommation: z.number().min(DEFAULTS.minConso).max(DEFAULTS.maxConso),
	orientation: z.enum(ORIENTATION_LABELS),
	angle: z.number().min(0).max(90)
});
export type SimulationInput = z.infer<typeof SimulationInput>;

export const EmailInput = z.object({
	simulation: SimulationInput,
	nom: z.string().trim().min(1).max(120),
	email: z.email().max(200),
	consentement: z.literal(true),
	/** Champ piège anti-bot : doit rester vide. */
	website: z.string().max(0).optional()
});
export type EmailInput = z.infer<typeof EmailInput>;

export interface Scenario {
	id: 'sansBatterie' | 'avecBatterie';
	label: string;
	/** Part de la consommation visée (0,65 ou 1). */
	taux: number;
	/** Production visée = consommation × taux (kWh/an). */
	cible: number;
	/** Puissance nécessaire, non arrondie (kWc) : arrondie seulement à l'affichage. */
	puissance: number;
	/** Production annuelle estimée avec cette puissance (kWh/an). */
	annuel: number;
	/** Production mensuelle (kWh), janvier → décembre. */
	mensuel: number[];
	/** Production / consommation annuelle. */
	couverture: number;
	/** Capacité batterie conseillée (kWh), scénario avec batterie uniquement. */
	batterie?: { min: number; max: number };
}

export interface SimulationResult {
	input: SimulationInput;
	aspect: number;
	/** Productible spécifique du toit (kWh/kWc/an), calculé par PVGIS pour 1 kWc. */
	specifique: number;
	/** Production mensuelle pour 1 kWc (kWh/kWc). */
	mensuelParKwc: number[];
	/** Irradiation annuelle dans le plan (kWh/m²/an). */
	irradiation: number;
	/** Pertes totales (%), négatif. */
	pertesTotales: number;
	/** Variabilité interannuelle pour 1 kWc (kWh/kWc). */
	ecartTypeParKwc: number;
	elevation: number | null;
	scenarios: [Scenario, Scenario];
	date: string;
}

/** Arrondit une puissance au pas défini (0,1 kWc), sans descendre sous un pas. */
export function arrondiPuissance(kwc: number): number {
	const step = DEFAULTS.powerStep;
	return Math.max(step, Math.round(kwc / step) * step);
}

/** Capacité batterie conseillée pour une puissance de kit donnée (kWh). */
export function capaciteBatterie(kwc: number): { min: number; max: number } {
	const { batterieRatio, batterieMin } = SCENARIOS.avecBatterie;
	const r1 = (x: number) => Math.round(x * 10) / 10;
	return {
		min: r1(Math.max(batterieMin, kwc * batterieRatio[0])),
		max: r1(Math.max(batterieMin, kwc * batterieRatio[1]))
	};
}

/** Construit les deux scénarios à partir du productible spécifique du toit. */
export function buildScenarios(consommation: number, specifique: number, mensuelParKwc: number[]): [Scenario, Scenario] {
	const make = (id: Scenario['id']): Scenario => {
		const def = SCENARIOS[id];
		const cible = consommation * def.taux;
		// Pas d'arrondi dans le calcul : la production couvre exactement 65 % / 100 % de la consommation
		const puissance = cible / specifique;
		const annuel = puissance * specifique;
		return {
			id,
			label: def.label,
			taux: def.taux,
			cible,
			puissance,
			annuel,
			mensuel: mensuelParKwc.map((m) => m * puissance),
			couverture: annuel / consommation,
			batterie: id === 'avecBatterie' ? capaciteBatterie(puissance) : undefined
		};
	};
	return [make('sansBatterie'), make('avecBatterie')];
}

/** Formate la plage de capacité batterie (« 8,7 à 10,2 kWh » ou « 2 kWh »). */
export const fmtBatterie = (b: { min: number; max: number }) =>
	b.min === b.max ? `${fmt(b.min, b.min % 1 ? 1 : 0)} kWh` : `${fmt(b.min, 1)} à ${fmt(b.max, 1)} kWh`;

/** Formate une puissance en kWc (1 décimale si besoin). */
export const fmtKwc = (kwc: number) => {
	const r = arrondiPuissance(kwc);
	return fmt(r, Math.round(r * 10) % 10 ? 1 : 0);
};

/** Échelle d'axe « ronde » : 4 à 6 graduations de pas 1, 2, 2,5 ou 5 × 10^n. */
export function niceScale(v: number): { max: number; ticks: number[] } {
	const raw = (v || 1) / 4;
	const mag = 10 ** Math.floor(Math.log10(raw));
	const step = ([1, 2, 2.5, 5, 10].find((n) => n * mag >= raw) ?? 10) * mag;
	const max = Math.ceil(v / step) * step || step;
	const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
	return { max, ticks };
}

/** Questions fréquentes, affichées sur le site et dans le PDF. */
export const FAQ = [
	{
		q: 'Dois-je prendre une batterie ?',
		r: "Elle est utile si vous consommez surtout le soir ou si vous êtes absent la journée : elle stocke ce que les panneaux produisent pendant que vous n'êtes pas là. Si vous êtes souvent chez vous en journée, une installation sans batterie est un bon point de départ."
	},
	{
		q: "Que devient l'électricité que je ne consomme pas ?",
		r: "Avec une batterie, elle est d'abord stockée. Une fois la batterie pleine, ou sans batterie, tout dépend du réglage du compteur intelligent (smart meter) : en mode « zéro injection », les panneaux réduisent leur production pour ne rien envoyer sur le réseau ; sinon, le surplus part sur le réseau électrique."
	},
	{
		q: 'Les panneaux produisent-ils en hiver ?',
		r: "Oui, mais moins qu'en été : les journées sont plus courtes et le soleil plus bas. Le graphique mois par mois de votre étude montre cet écart pour votre toit."
	},
	{
		q: "Mon toit n'est pas orienté au sud, est-ce intéressant ?",
		r: "Oui. Un toit orienté est ou ouest produit un peu moins qu'un toit au sud, mais répartit la production sur le matin ou la fin de journée. Changez l'orientation dans le simulateur pour comparer."
	},
	{
		q: 'Puis-je ajouter une batterie plus tard ?',
		r: "Oui : avec l'écosystème ISYPOWER, vous pouvez tout à fait ajouter une batterie plus tard. Vous pouvez donc commencer sans batterie et compléter votre installation quand vous le souhaitez."
	}
] as const;

export const MOIS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];

export const fmt = (n: number, digits = 0) =>
	n.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
