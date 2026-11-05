// pdfmake : on importe explicitement la version serveur (js/index.js). Sur Cloudflare Workers,
// le bundler choisirait sinon la version navigateur (champ "browser" du package).
import pdfmake from "pdfmake/js/index.js";
import type { TDocumentDefinitions, Content, ContentStack } from "pdfmake/interfaces";
import {
  MOIS,
  DEFAULTS,
  fmtBatterie,
  FAQ,
  fmtKwc,
  niceScale,
  fmt as fmtFr,
  type Scenario,
  type SimulationResult,
} from "#lib/simulation.ts";
import logoSvg from "#lib/assets/logo-materfrance.svg?raw";

// Poppins n'a pas l'espace fine insécable (U+202F) utilisée par toLocaleString('fr-FR')
const fmt = (n: number, d = 0) => fmtFr(n, d).replace(/\u202f/g, "\u00a0");

// Polices embarquées dans le bundle (pas d'accès disque sur Cloudflare Workers) :
// Vite les inline en data URL, on les dépose dans le système de fichiers virtuel de pdfmake.
import poppins400 from "@fontsource/poppins/files/poppins-latin-400-normal.woff?inline";
import poppins600 from "@fontsource/poppins/files/poppins-latin-600-normal.woff?inline";
import poppins700 from "@fontsource/poppins/files/poppins-latin-700-normal.woff?inline";

const vfsFont = (name: string, dataUrl: string) => {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  // `virtualfs` existe dans pdfmake 0.3 mais n'est pas typé dans @types/pdfmake
  (pdfmake as unknown as { virtualfs: { writeFileSync(n: string, c: string, e: string): void } }).virtualfs.writeFileSync(
    name,
    base64,
    "base64",
  );
  return name;
};
const P400 = vfsFont("Poppins-400.woff", poppins400);
const P600 = vfsFont("Poppins-600.woff", poppins600);
const P700 = vfsFont("Poppins-700.woff", poppins700);

pdfmake.setFonts({
  Poppins: { normal: P400, bold: P600, italics: P400, bolditalics: P600 },
  PoppinsBold: { normal: P700, bold: P700, italics: P700, bolditalics: P700 },
});
pdfmake.setUrlAccessPolicy(() => false); // aucune ressource distante
pdfmake.setLocalAccessPolicy(() => false); // polices dans le système de fichiers virtuel

// Charte MaterFrance (Figma « MF - site »)
const C = {
  primary: "#4054B2", // Bleu Mater
  accent: "#F7B930", // Jaune Mater
  text: "#161D3E", // Bleu Mater darker
  muted: "#5B6275",
  light: "#ECEEF7", // Bleu Mater light
  accentLight: "#FEF8EA", // Jaune Mater light
  border: "#E3E6EF",
  highlight: "#FDE9BF", // Jaune Mater light :active (surlignage des titres)
};

export async function buildPdf(
  r: SimulationResult,
  destinataire?: string,
): Promise<Buffer> {
  const date = new Date(r.date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const azimut =
    r.aspect === 180 ? "180°" : `${r.aspect > 0 ? "+" : ""}${r.aspect}°`;
  const [sans, avec] = r.scenarios;
  // Le géolocalisateur renvoie « Position GPS (lat, lon) » quand il ne trouve pas d'adresse
  const adresse =
    r.input.adresse && !/^Position GPS/i.test(r.input.adresse.trim())
      ? r.input.adresse.trim()
      : null;

  const kv = (k: string, v: string): Content[] => [
    { text: k, color: C.muted },
    { text: v, bold: true },
  ];

  const doc: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [40, 72, 40, 40],
    defaultStyle: {
      font: "Poppins",
      fontSize: 9.5,
      color: C.text,
      lineHeight: 1.1,
    },
    info: {
      title: "Étude de production photovoltaïque",
      author: "MaterFrance",
    },

    header: {
      margin: [40, 28, 40, 0],
      columns: [
        { svg: logoSvg, width: 150 },
        {
          text: `Étude du ${date}`,
          alignment: "right",
          color: C.muted,
          margin: [0, 8, 0, 0],
        },
      ],
    },
    footer: (page, pages) => ({
      margin: [40, 10, 40, 0],
      columns: [
        {
          text: "Estimation basée sur PVGIS © Union européenne, 2001-2026 (JRC). Valeurs moyennes indicatives, sans valeur contractuelle.",
          fontSize: 7,
          color: C.muted,
          width: "*",
        },
        {
          text: `${page} / ${pages}`,
          alignment: "right",
          fontSize: 8,
          color: C.muted,
          width: 40,
        },
      ],
    }),

    content: [
      {
        text: "Étude de production photovoltaïque",
        font: "PoppinsBold",
        fontSize: 18,
        color: C.text,
      },
      destinataire
        ? {
            text: `Préparée pour ${destinataire}`,
            color: C.muted,
            margin: [0, 2, 0, 0],
          }
        : "",

      // Données d'entrée
      { text: "Votre projet", style: "h2", margin: [0, 10, 0, 6] },
      {
        table: {
          // Deux colonnes de « libellé / valeur » pour tenir sur une page
          widths: [78, "*", 78, "*"],
          body: [
            // Ligne « Adresse » seulement pour une vraie adresse (pas de simples coordonnées GPS)
            ...(adresse
              ? [
                  [
                    { text: "Adresse", color: C.muted },
                    { text: adresse, bold: true, colSpan: 3 },
                    {},
                    {},
                  ],
                ]
              : []),
            [
              ...kv("Consommation", `${fmt(r.input.consommation)} kWh/an`),
              ...kv("Orientation", `${r.input.orientation} (azimut ${azimut})`),
            ],
            [
              ...kv("Inclinaison", `${r.input.angle}°`),
              ...kv("Type de pose", DEFAULTS.mountingLabel),
            ],
            [
              ...kv("Technologie", "Silicium cristallin"),
              ...kv("Raccordement", "Raccordé au réseau"),
            ],
            [
              ...kv(
                "Coordonnées",
                `${r.input.lat.toFixed(4)}, ${r.input.lon.toFixed(4)}${r.elevation != null ? ` · alt. ${fmt(r.elevation)} m` : ""}`,
              ),
              ...kv("Votre toit", `${fmt(r.specifique)} kWh/kWc/an`),
            ],
          ],
        },
        layout: {
          hLineWidth: (i, node) =>
            i === 0 || i === node.table.body.length ? 0 : 0.5,
          vLineWidth: () => 0,
          hLineColor: () => C.border,
          paddingTop: () => 2,
          paddingBottom: () => 2,
        },
        margin: [0, 0, 0, 10],
      },

      // Les deux scénarios
      { text: "Nos recommandations", style: "h2" },
      {
        // Même rendu que les cartes du site : fond blanc, bordure jaune (sans) / bleue (avec)
        table: {
          widths: ["*", 12, "*"],
          body: [
            // Bandeau de titre sur aplat (jaune / bleu), puis corps blanc
            [
              { ...scenarioHead(sans), ...cardBorder(C.accent, "top") },
              { text: "", border: [false, false, false, false] },
              { ...scenarioHead(avec), ...cardBorder(C.primary, "top") },
            ],
            [
              { ...scenarioBlock(sans, r), ...cardBorder(C.accent, "bottom") },
              { text: "", border: [false, false, false, false] },
              { ...scenarioBlock(avec, r), ...cardBorder(C.primary, "bottom") },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 2,
          vLineWidth: () => 2,
          // pdfmake ignore la couleur de bordure gauche d'une cellule au-delà de la 2e colonne
          // (il compare l'index de colonne au nombre de lignes) : on fixe donc les traits verticaux ici.
          // Traits 0-1 : carte « sans batterie » (jaune) ; traits 2-3 : carte « avec batterie » (bleu).
          vLineColor: (i: number) => (i <= 1 ? C.accent : C.primary),
          paddingTop: (row: number) => (row === 0 ? 9 : 10),
          paddingBottom: (row: number) => (row === 0 ? 9 : 12),
          paddingLeft: (i) => (i === 1 ? 0 : 14),
          paddingRight: (i) => (i === 1 ? 0 : 14),
        },
        margin: [0, 0, 0, 10],
      },

      // Graphique mensuel
      { text: "Production mensuelle estimée (kWh)", style: "h2" },
      {
        columns: [
          legend(C.accent, `Sans batterie — ${fmtKwcPdf(sans.puissance)} kWc`),
          legend(C.primary, `Avec batterie — ${fmtKwcPdf(avec.puissance)} kWc`),
        ],
        columnGap: 16,
        margin: [0, 0, 0, 6],
      },
      {
        svg: monthlyChartSvg(sans.mensuel, avec.mensuel),
        width: 515,
        margin: [0, 0, 0, 0],
      },

      // Récapitulatif mensuel : sans / avec batterie côte à côte
      { text: "Récapitulatif de la production mensuelle (kWh)", style: "h2", margin: [0, 10, 0, 4] },
      recapTable(sans, avec),

      // Questions fréquentes (page 2)
      { text: "Questions fréquentes", style: "h2", pageBreak: "before" },
      ...FAQ.flatMap((item): Content[] => [
        { text: item.q, font: "PoppinsBold", fontSize: 10.5, color: "#1C1B1F", margin: [0, 8, 0, 0] },
        { text: item.r, fontSize: 9.5, color: C.muted, lineHeight: 1.3, margin: [0, 3, 0, 0] },
      ]),
    ],
    styles: {
      h2: {
        font: "PoppinsBold",
        fontSize: 12,
        color: C.primary,
        margin: [0, 0, 0, 8],
      },
    },
  };

  return pdfmake.createPdf(doc).getBuffer();
}

const fmtKwcPdf = (kwc: number) => fmtKwc(kwc).replace(/\u202f/g, "\u00a0");

function recapTable(sans: Scenario, avec: Scenario): Content {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: any = {};
  const cell = (text: string, opts: Record<string, unknown> = {}) => ({
    text,
    fontSize: 7.5,
    alignment: "right" as const,
    noWrap: true,
    ...opts,
  });
  const serie = (s: Scenario, color: string) => [
    {
      columns: [
        { width: 7, canvas: [{ type: "rect", x: 0, y: 1.5, w: 7, h: 7, color }] },
        { width: "auto", text: `${s.label} — ${fmtKwcPdf(s.puissance)} kWc`, fontSize: 7.5, bold: true, noWrap: true },
      ],
      columnGap: 4,
    },
    ...s.mensuel.map((v) => cell(fmt(v))),
    cell(fmt(s.annuel), { bold: true, color: C.primary }),
  ];
  Object.assign(out, {
    table: {
      dontBreakRows: true,
      widths: ["auto", ...Array(12).fill("*"), "auto"],
      body: [
        [
          { text: "", fontSize: 7.5 },
          ...MOIS.map((m) => cell(m, { color: C.muted })),
          cell("Total", { color: C.muted, bold: true }),
        ],
        serie(sans, C.accent),
        serie(avec, C.primary),
      ],
    },
    layout: {
      hLineWidth: (i: number) => (i === 1 ? 1 : i === 2 ? 0.5 : 0),
      vLineWidth: () => 0,
      hLineColor: () => C.border,
      paddingTop: () => 3,
      paddingBottom: () => 3,
      paddingLeft: () => 3,
      paddingRight: () => 3,
    },
  });
  return out as Content;
}

function cardBorder(color: string, part: "top" | "bottom") {
  // [gauche, haut, droite, bas] : le bandeau n'a pas de trait en bas, le corps pas de trait en haut
  const border: [boolean, boolean, boolean, boolean] =
    part === "top" ? [true, true, true, false] : [true, false, true, true];
  return {
    border,
    borderColor: [color, color, color, color] as [string, string, string, string],
  };
}

/** Bandeau de titre d'une carte : aplat Jaune Mater (sans batterie) / Bleu Mater, texte blanc (avec batterie). */
function scenarioHead(s: Scenario) {
  const avec = s.id === "avecBatterie";
  return {
    fillColor: avec ? C.primary : C.accent,
    stack: [
      { text: "Installation photovoltaïque", font: "PoppinsBold", fontSize: 10 },
      { text: s.label.toUpperCase(), font: "PoppinsBold", fontSize: 15, noWrap: true },
    ],
    color: avec ? "#FFFFFF" : "#1C1B1F",
  };
}

function scenarioBlock(s: Scenario, r: SimulationResult): ContentStack {
  const INK = "#1C1B1F"; // noir de la charte
  // Libellés façon « sous-titre » de la charte : petites capitales
  const label = (text: string, top = 0): Content => ({
    text: text.toUpperCase(),
    fontSize: 6.5,
    bold: true,
    characterSpacing: 0.4,
    color: C.muted,
    margin: [0, top, 0, 0],
  });
  const val = (value: string, unit: string, size = 19) => ({
    text: [
      { text: value, fontSize: size },
      { text: unit ? ` ${unit}` : "", fontSize: 9 },
    ],
    font: "PoppinsBold",
    color: INK,
    noWrap: true,
  });
  return {
    stack: [
      label("Puissance d'installation conseillée"),
      { ...val(fmtKwcPdf(s.puissance), "kWc"), margin: [0, 2, 0, 0] },
      label("Production estimée", 9),
      // Chiffre clé sur aplat Jaune Mater
      {
        margin: [0, 3, 0, 0],
        table: { body: [[{ ...val(fmt(s.annuel), "kWh/an"), fillColor: C.accent }]] },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 7,
          paddingRight: () => 7,
          paddingTop: () => 3,
          paddingBottom: () => 1,
        },
      },
      ...(s.batterie
        ? [
            label("Batterie conseillée", 9),
            {
              ...val(fmtBatterie(s.batterie).replace(/\u202f/g, "\u00a0"), "", 13),
              margin: [0, 2, 0, 0] as [number, number, number, number],
            },
          ]
        : []),
    ],
  };
}

function legend(color: string, label: string): Content {
  return <Content>{
    width: "auto",
    columnGap: 5,
    columns: [
      {
        width: 8,
        canvas: [{ type: "rect", x: 0, y: 2, w: 8, h: 8, color }],
      },
      { width: "auto", text: label, fontSize: 8, color: C.muted },
    ],
  };
}

/** Histogramme mensuel groupé (sans / avec batterie) en SVG, rendu nativement par pdfmake. */
function monthlyChartSvg(a: number[], b: number[]): string {
  const W = 515,
    H = 95,
    padL = 36,
    padB = 18,
    padT = 8;
  // Les valeurs sont dans le tableau récapitulatif : pas d'étiquettes sur les barres
  const { max, ticks } = niceScale(Math.max(...a, ...b));
  const plotH = H - padB - padT;
  const step = (W - padL) / 12;
  const barW = step * 0.32;

  const grid = ticks
    .map((t) => {
      const y = padT + plotH - (t / max) * plotH;
      return `<line x1="${padL}" x2="${W}" y1="${y}" y2="${y}" stroke="${C.border}" stroke-width="0.6"/>
<text x="${padL - 6}" y="${y + 3}" font-size="7" text-anchor="end" fill="${C.muted}">${fmt(t)}</text>`;
    })
    .join("");

  const bar = (v: number, x: number, color: string) => {
    const h = (v / max) * plotH;
    const top = padT + plotH - h;
    return `<rect x="${x}" y="${top}" width="${barW}" height="${h}" fill="${color}"/>`;
  };

  const bars = a
    .map((v, i) => {
      const x0 = padL + i * step + (step - 2 * barW - 2) / 2;
      return `${bar(v, x0, C.accent)}${bar(b[i], x0 + barW + 2, C.primary)}
<text x="${padL + i * step + step / 2}" y="${H - 5}" font-size="7" text-anchor="middle" fill="${C.muted}">${MOIS[i]}</text>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${grid}${bars}</svg>`;
}
