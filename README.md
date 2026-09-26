# AccountPro

Svenskt bokföringsprojekt med React, TypeScript, Vite och en FastAPI-backend.

## Starta lokalt med databas

Läs [STARTA-LOKALT.md](STARTA-LOKALT.md) för GitHub-uppladdning, Docker-installation, start, stopp och säkerhetskopiering.

På Windows: starta Docker Desktop och dubbelklicka på `start-local.cmd`. Öppna sedan http://localhost:5173.

Docker startar webbserver, Python-API, PostgreSQL 15 och projektets rapportskriptserver. Data sparas i volymen `db_data`. Backend och databas publiceras inte som egna portar. Webbservern är endast tillgänglig på den lokala datorn.

## Lovable och frontendutveckling

```sh
npm ci
npm run dev
```

Standardläget sparar testuppgifter i webbläsaren och kräver ingen backend. Lovable använder samma läge. Databasen på din dator och förhandsvisningens data är separata. Docker väljer databasläget automatiskt under bygget.

## Kontrollera frontend

```sh
npm run build
npx tsc --noEmit -p tsconfig.app.json
```

Databasändringar hanteras med Alembic vid backendstart. Säkerhetskopiera innan uppdatering. Se startguiden för begränsningar och vad som verifierats.
