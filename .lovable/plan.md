

## Plan: Komplett svensk momsmodul (K2-only)

Bygg en professionell svensk momsmodul som ersätter den nuvarande grunda VAT-sidan, lägger till momskoder per fakturarad/verifikationsrad, momsinställningar per företag, momsrapport (Skatteverkets rutor), momsavstämning och periodlåsning. Samtidigt görs systemet **K2-only** (K3 tas bort från UI utan att bryta befintlig logik).

### 1. K2-only enforcement (utan att bryta logiken)

- **`AuthContext.tsx`**: Ändra `accountingStandard` typ till `'K2' | ''` i `CompanyProfile`. Bakåtkompatibilitet: data som kommer in som `'K3'` mappas tyst till `'K2'` (ingen K3-text visas).
- **`CompanyPage.tsx` & `CompanyGate.tsx`**: Ta bort K3-val från dropdown — antingen dölj fältet helt och hårdkoda K2, eller visa "Redovisningsstandard: **K2**" som låst info-rad. Översätt synliga texter som rör standarden till svenska.
- **`AccountingContexts.tsx`**: Behåll `getLatestBASAccounts("K3")`-anrop som *internt referensschema* (det används bara för att avgöra vilka konton som är "BAS-kärnkonton" vs. anpassade — det är ett internt schemaval, inte ett UI-val). Ingen UI-text påverkas.

### 2. Momskoder (frontend-modell)

Ny fil **`src/lib/vat/codes.ts`**:
- `VatCode` interface: `id`, `code` (t.ex. `SE25`), `namn`, `beskrivning`, `sats` (procent), `typ` (`utgående` | `ingående` | `båda`), `rapportRutor` (array av ruta-id), `aktiv`.
- Förvald lista (konfigurerbar — inte hårdkodad i UI):
  - SE25/SE12/SE6 (svensk försäljning)
  - SE0 (momsfri försäljning)
  - IN25/IN12/IN6 (svenska inköp, avdragsgill ingående)
  - REV-OUT / REV-IN (omvänd skattskyldighet)
  - EU-SALE-G / EU-SALE-S (EU-försäljning vara/tjänst)
  - EU-PURCH-G / EU-PURCH-S (EU-inköp med fiktiv moms)
  - IMPORT, EXPORT
- Helper: `getVatCodeById`, `getActiveVatCodes`, `calculateVatFromCode`.

Ny context **`src/contexts/VatContext.tsx`** (per företag, localStorage-persistens) för CRUD av momskoder och momsinställningar.

### 3. Företagsinställningar för moms

Ny sektion på **`CompanyPage.tsx`** (kort: "Momsinställningar"):
- Momsregistrerad (toggle)
- Momsregistrering gäller från (datum)
- Redovisningsperiod: månad / kvartal / år
- Redovisningsmetod: faktureringsmetoden / bokslutsmetoden
- Standardmomskod för försäljning, inköp
- Markera om företaget säljer momsfritt / inom EU / utanför EU / omvänd moms
- Hjälptexter på svenska

Sparas i `CompanyProfile.vatSettings` (utökning av interfacet).

### 4. Momskod på fakturarader och verifikationer

- **`InvoiceLine`** (i `lib/billing/types.ts`): lägg till `vatCodeId?: string`.
- **`CreateInvoiceDialog.tsx`**: Ersätt fri `vatRate`-input med dropdown av aktiva momskoder (visar `kod — namn (sats%)`). Sats härleds från koden men kan fortfarande visas. Lägg till växlingsläge "Pris exkl./inkl. moms" som räknar om automatiskt.
- **`VoucherLine`** (i `AccountingContexts.tsx`): lägg till `vatCodeId?: string` (valfritt fält, påverkar inte befintliga vouchers).
- **`VoucherForm.tsx`**: Lägg till valfri momskod-kolumn per rad + en "Momspåverkan"-preview som visar vilka rutor raden träffar.

### 5. Ny sida: Moms (översikt)

Skapa **`src/pages/economy/MomsPage.tsx`** (rutt `/economy/moms`, lägg till i `App.tsx` + `EconomySidebar.tsx`):
- Visar aktuell momsperiod (baserat på företagets inställning)
- Status-chip: Pågående / Klar att granska / Låst
- Summeringskort: Utgående moms, Ingående moms, Att betala/få tillbaka
- Varningskort (gula/röda): saknade momskoder, ofullständiga fakturor, momsfri försäljning med moms etc.
- Knappar: "Öppna momsrapport", "Markera som granskad", "Lås period"

Befintlig `VATReportPage.tsx` flyttas/ersätts av denna översikt + en separat detaljerad rapportsida.

### 6. Momsrapport (Skatteverkets rutor)

Ny komponent **`MomsRapportTable.tsx`** under Moms-sidan (eller egen rutt `/economy/moms/rapport`):
- Rutor: 05, 06, 07, 08, 10, 11, 12, 20, 21, 22, 23, 24, 30, 31, 32, 48, 49, 60, 61, 62
- Per rad: rutnummer, beskrivning, belopp, drill-down-knapp
- Drill-down öppnar dialog med lista över verifikationer/fakturor som påverkar rutan
- Varning för orimliga värden (t.ex. negativ försäljning, ruta 49 ≠ 10+11+12-(48))
- Beräkning baseras på `vatCodeId` på rader → `rapportRutor`-mappning

### 7. Momsavstämning

Ny komponent **`MomsAvstämning.tsx`**:
- Tabell som jämför: Bokförd försäljning (3xxx) vs ruta 05+06+07, bokförd utgående moms (2610-2619) vs ruta 10+11+12, bokförd ingående moms (2640-2649) vs ruta 48, föregående periods saldon
- Differenskolumn med färgmarkering + förklaringstext

### 8. Periodlåsning för moms

Återanvänd mönstret från `FiscalLockContext`:
- Ny **`VatPeriodLockContext.tsx`** med `lockedPeriods: string[]` (format `2025-Q1`, `2025-03`, `2025`)
- API: `lockVatPeriod`, `unlockVatPeriod`, `isPeriodLocked`
- I Voucher/Invoice-skapande: kontroll mot låst momsperiod → blockera ändringar med dialog "Använd rättelseverifikation eller kreditfaktura"
- Visa låst-banner i Moms-översikten och momsrapporten

### 9. Validering & varningar

Centraliserad validering i `lib/vat/validation.ts`:
- Faktura saknar momskod → varning vid skapande
- Företag ej momsregistrerat men moms används → blockera
- Momsfri kod men momsbelopp > 0 → blockera
- Omvänd moms utan hänvisningstext på faktura → varning
- Försök ändra låst period → blockera med tydligt felmeddelande

### 10. Navigation & sidebar

- Lägg till "Moms" i `EconomySidebar.tsx` (ikon: `Calculator` eller `Percent`) med underflikar via tabbar på sidan: Översikt / Rapport / Avstämning
- Ta bort eller döp om gamla "VAT Report"-länken → ersätts av "Moms"
- Allt UI-text på svenska för momsmodulen

### Filer som skapas
- `src/lib/vat/codes.ts`, `src/lib/vat/validation.ts`, `src/lib/vat/reportBoxes.ts`
- `src/contexts/VatContext.tsx`, `src/contexts/VatPeriodLockContext.tsx`
- `src/pages/economy/MomsPage.tsx`
- `src/components/vat/MomsRapportTable.tsx`, `MomsRapportDrillDown.tsx`, `MomsAvstämning.tsx`, `MomsPeriodChip.tsx`, `LåsPeriodDialog.tsx`, `VarningKort.tsx`, `MomskodDropdown.tsx`

### Filer som ändras
- `src/contexts/AuthContext.tsx` (K2-only typ + vatSettings)
- `src/pages/CompanyPage.tsx` (ta bort K3, lägg momsinställningar)
- `src/pages/CompanyGate.tsx` (ta bort K3-val)
- `src/lib/billing/types.ts` (lägg `vatCodeId` på rad)
- `src/components/billing/CreateInvoiceDialog.tsx` (momskod-dropdown, exkl/inkl-toggle)
- `src/contexts/AccountingContexts.tsx` (lägg `vatCodeId` på `VoucherLine`)
- `src/components/accounting/VoucherForm.tsx` (momskod per rad + preview)
- `src/pages/economy/VATReportPage.tsx` (ersätts/byggs om till svensk version eller redirect till `/economy/moms`)
- `src/components/layout/EconomySidebar.tsx` (Moms-länk)
- `src/App.tsx` (provider + rutt)

### Punktlista — det som ska göras

1. Gör systemet K2-only i UI (dölj/hårdkoda K2, behåll datakompabilitet).
2. Skapa frontend-modell för momskoder + förvald svensk lista (konfigurerbar).
3. Lägg `VatContext` + `VatPeriodLockContext` (localStorage per företag).
4. Lägg momsinställningar i företagsinställningar (svenska).
5. Lägg `vatCodeId` på fakturarad + visa momskod-dropdown i fakturadialogen, samt exkl./inkl.-toggle.
6. Lägg `vatCodeId` på verifikationsrad + visa momspåverkan-preview i `VoucherForm`.
7. Skapa ny svensk **Moms-sida** (översikt) i sidomenyn med statuschip, summeringar, varningar, knappar.
8. Skapa **Momsrapport** med alla Skatteverket-rutor + drill-down per ruta.
9. Skapa **Momsavstämning** som jämför bokföring vs rapportrutor vs föregående period.
10. Implementera **periodlåsning** med rättelse-flöde och blockering av ändringar i låsta perioder.
11. Lägg till svensk validering: saknad momskod, ej momsregistrerad, momsfri med moms, omvänd utan hänvisning.
12. Översätt all momsrelaterad UI till svenska, ta bort all K3-text.

