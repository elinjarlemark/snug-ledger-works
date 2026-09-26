# AccountPro – lokalt med Docker och i Lovable

## Lägg in uppdateringen på GitHub

Paketet innehåller bara nya och ändrade projektfiler. Det bygger på originalprojektet plus den tidigare designuppdateringen.

1. Packa upp uppdateringsfilen.
2. Lägg innehållet i samma nivå som `package.json` i ditt befintliga GitHub-projekt. Behåll undermapparna: `src`, `backend`, `docker` och `scripts`.
3. Ersätt filer med samma namn. Behåll övriga befintliga filer. Lägg inte hela uppdateringen i en ny undermapp.
4. Kontrollera att även `.dockerignore` och ändringen i `.gitignore` följer med. Dessa kan behöva läggas in via GitHubs filredigerare.
5. Spara ändringarna på GitHub. Om din aktuella kod har fler ändringar än designuppdateringen behöver dessa först jämföras med paketets filer.

Alla filer i själva uppdateringspaketet hör till projektet, inklusive start- och backupskripten. Inga interna test- eller paketeringsverktyg ingår.

## Installera och starta på Windows

Installera [Docker Desktop för Windows](https://docs.docker.com/desktop/setup/install/windows-install/). Följ installationsprogrammets instruktioner om WSL 2 och eventuell omstart. Docker Compose ingår. Du behöver inte installera PostgreSQL, MongoDB, Node eller Python separat.

1. Starta Docker Desktop och vänta tills det är igång.
2. Ladda ner det uppdaterade **hela projektet** från GitHub: Code → Download ZIP. Packa upp till en fast mapp, exempelvis `C:\Projekt\AccountPro`. Uppdateringspaketet ensamt är inte hela projektet.
3. Dubbelklicka på `start-local.cmd` i projektmappen. Första starten hämtar och bygger nödvändiga delar och kan ta flera minuter. Internet behövs vid byggandet.
4. Öppna **http://localhost:5173** när startkontrollen är klar.
5. Skapa ett konto och bolag. Förhandsvisningens testkonto finns inte automatiskt i databasen.

Alternativt, i en terminal i projektmappen:

```powershell
docker compose up --build -d --wait --wait-timeout 180
```

På macOS/Linux kan samma kommando användas med Docker installerat, eller `sh scripts/run-local.sh`.

## Stoppa, uppdatera och säkerhetskopiera

Dubbelklicka på `stop-local.cmd` för att stoppa tjänsterna. Databasen finns kvar i Docker-volymen `db_data` och används nästa gång du startar. Även vanlig `docker compose down` behåller volymen. **Använd inte `docker compose down -v` om du vill behålla data.** Att radera Docker-volymer eller återställa Docker Desktop kan också radera databasen.

Vid senare koduppdateringar: säkerhetskopiera först, uppdatera filerna i **samma projektmapp** och kör `start-local.cmd` igen. Compose använder mappnamnet som projektnamn; en annan mapp kan därför få en ny, tom databas.

För SQL-säkerhetskopia, kör i PowerShell i projektmappen medan Docker-tjänsterna körs:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backup-local.ps1
```

Kopian hamnar i `backups`. Kopiera den gärna till en separat säker plats. Mappen är undantagen från Git. En Docker-volym är beständig lagring, men inte en säkerhetskopia.

## Lovable och webbförhandsvisning

Vanlig utvecklingsstart och Lovable använder webbläsarlagring som standard. Lovables värdnamn väljer också detta läge. Inga lokala Docker-tjänster behövs för att titta på sidan. Du kan använda testkontot `test@test.com` med lösenord `test`, eller skapa ett testkonto och testbolag.

Förhandsvisningen visar texten ”Förhandsvisning · sparas endast i denna webbläsare”. Uppgifterna ligger kvar i den webbläsaren tills webbplatsdata rensas; de raderas alltså inte automatiskt när en flik stängs. De synkas inte till GitHub, andra datorer eller din lokala PostgreSQL-databas. Inkognitofönster ger en separat tillfällig testmiljö. Browserdata som fanns före uppdateringen importeras inte automatiskt till databasen.

Använd förhandsvisningen för testuppgifter. Serverberoende funktioner, exempelvis verkliga anslutningsförfrågningar mellan användare, kräver databasläget. Rapportförhandsvisningar som kräver serverns skript ger exempel-PDF i webbläsarläget.

Sätt inte `VITE_STORAGE_MODE=database` eller `VITE_DATABASE_CONNECTED=true` i Lovables miljöinställningar. Docker väljer databasläget automatiskt vid byggandet. Övriga egna förhandsvisningsdomäner kan uttryckligen använda `VITE_STORAGE_MODE=local`.

## Vad som sparas lokalt

PostgreSQL används eftersom projektet redan hade en backend byggd för den databasen. Konton, bolag, kunder och produkter använder befintliga databastabeller. Tidigare webbläsarlagrade uppgifter som verifikationer med bilagor, kvitton, fakturor, checklistor, låsningar, kommentarer och utkast sparas nu också per bolag i databasen. Personliga inställningar har separat användarlagring. Visningsval som ljust/mörkt läge och inloggningssession ligger fortfarande i webbläsaren.

Vänta tills ”Sparat i lokal databas” visas innan du stänger. Vid fel visas en varning och möjlighet att försöka spara igen eller exportera osparade ändringar. En återställningskopia ligger i webbläsaren medan en ändring väntar på databasen, så långt webbläsarens lagringsutrymme räcker. Samtidiga ändringar i olika flikar får inte skriva över varandra tyst. Exportera ändringarna om en versionskonflikt visas. Exporten är en återställningsfil, inte en automatisk importfunktion.

Den samlade kompletterande bolagslagringen har en gräns på 40 MB, inklusive kodade bilagor. Detta är en enkel lokal lösning; stora bilagearkiv behöver separat fillagring.

## Om något inte startar

- Kontrollera att Docker Desktop är igång och använder Linux-containrar.
- Om port 5173 redan används, stoppa den andra lokala sidan.
- Visa status med `docker compose ps` och felloggar med `docker compose logs --tail=100`.
- Om första bygget misslyckas på grund av nätverket, kontrollera internetanslutningen och starta igen.
- Om startkontrollen tar slut men tjänsterna fortfarande startar, kontrollera loggarna och kör startfilen igen.

Tjänsten exponeras endast på din egen dator, via `127.0.0.1:5173`. Backendens befintliga användarmodell är avsedd för lokal körning och ska inte exponeras som publik internettjänst.

## Verifiering av denna uppdatering

Frontendens typkontroll och produktionsbygge samt API- och webbläsartester kontrolleras under utvecklingen. API-testerna använder en isolerad SQLite-testdatabas. Docker Desktop saknades i arbetsmiljön, så en full Docker-start, PostgreSQL-migreringarna och körning i ditt faktiska Lovable-projekt kunde inte verifieras där. Startfilen kontrollerar både webbservern och databasanslutningen på din dator.
