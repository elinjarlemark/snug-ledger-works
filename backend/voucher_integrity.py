"""Server-side safeguards for AccountPro's posted vouchers and original receipts.

Posted vouchers are immutable. Subsequent reversal references are separate metadata
and therefore are deliberately excluded from the immutable posting snapshot.
The database transaction is committed by workspace.write_workspace, not here.
"""

import json
from datetime import date
from decimal import Decimal, InvalidOperation
from collections import Counter

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models import PostedVoucherRecord


# Fields that constitute the original posting. `reversedByVoucherId` and
# `reversedByVoucherNumber` are intentionally omitted: they may be added when
# a separate, immutable reversal voucher is posted.
VOUCHER_FIELDS = (
    "id", "companyId", "voucherNumber", "date", "description", "lines",
    "attachments", "createdAt", "documentDate", "party", "partyId",
    "postedAt", "postedByUserId", "postedByName", "status",
    "reversesVoucherId", "reversesVoucherNumber", "originalSeries",
    "originalVoucherNumber", "importSourceId", "importedAt",
)

# An original receipt cannot be changed or reassigned after linking it to a
# posted voucher. Additional receipts may be appended with their own IDs.
RECEIPT_FIELDS = ("id", "companyId", "name", "type", "dataUrl", "createdAt")


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
            if voucher.get("reversesVoucherNumber") != original.get("voucherNumber"):
                raise HTTPException(409, "Originalets verifikationsnummer stämmer inte")
            if original.get("reversedByVoucherId") != voucher["id"] or original.get("reversedByVoucherNumber") != voucher["voucherNumber"]:
                raise HTTPException(409, "Originalet och vändningen måste vara länkade åt båda håll")
            reversals[original_id] += 1
            if reversals[original_id] > 1:
                raise HTTPException(409, "En verifikation får inte vändas två gånger")
            # A reversal must actually cancel each entry in the original.
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
            if not target or target.get("reversesVoucherId") != voucher["id"] or target.get("voucherNumber") != voucher.get("reversedByVoucherNumber"):
                raise HTTPException(409, "Originalet hänvisar inte till en giltig vändning")


def check_workspace_vouchers(db: Session, company_id: int, old: dict, new: dict, user_id: int) -> None:
    """Check every workspace save and append new postings to the SQL ledger."""
    key = f"accountpro_vouchers_{company_id}"
    existing = {
        record.voucher_id: record
        for record in db.query(PostedVoucherRecord)
        .filter_by(company_id=company_id)
        .with_for_update()
        .all()
    }
    if key not in old and key not in new and not existing:
        return

    old_rows = parse_array(old, key)
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

    used_numbers: set[int] = set()
    for voucher in new_rows:
        if voucher.get("status") == "DRAFT":
            raise HTTPException(status_code=409, detail="Utkast får inte ligga bland bokförda verifikationer")
        number = voucher.get("voucherNumber")
        if not isinstance(number, int) or isinstance(number, bool) or number in used_numbers:
            raise HTTPException(status_code=409, detail="Verifikationsnumret är ogiltigt eller förekommer mer än en gång")
        used_numbers.add(number)
        if voucher["id"] not in existing:
            # Historical records in the previous workspace become immutable
            # snapshots without rewriting them or claiming they were newly booked.
            if voucher["id"] not in {record.get("id") for record in old_rows}:
                if str(voucher.get("companyId")) != str(company_id):
                    raise HTTPException(409, "Verifikationen tillhör ett annat företag")
                if voucher.get("status") != "POSTED":
                    raise HTTPException(409, "En ny bokförd verifikation måste ha status POSTED")
                validate_posting(voucher)
            db.add(
                PostedVoucherRecord(
                    company_id=company_id,
                    voucher_id=voucher["id"],
                    voucher_number=number,
                    payload_json=canonical(voucher),
                    registered_by_user_id=user_id,
                )
            )

    _validate_reversal_links(new_by_id)


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
        if (original.get("voucherId") != updated.get("voucherId") or
                original.get("voucherNumber") != updated.get("voucherNumber")):
            raise HTTPException(status_code=409, detail="Kopplat originalunderlag får inte lossas eller flyttas")
