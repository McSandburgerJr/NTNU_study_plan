# Emneplanlegger

Planlegg studieløpet ditt ved NTNU: emner per semester, «kanskje»-emner, karakterer, snitt og låste semestre.
Planen er knyttet til kontoen din og synkroniseres mellom mobil, nettbrett og PC.

```
site/            nettsiden som legges ut (index.html, config.js, courses.json, ikon, manifest)
supabase/        databaseoppsett (schema.sql)
scripts/         scraper som henter NTNUs emneliste
.github/         publisering til GitHub Pages og ukentlig oppdatering av emnelisten
netlify.toml     valgfritt, hvis du heller vil bruke Netlify
```

## Oppsett (ca. 20 minutter, gratis)

### 1. Supabase (database og innlogging)
1. Lag konto på supabase.com og opprett et nytt prosjekt. Velg region **Stockholm** eller **Frankfurt**.
2. Gå til **SQL Editor → New query**, lim inn innholdet i `supabase/schema.sql` og trykk **Run**.
3. Gå til **Project Settings → API** og kopier **Project URL** og **anon public**-nøkkelen.
4. Lim dem inn i `site/config.js`.

### 2. GitHub
1. Lag et nytt repository og last opp hele denne mappen.
2. Under **Settings → Actions → General**, sett *Workflow permissions* til **Read and write**.
3. Gå til **Actions → Oppdater emneliste → Run workflow** for å hente hele emnelisten første gang.
   Etter det kjører den automatisk hver mandag.

### 3. GitHub Pages (nettsiden)
1. I repoet: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Gå til **Actions → Publiser nettsiden → Run workflow** (eller bare push en endring).
3. Siden ligger nå på `https://<brukernavn>.github.io/<repo>/`.
   Den publiseres på nytt ved hver push til `main` og hver gang emnelisten er oppdatert.

### 4. Koble innloggingen til nettadressen
I Supabase: **Authentication → URL Configuration**. Sett **Site URL** til
`https://<brukernavn>.github.io/<repo>/` og legg samme adresse til under **Redirect URLs**.
Ellers fører bekreftelseslenken i e-posten til feil sted.

*Vil du heller bruke Netlify senere, ligger `netlify.toml` klar: importer repoet i Netlify, så publiseres `site/` automatisk.*

## Bruke den på mobil
Åpne siden i nettleseren og velg **Legg til på startskjerm** (iPhone: Del-knappen, Android: menyen).
Da får den eget ikon og åpnes som en app.

## Hvordan synkroniseringen virker
- Endringer lagres i nettleseren med en gang, og sendes til Supabase et halvt sekund etter.
- Andre enheter som har siden åpen får endringen med en gang (sanntid), og ellers når siden får fokus igjen.
- Uten nett vises siste lokale kopi, og endringer sendes når nettet er tilbake.
- Rediger/Vis-modus huskes per enhet, ikke per konto.

## Teste scraperen lokalt
```
pip install requests beautifulsoup4
python scripts/scrape_courses.py --details --limit 30 --out site/courses.json
```
Finner den 0 emner, har NTNU endret sidestrukturen, og `parse_list` i scraperen må justeres.

## Sikkerhet
- `anon public`-nøkkelen er ment å ligge åpent. Reglene i `schema.sql` sørger for at hver bruker bare kan lese og skrive sin egen rad.
- Legg aldri `service_role`-nøkkelen i noen fil under `site/`.
