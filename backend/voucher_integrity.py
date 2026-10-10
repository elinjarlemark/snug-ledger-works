"""Server-side safeguards for AccountPro's posted vouchers and original receipts.

Posted vouchers are immutable. Subsequent reversal references are separate metadata
and therefore are deliberately excluded from the immutable posting snapshot.
The database transaction is committed by workspace.write_workspace, not here.

Voucher numbering is scoped by company + fiscal year + internal series.  The
workspace endpoint can opt in to server-side allocation by passing
``allocate_numbers=True``.  Keeping that switch explicit lets older callers keep
working while the frontend is migrated to the database-owned number sequence.
"""

import json
import re
from collections import Counter
from datetime import date
from decimal import Decimal, InvalidOperation

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from models import Company, PostedVoucherRecord


# Fields that constitute the original posting. `reversedByVoucherId` and
# `reversedByVoucherNumber` are intentionally omitted: they may be added when
# a separate, immutable reversal voucher is posted.
VOUCHER_FIELDS = (
    "id", "companyId", "voucherNumber", "series", "date", "description", "lines",
    "attachments", "createdAt", "documentDate", "party", "partyId",
    "postedAt", "postedByUserId", "postedByName", "status",
    "reversesVoucherId", "reversesVoucherNumber", "originalSeries",
    "originalVoucherNumber", "importSourceId", "importedAt",
)

# An original receipt cannot be changed or reassigned after linking it to a
# posted voucher. Additional receipts may be appended with their own IDs.
RECEIPT_FIELDS = ("id", "companyId", "name", "type", "dataUrl", "createdAt")

_SERIES_RE = re.compile(r"^[A-Z][A-Z0-9]{0,9}$")


def canonical(voucher: dict) -> str:
    """Stable representation of the immutable part of a voucher."""
    return json.dumps(
        {key: voucher[key] for key in VOUCHER_FIELDS if key in voucher},
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    )


def parse_array(values: dict, key: str) -> list[dict]:
    raw = values.get(key, "[]")
    try:
        rows = json.loads(raw)
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail=f"Felaktiga data i {key}")
    if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
        raise HTTPException(status_code=422, detail=f"Felaktiga data i {key}")
    return rows


def normalize_series(value: object, fallback: str = "A") -> str:
    """Return a normalized internal voucher series such as A, B or C."""
    raw = value if isinstance(value, str) and value.strip() else fallback
    series = str(raw).strip().upper()
    if not _SERIES_RE.fullmatch(series):
        raise HTTPException(
            status_code=422,
            detail="Verifikationsserien måste börja med en bokstav och vara högst 10 tecken (A-Z, 0-9).",
        )
    return series


def _configured_fiscal_start(value: str | None) -> tuple[int, int]:
    raw = (value or "01-01").strip()
    if len(raw) == 5 and raw[2] == "-":
        month_text, day_text = raw.split("-", 1)
    elif len(raw) == 10 and raw[4] == "-" and raw[7] == "-":
        month_text, day_text = raw[5:7], raw[8:10]
    else:
        raise HTTPException(status_code=422, detail="Företagets räkenskapsårsstart är ogiltig")

    try:
        month = int(month_text)
        day = int(day_text)
        date(2000, month, day)
    except ValueError:
        raise HTTPException(status_code=422, detail="Företagets räkenskapsårsstart är ogiltig")
    return month, day


def fiscal_year_start_for_date(posting_date: object, configured_start: str | None) -> str:
    """Return the ISO start date for the fiscal year containing posting_date."""
    if not isinstance(posting_date, str):
        raise HTTPException(status_code=422, detail="Bokförd verifikation saknar giltigt datum")
    try:
        transaction_date = date.fromisoformat(posting_date)
    except ValueError:
        raise HTTPException(status_code=422, detail="Ogiltigt verifikationsdatum")

    month, day = _configured_fiscal_start(configured_start)
    start_year = transaction_date.year
    if (transaction_date.month, transaction_date.day) < (month, day):
        start_year -= 1
    try:
        return date(start_year, month, day).isoformat()
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail="Räkenskapsårsstarten kan inte användas för verifikationens datum",
        )


def _sequence_at_least(
    db: Session,
    company_id: int,
    fiscal_year_start: str,
    series: str,
    number: int,
) -> None:
    """Make the database counter at least number without ever moving it back."""
    if number <= 0:
        return
    db.execute(
        text(
            """
            INSERT INTO voucher_number_sequences
                (company_id, fiscal_year_start, series, last_number)
            VALUES
                (:company_id, :fiscal_year_start, :series, :number)
            ON CONFLICT (company_id, fiscal_year_start, series)
            DO UPDATE SET
                last_number = GREATEST(voucher_number_sequences.last_number, EXCLUDED.last_number),
                updated_at = CURRENT_TIMESTAMP
            """
        ),
        {
            "company_id": company_id,
            "fiscal_year_start": fiscal_year_start,
            "series": series,
            "number": number,
        },
    )


def _allocate_next_number(
    db: Session,
    company_id: int,
    fiscal_year_start: str,
    series: str,
) -> int:
    """Atomically allocate the next number inside the caller's transaction."""
    result = db.execute(
        text(
            """
            INSERT INTO voucher_number_sequences
                (company_id, fiscal_year_start, series, last_number)
            VALUES
                (:company_id, :fiscal_year_start, :series, 1)
            ON CONFLICT (company_id, fiscal_year_start, series)
            DO UPDATE SET
                last_number = voucher_number_sequences.last_number + 1,
                updated_at = CURRENT_TIMESTAMP
            RETURNING last_number
            """
        ),
        {
            "company_id": company_id,
            "fiscal_year_start": fiscal_year_start,
            "series": series,
        },
    ).scalar_one()
    return int(result)


def _posting_amount(value: object) -> Decimal:
    try:
        amount = Decimal(str(value))
        if not amount.is_finite() or amount < 0 or amount != amount.quantize(Decimal("0.01")):
            raise ValueError
    except (InvalidOperation, ValueError, TypeError):
        raise HTTPException(status_code=422, detail="Belopp måste vara giltiga, icke-negativa och anges i hela ören")
    return amount


def validate_posting(voucher: dict) -> None:
    number = voucher.get("voucherNumber")
    if not isinstance(number, int) or isinstance(number, bool) or number < 0:
        raise HTTPException(status_code=422, detail="Bokförd verifikation saknar giltigt nummer")

    if "series" in voucher:
        normalize_series(voucher.get("series"))

    if number == 0 and voucher.get("description") != "Ingående balans från SIE":
        raise HTTPException(status_code=422, detail="Nummer 0 är reserverat för ingående balans")
    if number == 0 and not voucher.get("importSourceId"):
        # An existing, unmodified legacy opening balance is handled below.
        raise HTTPException(status_code=422, detail="Ingående balans får endast skapas genom en verifierad SIE-import")

    raw_date = voucher.get("date")
    if not isinstance(raw_date, str) or not isinstance(voucher.get("description"), str) or not voucher["description"].strip():
        raise HTTPException(status_code=422, detail="Bokförd verifikation saknar datum eller beskrivning")
    try:
        posted_date = date.fromisoformat(raw_date)
    except ValueError:
        raise HTTPException(status_code=422, detail="Ogiltigt verifikationsdatum")
    if posted_date > date.today() and not voucher.get("importSourceId"):
        raise HTTPException(status_code=422, detail="Det går inte att bokföra framtida datum")

    lines = voucher.get("lines")
    if not isinstance(lines, list):
        raise HTTPException(status_code=422, detail="Verifikationen saknar bokföringsrader")

    debit = Decimal("0")
    credit = Decimal("0")
    posting_lines = 0
    accounts: set[str] = set()

    for line in lines:
        if not isinstance(line, dict):
            raise HTTPException(status_code=422, detail="Ogiltig verifikationsrad")
        d = _posting_amount(line.get("debit", 0))
        c = _posting_amount(line.get("credit", 0))
        if d and c:
            raise HTTPException(status_code=422, detail="En rad får inte ha belopp i både debet och kredit")
        if d or c:
            account = line.get("accountNumber")
            if not isinstance(account, str) or not account.strip():
                raise HTTPException(status_code=422, detail="Konto saknas på verifikationsrad")
            posting_lines += 1
            accounts.add(account.strip())
            debit += d
            credit += c

    if posting_lines < 2 or len(accounts) < 2 or debit <= 0 or debit != credit:
        raise HTTPException(status_code=422, detail="Verifikationen måste ha två olika konton och balansera exakt")


def _validate_reversal_links(by_id: dict[str, dict]) -> None:
    """Verify reversals independently of the browser's own validation."""
    reversals: Counter = Counter()
    for voucher in by_id.values():
        original_id = voucher.get("reversesVoucherId")
        if original_id:
            original = by_id.get(original_id)
            if original is None or original_id == voucher["id"] or original.get("voucherNumber") == 0:
                raise HTTPException(409, "Vändningen hänvisar till en ogiltig originalverifikation")
            reversal_series = normalize_series(voucher.get("series"))
            original_series = normalize_series(original.get("series"))
            if reversal_series != original_series:
                raise HTTPException(409, "En vändning måste ligga i samma verifikationsserie som originalet")
            if voucher.get("reversesVoucherNumber") != original.get("voucherNumber"):
                raise HTTPException(409, "Originalets verifikationsnummer stämmer inte")
            if original.get("reversedByVoucherId") != voucher["id"] or original.get("reversedByVoucherNumber") != voucher["voucherNumber"]:
                raise HTTPException(409, "Originalet och vändningen måste vara länkade åt båda håll")
            reversals[original_id] += 1
            if reversals[original_id] > 1:
                raise HTTPException(409, "En verifikation får inte vändas två gånger")

            def entry_counter(lines: list, reverse: bool) -> Counter:
                result = Counter()
                for line in lines:
                    debit = _posting_amount(line.get("credit" if reverse else "debit", 0))
                    credit = _posting_amount(line.get("debit" if reverse else "credit", 0))
                    if debit or credit:
                        result[(line.get("accountNumber"), debit, credit, line.get("vatCodeId"))] += 1
                return result

            if entry_counter(original.get("lines", []), True) != entry_counter(voucher.get("lines", []), False):
                raise HTTPException(409, "En vändning måste innehålla originalets konteringar med omvänd debet och kredit")
        elif voucher.get("reversedByVoucherId") or voucher.get("reversedByVoucherNumber"):
            target = by_id.get(voucher.get("reversedByVoucherId"))
            if (
                not target
                or target.get("reversesVoucherId") != voucher["id"]
                or target.get("voucherNumber") != voucher.get("reversedByVoucherNumber")
                or normalize_series(target.get("series")) != normalize_series(voucher.get("series"))
            ):
                raise HTTPException(409, "Originalet hänvisar inte till en giltig vändning i samma verifikationsserie")


def _update_number_references(
    new: dict,
    company_id: int,
    assignments: dict[str, dict[str, object]],
) -> None:
    """Keep reversal and receipt metadata aligned with server assignments."""
    if not assignments:
        return

    voucher_key = f"accountpro_vouchers_{company_id}"
    vouchers = parse_array(new, voucher_key)
    for voucher in vouchers:
        target_id = voucher.get("reversedByVoucherId")
        assignment = assignments.get(target_id)
        if assignment and isinstance(assignment.get("voucherNumber"), int):
            voucher["reversedByVoucherNumber"] = int(assignment["voucherNumber"])
    new[voucher_key] = json.dumps(vouchers, ensure_ascii=False, separators=(",", ":"))

    receipt_key = f"accountpro_receipts_{company_id}"
    if receipt_key in new:
        receipts = parse_array(new, receipt_key)
        for receipt in receipts:
            assignment = assignments.get(receipt.get("voucherId"))
            if not assignment:
                continue
            if isinstance(assignment.get("voucherNumber"), int):
                receipt["voucherNumber"] = int(assignment["voucherNumber"])
            if isinstance(assignment.get("series"), str):
                receipt["voucherSeries"] = str(assignment["series"])
        new[receipt_key] = json.dumps(receipts, ensure_ascii=False, separators=(",", ":"))


def check_workspace_vouchers(
    db: Session,
    company_id: int,
    old: dict,
    new: dict,
    user_id: int,
    *,
    allocate_numbers: bool = False,
) -> dict[str, dict[str, object]]:
    """Validate a workspace save and append newly posted vouchers to SQL.

    When ``allocate_numbers`` is true, the database assigns the definitive
    positive voucher number for every genuinely new posting.  The supplied
    ``new`` workspace dictionary is updated in-place so its JSON can be stored
    in the same transaction.  Number 0 remains reserved for imported opening
    balance.
    """
    key = f"accountpro_vouchers_{company_id}"
    existing = {
        record.voucher_id: record
        for record in db.query(PostedVoucherRecord)
        .filter_by(company_id=company_id)
        .with_for_update()
        .all()
    }
    if key not in old and key not in new and not existing:
        return {}

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Företaget finns inte")
    default_series = normalize_series(company.default_voucher_series or "A")

    old_rows = parse_array(old, key)
    old_ids = {record.get("id") for record in old_rows if isinstance(record.get("id"), str)}
    new_rows = parse_array(new, key)
    new_by_id: dict[str, dict] = {}
    for voucher in new_rows:
        ident = voucher.get("id")
        if not isinstance(ident, str) or not ident or ident in new_by_id:
            raise HTTPException(status_code=409, detail="Ogiltiga eller dubblerade verifikations-ID")
        new_by_id[ident] = voucher

    # Protect every legacy voucher that predates creation of SQL snapshots.
    for original in old_rows:
        ident = original.get("id")
        if ident not in new_by_id:
            raise HTTPException(status_code=409, detail="En bokförd verifikation får inte raderas")
        if canonical(original) != canonical(new_by_id[ident]):
            raise HTTPException(status_code=409, detail="En bokförd verifikation får inte ändras. Skapa en rättelse.")

    # Never permit a snapshot to disappear even if workspace data is damaged.
    for ident, record in existing.items():
        updated = new_by_id.get(ident)
        if updated is None:
            raise HTTPException(status_code=409, detail="En registrerad verifikation saknas i arbetsytan")
        if record.payload_json != canonical(updated):
            raise HTTPException(status_code=409, detail="Det sparade originalet skiljer sig från verifikationen")

    # Seed/guard existing and legacy identities before allocating any new ones.
    used_numbers: set[tuple[str, str, int]] = set()
    opening_balance_years: set[str] = set()
    for voucher in new_rows:
        if voucher.get("status") == "DRAFT":
            raise HTTPException(status_code=409, detail="Utkast får inte ligga bland bokförda verifikationer")
        ident = voucher["id"]
        if ident in existing:
            record = existing[ident]
            identity = (record.fiscal_year_start, record.series, record.voucher_number)
            if identity in used_numbers:
                raise HTTPException(status_code=409, detail="Verifikationsnumret förekommer mer än en gång i samma serie och räkenskapsår")
            used_numbers.add(identity)
            if record.voucher_number == 0:
                if record.fiscal_year_start in opening_balance_years:
                    raise HTTPException(status_code=409, detail="Det finns mer än en ingående balans för samma räkenskapsår")
                opening_balance_years.add(record.fiscal_year_start)
            continue

        # Historical workspace rows without an SQL snapshot retain their number.
        if ident in old_ids:
            number = voucher.get("voucherNumber")
            if not isinstance(number, int) or isinstance(number, bool) or number < 0:
                raise HTTPException(status_code=409, detail="Verifikationsnumret är ogiltigt")
            series = normalize_series(voucher.get("series"), default_series)
            fiscal_start = fiscal_year_start_for_date(voucher.get("date"), company.fiscal_year_start)
            identity = (fiscal_start, series, number)
            if identity in used_numbers:
                raise HTTPException(status_code=409, detail="Verifikationsnumret förekommer mer än en gång i samma serie och räkenskapsår")
            used_numbers.add(identity)
            if number == 0:
                if fiscal_start in opening_balance_years:
                    raise HTTPException(status_code=409, detail="Det finns mer än en ingående balans för samma räkenskapsår")
                opening_balance_years.add(fiscal_start)
            else:
                _sequence_at_least(db, company_id, fiscal_start, series, number)

    assignments: dict[str, dict[str, object]] = {}

    for voucher in new_rows:
        ident = voucher["id"]
        if ident in existing or ident in old_ids:
            continue

        if str(voucher.get("companyId")) != str(company_id):
            raise HTTPException(409, "Verifikationen tillhör ett annat företag")
        if voucher.get("status") != "POSTED":
            raise HTTPException(409, "En ny bokförd verifikation måste ha status POSTED")

        series = normalize_series(voucher.get("series"), default_series)
        fiscal_start = fiscal_year_start_for_date(voucher.get("date"), company.fiscal_year_start)
        supplied_number = voucher.get("voucherNumber")

        # Opening balance is a verified SIE-only special record and never
        # consumes a positive number from the regular series.
        if supplied_number == 0:
            assigned_number = 0
        elif allocate_numbers:
            assigned_number = _allocate_next_number(db, company_id, fiscal_start, series)
        else:
            if not isinstance(supplied_number, int) or isinstance(supplied_number, bool) or supplied_number <= 0:
                raise HTTPException(status_code=409, detail="Verifikationsnumret är ogiltigt")
            assigned_number = supplied_number
            _sequence_at_least(db, company_id, fiscal_start, series, assigned_number)

        voucher["voucherNumber"] = assigned_number
        if "series" in voucher or allocate_numbers:
            voucher["series"] = series

        identity = (fiscal_start, series, assigned_number)
        if identity in used_numbers:
            raise HTTPException(status_code=409, detail="Verifikationsnumret förekommer mer än en gång i samma serie och räkenskapsår")
        used_numbers.add(identity)
        if assigned_number == 0:
            if fiscal_start in opening_balance_years:
                raise HTTPException(status_code=409, detail="Det finns mer än en ingående balans för samma räkenskapsår")
            opening_balance_years.add(fiscal_start)

        assignments[ident] = {
            "voucherNumber": assigned_number,
            "series": series,
            "fiscalYearStart": fiscal_start,
        }

    # If numbers changed, update cross references before reversal validation and
    # before the immutable snapshots are created.
    if allocate_numbers and assignments:
        for voucher in new_rows:
            target_id = voucher.get("reversedByVoucherId")
            target_assignment = assignments.get(target_id)
            if target_assignment and isinstance(target_assignment.get("voucherNumber"), int):
                voucher["reversedByVoucherNumber"] = int(target_assignment["voucherNumber"])
        new[key] = json.dumps(new_rows, ensure_ascii=False, separators=(",", ":"))
        _update_number_references(new, company_id, assignments)
        new_rows = parse_array(new, key)
        new_by_id = {voucher["id"]: voucher for voucher in new_rows}

    for voucher in new_rows:
        ident = voucher["id"]
        if ident in existing:
            continue

        if ident in old_ids:
            series = normalize_series(voucher.get("series"), default_series)
            fiscal_start = fiscal_year_start_for_date(voucher.get("date"), company.fiscal_year_start)
            number = voucher.get("voucherNumber")
        else:
            data = assignments[ident]
            series = str(data["series"])
            fiscal_start = str(data["fiscalYearStart"])
            number = int(data["voucherNumber"])
            validate_posting(voucher)

        db.add(
            PostedVoucherRecord(
                company_id=company_id,
                voucher_id=ident,
                voucher_number=number,
                series=series,
                fiscal_year_start=fiscal_start,
                payload_json=canonical(voucher),
                registered_by_user_id=user_id,
            )
        )

    _validate_reversal_links(new_by_id)
    return assignments


def check_workspace_receipts(company_id: int, old: dict, new: dict) -> None:
    key = f"accountpro_receipts_{company_id}"
    if key not in old and key not in new:
        return
    previous = parse_array(old, key)
    current = parse_array(new, key)
    current_by_id: dict[str, dict] = {}
    for receipt in current:
        ident = receipt.get("id")
        if not isinstance(ident, str) or not ident or ident in current_by_id:
            raise HTTPException(status_code=409, detail="Ogiltiga eller dubblerade kvitto-ID")
        current_by_id[ident] = receipt

    for original in previous:
        if not original.get("voucherId"):
            continue  # Unlinked receipts are handled in the regular receipt flow.
        updated = current_by_id.get(original.get("id"))
        if updated is None:
            raise HTTPException(status_code=409, detail="Underlag till bokförd verifikation får inte raderas")
        if any(original.get(field) != updated.get(field) for field in RECEIPT_FIELDS):
            raise HTTPException(status_code=409, detail="Originalunderlaget får inte ändras")
        if (
            original.get("voucherId") != updated.get("voucherId")
            or original.get("voucherNumber") != updated.get("voucherNumber")
            or original.get("voucherSeries") != updated.get("voucherSeries")
        ):
            raise HTTPException(
                status_code=409,
                detail="Kopplat originalunderlag får inte lossas, flyttas eller byta verifikationsserie",
            )
