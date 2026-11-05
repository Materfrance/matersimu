# MaterSimu — simulateur de production photovoltaïque

Simulateur client basé sur l'API **PVGIS 5.3** (JRC / Commission européenne).
SvelteKit 3 + TypeScript, sans base de données.

Paramètres figés : raccordé réseau, silicium cristallin (`crystSi`), pertes 14 %, base `PVGIS-SARAH3`.
Le client choisit : adresse / position sur la carte, puissance (0,5 → 36 kWc), orientation (liste), inclinaison, type de pose.

## Démarrer

```bash
npm install
cp .env.example .env      # puis compléter le SMTP
npm run dev               # http://localhost:5173
```

## Déploiement sur Cloudflare Workers

Le projet utilise `@sveltejs/adapter-cloudflare` ; la configuration est dans `wrangler.jsonc`
(Worker + assets statiques, flag `nodejs_compat` pour pdfmake et nodemailer).

```bash
npx wrangler login                 # une seule fois
npx wrangler secret put SMTP_HOST  # puis SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_BCC (optionnel)
npm run deploy                     # build + wrangler deploy
```

- `PVGIS_BASE_URL` et `SMTP_PORT` sont dans `vars` (wrangler.jsonc) ; les identifiants uniquement en **secrets**.
- Tester le build Cloudflare en local : `cp .dev.vars.example .dev.vars`, compléter, puis `npm run preview`.
- Domaine : décommenter `routes` dans `wrangler.jsonc` (ex. `simulateur.materfrance.fr`) une fois le DNS sur Cloudflare,
  ou brancher le dépôt GitHub dans *Workers & Pages → Create → Import a repository* (build : `npm run build`, deploy : `npx wrangler deploy`).
- Les limites anti-spam et le cache PVGIS sont en mémoire : ils valent par instance du Worker (suffisant pour ce trafic).

## Structure

```
src/
  env.ts                          Variables d'environnement (SMTP, URL PVGIS)
  app.css                         Charte graphique (couleurs dans :root)
  lib/
    simulation.ts                 Listes orientation/inclinaison, schémas Zod, types (partagé)
    components/
      AddressSearch.svelte        Autocomplétion d'adresse (géocodeur IGN Géoplateforme)
      MapPicker.svelte            Carte Leaflet (photo aérienne IGN / plan OSM), repère déplaçable
      MonthlyChart.svelte         Histogramme mensuel SVG
    server/
      pvgis.ts                    Appel PVGIS + cache mémoire 24 h + reprise sur 429/529
      pdf.ts                      Génération du PDF (pdfmake)
      mail.ts                     Envoi SMTP (nodemailer)
      rate-limit.ts               Limiteur par IP en mémoire
  routes/
    +page.svelte                  Interface
    api/simulation/+server.ts     POST → résultats JSON
    api/pdf/+server.ts            POST → PDF
    api/email/+server.ts          POST → PDF envoyé par mail
```

L'API PVGIS n'accepte pas les appels depuis le navigateur (pas de CORS) : tous les appels passent par les routes `/api/*`.
Le PDF et l'e-mail recalculent la simulation côté serveur (via le cache), donc les chiffres ne peuvent pas être modifiés par le client.

## Personnaliser

- **Couleurs** : `src/app.css` (site) et la constante `C` dans `src/lib/server/pdf.ts` (PDF).
- **Logo PDF** : dans `pdf.ts`, remplacer le texte du `header` par `{ image: 'data:image/png;base64,…', width: 140 }`.
- **Listes** : orientations, inclinaisons, types de pose et bornes de puissance dans `src/lib/simulation.ts`.
- **Anti-spam** : champ piège + limites (5 mails/h/IP, 3 mails/jour/adresse). Ajouter Cloudflare Turnstile si besoin.

## Mentions

Afficher la source : « PVGIS © Union européenne ». Les ombrages proches ne sont pas pris en compte par PVGIS.
