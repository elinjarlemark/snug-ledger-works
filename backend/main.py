import os
import logging
import time
from pathlib import Path
from datetime import datetime
from datetime import timedelta

from fastapi import FastAPI, Depends, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text

from alembic import command
from alembic.config import Config

from database import get_db, SessionLocal, DATABASE_URL
from passlib.context import CryptContext
from models import (
    User,
    SIEFile,
    Receipt,
    Company,
    CompanyMember,
    Customer,
    Product,
    CompanySIEState,
    CompanyLock,
    CompanyJoinRequest,
    CompanyJoinRequestStatus,
    CompanyLockTakeoverRequest,
    CompanyLockTakeoverStatus,
)

# ------------------------------------------------------------
# Logging
# ------------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("snug-api")

app = FastAPI()

@app.middleware("http")
async def log_login_request(request: Request, call_next):
    if request.url.path == "/auth/login":
        body = await request.body()
        logger.info("LOGIN RAW body: %s", body.decode("utf-8", errors="replace"))
        logger.info("LOGIN RAW content-type: %s", request.headers.get("content-type"))
    response = await call_next(request)
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------
# Exception handler: log traceback + return JSON
# ------------------------------------------------------------
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})


# ------------------------------------------------------------
# Schemas
# ------------------------------------------------------------
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    new_password: str


class RoleUpdateRequest(BaseModel):
    role: str


class SIEFileCreate(BaseModel):
    user_id: int
    filename: str
    storage_path: str
    period: str | None = None


class ReceiptCreate(BaseModel):
    user_id: int
    filename: str
    storage_path: str
    note: str | None = None


class CompanyCreate(BaseModel):
    user_id: int
    company_name: str
    organization_number: str | None = None
    address: str | None = None
    postal_code: str | None = None
    city: str | None = None
    country: str | None = None
    vat_number: str | None = None
    fiscal_year_start: str | None = None
    fiscal_year_end: str | None = None
    accounting_standard: str | None = None
    
    
class CompanyJoinRequestCreate(BaseModel):
    user_id: int
    organization_number: str


class CompanyJoinRequestDecide(BaseModel):
    user_id: int
    action: str  # 'approve' eller 'reject'
    
    
class CompanyLockPayload(BaseModel):
    user_id: int


class CompanyUpdate(BaseModel):
    company_name: str
    organization_number: str | None = None
    address: str | None = None
    postal_code: str | None = None
    city: str | None = None
    country: str | None = None
    vat_number: str | None = None
    fiscal_year_start: str | None = None
    fiscal_year_end: str | None = None
    accounting_standard: str | None = None


class CompanySIEStateUpsert(BaseModel):
    user_id: int
    sie_content: str
    

class CompanyLockRequest(BaseModel):
    user_id: int
    
    
class CompanyUnlockRequest(BaseModel):
    user_id: int


class CustomerCreate(BaseModel):
    user_id: int
    company_id: int | None = None
    type: str
    name: str
    organization_number: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str
    postal_code: str
    city: str
    country: str


class CustomerUpdate(BaseModel):
    type: str
    name: str
    organization_number: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str
    postal_code: str
    city: str
    country: str


class ProductCreate(BaseModel):
    user_id: int
    company_id: int | None = None
    name: str
    description: str | None = None
    price: float
    includes_vat: bool = False
    vat_rate: float = 25
    unit: str | None = None


class ProductUpdate(BaseModel):
    name: str
    description: str | None = None
    price: float
    includes_vat: bool = False
    vat_rate: float = 25
    unit: str | None = None


class JoinCompanyByOrgNumber(BaseModel):
    user_id: int
    organization_number: str


# ------------------------------------------------------------
# Password
# ------------------------------------------------------------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)
    
    
def is_company_admin_or_owner(db: Session, company_id: int, user_id: int) -> bool:
    membership = (
        db.query(CompanyMember)
        .filter(CompanyMember.company_id == company_id, CompanyMember.user_id == user_id)
        .first()
    )
    if not membership:
        return False
    return membership.role in ["OWNER", "ADMIN"]


# ------------------------------------------------------------
# DB / migrations helpers
# ------------------------------------------------------------
def wait_for_db(max_attempts: int = 45, delay_seconds: int = 2) -> None:
    last_exc: Exception | None = None
    for _ in range(max_attempts):
        try:
            db = SessionLocal()
            db.execute(text("SELECT 1"))
            db.close()
            logger.info("DB is ready.")
            return
        except Exception as exc:
            last_exc = exc
            logger.info("Waiting for DB...")
            time.sleep(delay_seconds)
    logger.exception("DB not ready after retries")
    if last_exc:
        raise last_exc
    raise RuntimeError("DB not ready")


def ensure_alembic_version_table():
    """
    Ensure alembic_version exists and its version_num can hold long revision IDs.
    """
    db = SessionLocal()
    try:
        db.execute(
            text("CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(128) NOT NULL PRIMARY KEY);")
        )
        # If someone created it with VARCHAR(32) earlier, expand it
        try:
            db.execute(text("ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR(128);"))
        except Exception:
            pass
        db.commit()
    finally:
        db.close()


def run_migrations_to_head():
    wait_for_db()
    ensure_alembic_version_table()

    alembic_ini = Path(__file__).with_name("alembic.ini")
    migrations_path = Path(__file__).parent / "alembic"

    cfg = Config(str(alembic_ini))
    cfg.set_main_option("script_location", str(migrations_path))
    cfg.set_main_option("sqlalchemy.url", DATABASE_URL)

    logger.info("Running migrations to head...")
    command.upgrade(cfg, "head")
    logger.info("Migrations complete.")


@app.on_event("startup")
def on_startup():
    try:
        run_migrations_to_head()
    except Exception:
        logger.exception("Startup migrations failed (API will error until fixed).")


# ------------------------------------------------------------
# Health
# ------------------------------------------------------------
@app.get("/health")
def health():
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        return {"status": "ok", "db": "ok"}
    except Exception:
        return {"status": "ok", "db": "unavailable"}


# ------------------------------------------------------------
# Users + Auth
# ------------------------------------------------------------
@app.get("/users")
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [{"id": u.id, "email": u.email, "name": u.name, "role": u.role} for u in users]


@app.post("/users")
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    user = User(email=payload.email, password=hash_password(payload.password), name=payload.name, role="user")
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email already exists")
    db.refresh(user)
    return {"id": user.id, "email": user.email, "name": user.name}


@app.post("/auth/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    logger.info("LOGIN payload received: email=%s password=%s", payload.email, len(payload.password or ""))
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password):
        return {"success": False, "error": "Invalid email or password"}
    return {"success": True, "user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role}}


@app.post("/auth/reset")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password = hash_password(payload.new_password)
    db.commit()
    return {"success": True}


@app.patch("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    payload: RoleUpdateRequest,
    db: Session = Depends(get_db),
    admin_token: str | None = Header(default=None, alias="X-Admin-Token"),
):
    header_token = admin_token or ""
    configured_token = os.getenv("ADMIN_TOKEN", "")
    if not configured_token or header_token != configured_token:
        raise HTTPException(status_code=401, detail="Unauthorized")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = payload.role
    db.commit()
    return {"success": True}


# ------------------------------------------------------------
# SIE files + receipts
# ------------------------------------------------------------
@app.post("/sie-files")
def create_sie_file(payload: SIEFileCreate, db: Session = Depends(get_db)):
    sie_file = SIEFile(
        user_id=payload.user_id,
        filename=payload.filename,
        storage_path=payload.storage_path,
        period=payload.period,
    )
    db.add(sie_file)
    db.commit()
    db.refresh(sie_file)
    return {"id": sie_file.id}


@app.post("/receipts")
def create_receipt(payload: ReceiptCreate, db: Session = Depends(get_db)):
    receipt = Receipt(
        user_id=payload.user_id,
        filename=payload.filename,
        storage_path=payload.storage_path,
        note=payload.note,
    )
    db.add(receipt)
    db.commit()
    db.refresh(receipt)
    return {"id": receipt.id}


# ------------------------------------------------------------
# Membership helpers
# ------------------------------------------------------------
def require_company_access(db: Session, company_id: int, user_id: int) -> CompanyMember:
    membership = (
        db.query(CompanyMember)
        .filter(
            CompanyMember.company_id == company_id,
            CompanyMember.user_id == user_id,
            CompanyMember.status == "ACTIVE",
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="No access to this company")
    return membership


def require_company_admin(db: Session, company_id: int, user_id: int) -> CompanyMember:
    membership = require_company_access(db, company_id, user_id)
    if membership.role not in ("OWNER", "ADMIN"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return membership
    

def _now_utc():
    # naive UTC datetime (matches your existing usage of datetime.utcnow)
    return datetime.utcnow()


def _lock_ttl_minutes() -> int:
    # you can later move this to env var if you want
    return 1


def _lock_expires_at():
    return _now_utc() + timedelta(minutes=_lock_ttl_minutes())


def _cleanup_expired_lock(db: Session, company_id: int):
    lock = db.query(CompanyLock).filter(CompanyLock.company_id == company_id).first()
    if not lock:
        return None
    if lock.expires_at <= _now_utc():
        db.delete(lock)
        db.commit()
        return None
    return lock


@app.get("/companies/{company_id}/lock")
def get_company_lock(company_id: int, user_id: int, db: Session = Depends(get_db)):
    # must have access to view lock
    require_company_access(db, company_id, user_id)

    lock = _cleanup_expired_lock(db, company_id)
    if not lock:
        return {"locked": False}

    u = db.query(User).filter(User.id == lock.locked_by_user_id).first()
    return {
        "locked": True,
        "companyId": company_id,
        "lockedBy": {"id": u.id, "email": u.email, "name": u.name} if u else {"id": lock.locked_by_user_id},
        "expiresAt": lock.expires_at.isoformat(),
        "lockedAt": lock.locked_at.isoformat() if lock.locked_at else None,
    }


@app.post("/companies/{company_id}/lock")
def lock_company(company_id: int, payload: CompanyLockRequest, db: Session = Depends(get_db)):
    # must have access to lock
    require_company_access(db, company_id, payload.user_id)

    lock = _cleanup_expired_lock(db, company_id)

    # No lock -> create lock for this user
    if not lock:
        new_lock = CompanyLock(
            company_id=company_id,
            locked_by_user_id=payload.user_id,
            locked_at=_now_utc(),
            expires_at=_lock_expires_at(),
        )
        db.add(new_lock)
        db.commit()
        return {"success": True, "companyId": company_id, "locked": True}

    # Lock exists and owned by same user -> extend TTL
    if lock.locked_by_user_id == payload.user_id:
        lock.expires_at = _lock_expires_at()
        db.commit()
        return {"success": True, "companyId": company_id, "locked": True, "alreadyOwned": True}

    # Lock exists and owned by someone else -> return info for popup
    u = db.query(User).filter(User.id == lock.locked_by_user_id).first()
    return {
        "success": False,
        "companyId": company_id,
        "locked": True,
        "lockedBy": {"id": u.id, "email": u.email, "name": u.name} if u else {"id": lock.locked_by_user_id},
        "expiresAt": lock.expires_at.isoformat(),
    }


TAKEOVER_REQUEST_SECONDS = 30


@app.post("/companies/{company_id}/takeover-request")
def create_takeover_request(company_id: int, payload: CompanyLockPayload, db: Session = Depends(get_db)):
    # user måste vara medlem för att få göra takeover
    member = (
        db.query(CompanyMember)
        .filter(
            CompanyMember.company_id == company_id,
            CompanyMember.user_id == payload.user_id,
            CompanyMember.status == "ACTIVE",
        )
        .first()
    )
    if not member:
        raise HTTPException(status_code=403, detail="No access to this company")
    user_id = int(payload.user_id)

    lock = db.query(CompanyLock).filter(CompanyLock.company_id == company_id).first()

    if not lock:
        return {"success": False, "message": "Company is not locked"}

    # finns redan pending request?
    existing = (
        db.query(CompanyLockTakeoverRequest)
        .filter(
            CompanyLockTakeoverRequest.company_id == company_id,
            CompanyLockTakeoverRequest.requested_by_user_id == user_id,
            CompanyLockTakeoverRequest.status == CompanyLockTakeoverStatus.PENDING,
        )
        .first()
    )

    if existing:
        return {
            "success": True,
            "alreadyRequested": True,
            "expiresAt": existing.expires_at.isoformat(),
        }

    expires = datetime.utcnow() + timedelta(seconds=TAKEOVER_REQUEST_SECONDS)

    req = CompanyLockTakeoverRequest(
        company_id=company_id,
        requested_by_user_id=user_id,
        status=CompanyLockTakeoverStatus.PENDING,
        expires_at=expires,
    )

    db.add(req)
    db.commit()

    return {
        "success": True,
        "requestId": req.id,
        "expiresAt": expires.isoformat(),
        "lockedByUserId": lock.locked_by_user_id,
    }


@app.get("/companies/{company_id}/takeover-requests")
def list_takeover_requests(company_id: int, db: Session = Depends(get_db)):
    now = datetime.utcnow()

    requests = (
        db.query(CompanyLockTakeoverRequest)
        .filter(
            CompanyLockTakeoverRequest.company_id == company_id,
            CompanyLockTakeoverRequest.status == CompanyLockTakeoverStatus.PENDING,
            CompanyLockTakeoverRequest.expires_at > now,
        )
        .all()
    )

    result = []

    for r in requests:
        user = db.query(User).filter(User.id == r.requested_by_user_id).first()

        result.append(
            {
                "id": r.id,
                "requestedBy": {
                    "id": r.requested_by_user_id,
                    "email": user.email if user else None,
                    "name": user.name if user else None,
                },
                "expiresAt": r.expires_at.isoformat(),
            }
        )

    return result
    
    
@app.post("/companies/takeover/{request_id}/approve")
def approve_takeover(request_id: int, payload: CompanyLockPayload, db: Session = Depends(get_db)):
    user_id = int(payload.user_id)

    req = db.query(CompanyLockTakeoverRequest).filter(CompanyLockTakeoverRequest.id == request_id).first()

    if not req:
        raise HTTPException(status_code=404, detail="Takeover request not found")

    if req.status != CompanyLockTakeoverStatus.PENDING:
        return {"success": False}

    lock = db.query(CompanyLock).filter(CompanyLock.company_id == req.company_id).first()

    if not lock:
        raise HTTPException(status_code=400, detail="Company not locked")

    # bara den som sitter inne får approve
    if lock.locked_by_user_id != user_id:
        raise HTTPException(status_code=403, detail="Not lock owner")

    req.status = CompanyLockTakeoverStatus.APPROVED
    req.decided_by_user_id = user_id
    req.decided_at = datetime.utcnow()

    lock.locked_by_user_id = req.requested_by_user_id
    lock.locked_at = datetime.utcnow()
    lock.expires_at = datetime.utcnow() + timedelta(seconds=60)

    db.commit()

    return {"success": True}
    
    
@app.post("/companies/takeover/{request_id}/reject")
def reject_takeover(request_id: int, payload: CompanyLockPayload, db: Session = Depends(get_db)):
    user_id = int(payload.user_id)

    req = db.query(CompanyLockTakeoverRequest).filter(CompanyLockTakeoverRequest.id == request_id).first()

    if not req:
        raise HTTPException(status_code=404, detail="Takeover request not found")

    if req.status != CompanyLockTakeoverStatus.PENDING:
        return {"success": False}

    lock = db.query(CompanyLock).filter(CompanyLock.company_id == req.company_id).first()

    if not lock:
        raise HTTPException(status_code=400, detail="Company not locked")

    if lock.locked_by_user_id != user_id:
        raise HTTPException(status_code=403, detail="Not lock owner")

    req.status = CompanyLockTakeoverStatus.REJECTED
    req.decided_by_user_id = user_id
    req.decided_at = datetime.utcnow()

    db.commit()

    return {"success": True}


@app.post("/companies/{company_id}/lock/heartbeat")
def lock_heartbeat(company_id: int, payload: CompanyLockRequest, db: Session = Depends(get_db)):
    # must have access
    require_company_access(db, company_id, payload.user_id)

    lock = _cleanup_expired_lock(db, company_id)
    if not lock:
        # If no lock, heartbeat behaves like "try lock"
        new_lock = CompanyLock(
            company_id=company_id,
            locked_by_user_id=payload.user_id,
            locked_at=_now_utc(),
            expires_at=_lock_expires_at(),
        )
        db.add(new_lock)
        db.commit()
        return {"success": True, "companyId": company_id, "locked": True, "created": True}

    if lock.locked_by_user_id != payload.user_id:
        u = db.query(User).filter(User.id == lock.locked_by_user_id).first()
        return {
            "success": False,
            "companyId": company_id,
            "locked": True,
            "lockedBy": {"id": u.id, "email": u.email, "name": u.name} if u else {"id": lock.locked_by_user_id},
            "expiresAt": lock.expires_at.isoformat(),
        }

    lock.expires_at = _lock_expires_at()
    db.commit()
    return {"success": True, "companyId": company_id, "locked": True, "extended": True}


@app.post("/companies/{company_id}/unlock")
def unlock_company(company_id: int, payload: CompanyUnlockRequest, db: Session = Depends(get_db)):
    # must have access
    require_company_access(db, company_id, payload.user_id)

    lock = db.query(CompanyLock).filter(CompanyLock.company_id == company_id).first()
    if not lock:
        return {"success": True, "companyId": company_id, "locked": False}

    # only owner of lock (or admin/owner) can unlock
    if lock.locked_by_user_id != payload.user_id:
        # allow admins/owners to break lock
        membership = db.query(CompanyMember).filter(
            CompanyMember.company_id == company_id,
            CompanyMember.user_id == payload.user_id,
            CompanyMember.status == "ACTIVE",
        ).first()
        if not membership or membership.role not in ("OWNER", "ADMIN"):
            u = db.query(User).filter(User.id == lock.locked_by_user_id).first()
            return {
                "success": False,
                "companyId": company_id,
                "locked": True,
                "lockedBy": {"id": u.id, "email": u.email, "name": u.name} if u else {"id": lock.locked_by_user_id},
                "expiresAt": lock.expires_at.isoformat(),
                "detail": "Locked by another user",
            }

    db.delete(lock)
    db.commit()
    return {"success": True, "companyId": company_id, "locked": False}


# ------------------------------------------------------------
# Company SIE State
# ------------------------------------------------------------
@app.get("/companies/{company_id}/sie-state")
def get_company_sie_state(company_id: int, user_id: int, db: Session = Depends(get_db)):
    require_company_access(db, company_id, user_id)
    state = db.query(CompanySIEState).filter(CompanySIEState.company_id == company_id).first()
    if not state:
        return {"companyId": company_id, "sieContent": None, "version": None, "updatedAt": None}

    return {
        "id": state.id,
        "companyId": state.company_id,
        "sieContent": state.sie_content,
        "version": state.version,
        "updatedAt": state.updated_at.isoformat() if state.updated_at else None,
        "updatedByUserId": state.updated_by_user_id,
    }


@app.put("/companies/{company_id}/sie-state")
def upsert_company_sie_state(company_id: int, payload: CompanySIEStateUpsert, db: Session = Depends(get_db)):
    # must have access
    membership = require_company_access(db, company_id, payload.user_id)

    # require lock (or allow OWNER/ADMIN to break)
    lock = _cleanup_expired_lock(db, company_id)
    if lock:
        if lock.locked_by_user_id != payload.user_id:
            # allow OWNER/ADMIN to force update (optional, but useful)
            if membership.role not in ("OWNER", "ADMIN"):
                u = db.query(User).filter(User.id == lock.locked_by_user_id).first()
                raise HTTPException(
                    status_code=409,
                    detail={
                        "message": "Company is locked by another user",
                        "lockedBy": {"id": u.id, "email": u.email, "name": u.name} if u else {"id": lock.locked_by_user_id},
                        "expiresAt": lock.expires_at.isoformat(),
                    },
                )
    else:
        # no lock at all -> require user to lock first
        raise HTTPException(
            status_code=409,
            detail={"message": "Company is not locked. Lock it before updating SIE."},
        )

    state = db.query(CompanySIEState).filter(CompanySIEState.company_id == company_id).first()
    if not state:
        state = CompanySIEState(
            company_id=company_id,
            sie_content=payload.sie_content,
            version=1,
            updated_by_user_id=payload.user_id,
        )
        db.add(state)
        db.commit()
        db.refresh(state)
        return {"id": state.id, "companyId": state.company_id, "version": state.version}

    state.sie_content = payload.sie_content
    state.version = (state.version or 1) + 1
    state.updated_by_user_id = payload.user_id
    db.commit()
    db.refresh(state)
    return {"id": state.id, "companyId": state.company_id, "version": state.version}


# ------------------------------------------------------------
# Customers
# ------------------------------------------------------------
@app.get("/customers")
def list_customers(user_id: int, db: Session = Depends(get_db)):
    customers = db.query(Customer).filter(Customer.user_id == user_id).all()
    return [
        {
            "id": c.id,
            "user_id": c.user_id,
            "company_id": c.company_id,
            "type": c.type,
            "name": c.name,
            "organizationNumber": c.organization_number,
            "email": c.email,
            "phone": c.phone,
            "address": c.address,
            "postalCode": c.postal_code,
            "city": c.city,
            "country": c.country,
        }
        for c in customers
    ]


@app.post("/customers")
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    customer = Customer(
        user_id=payload.user_id,
        company_id=payload.company_id,
        type=payload.type,
        name=payload.name,
        organization_number=payload.organization_number,
        email=payload.email,
        phone=payload.phone,
        address=payload.address,
        postal_code=payload.postal_code,
        city=payload.city,
        country=payload.country,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return {"id": customer.id}


@app.put("/customers/{customer_id}")
def update_customer(customer_id: int, payload: CustomerUpdate, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    customer.type = payload.type
    customer.name = payload.name
    customer.organization_number = payload.organization_number
    customer.email = payload.email
    customer.phone = payload.phone
    customer.address = payload.address
    customer.postal_code = payload.postal_code
    customer.city = payload.city
    customer.country = payload.country
    db.commit()
    return {"success": True}


@app.delete("/customers/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    db.delete(customer)
    db.commit()
    return {"success": True}


# ------------------------------------------------------------
# Products
# ------------------------------------------------------------
@app.get("/products")
def list_products(user_id: int, db: Session = Depends(get_db)):
    products = db.query(Product).filter(Product.user_id == user_id).all()
    return [
        {
            "id": p.id,
            "user_id": p.user_id,
            "company_id": p.company_id,
            "name": p.name,
            "description": p.description,
            "price": p.price,
            "includesVat": p.includes_vat,
            "vatRate": p.vat_rate,
            "unit": p.unit,
        }
        for p in products
    ]


@app.post("/products")
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    product = Product(
        user_id=payload.user_id,
        company_id=payload.company_id,
        name=payload.name,
        description=payload.description,
        price=payload.price,
        includes_vat=payload.includes_vat,
        vat_rate=payload.vat_rate,
        unit=payload.unit,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return {"id": product.id}


@app.put("/products/{product_id}")
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.name = payload.name
    product.description = payload.description
    product.price = payload.price
    product.includes_vat = payload.includes_vat
    product.vat_rate = payload.vat_rate
    product.unit = payload.unit
    db.commit()
    return {"success": True}


@app.delete("/products/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
    return {"success": True}


# ------------------------------------------------------------
# Step 2 endpoints: join + members
# ------------------------------------------------------------
@app.post("/companies/join-by-orgnr")
def join_company_by_orgnr(payload: JoinCompanyByOrgNumber, db: Session = Depends(get_db)):
    org = (payload.organization_number or "").strip()
    if not org:
        raise HTTPException(status_code=400, detail="organization_number is required")

    company = db.query(Company).filter(Company.organization_number == org).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    existing = (
        db.query(CompanyMember)
        .filter(CompanyMember.company_id == company.id, CompanyMember.user_id == payload.user_id)
        .first()
    )
    if existing:
        return {"success": True, "companyId": company.id, "alreadyMember": True, "role": existing.role, "status": existing.status}

    membership = CompanyMember(company_id=company.id, user_id=payload.user_id, role="MEMBER", status="ACTIVE")
    db.add(membership)
    db.commit()
    return {"success": True, "companyId": company.id, "alreadyMember": False}


@app.get("/companies/by-orgnr")
def get_company_by_orgnr(organization_number: str, user_id: int, db: Session = Depends(get_db)):
    org = (organization_number or "").strip()
    if not org:
        raise HTTPException(status_code=400, detail="organization_number is required")

    company = db.query(Company).filter(Company.organization_number == org).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    membership = (
        db.query(CompanyMember)
        .filter(
            CompanyMember.company_id == company.id,
            CompanyMember.user_id == user_id,
            CompanyMember.status == "ACTIVE",
        )
        .first()
    )

    if not membership:
        return {
            "exists": True,
            "hasAccess": False,
            "companyId": company.id,
            "companyName": company.company_name,
            "organizationNumber": company.organization_number,
        }

    return {
        "exists": True,
        "hasAccess": True,
        "companyId": company.id,
        "companyName": company.company_name,
        "organizationNumber": company.organization_number,
        "role": membership.role,
        "status": membership.status,
    }


@app.get("/companies/{company_id}/members")
def list_company_members(company_id: int, user_id: int, db: Session = Depends(get_db)):
    require_company_access(db, company_id, user_id)
    rows = (
        db.query(CompanyMember, User)
        .join(User, User.id == CompanyMember.user_id)
        .filter(CompanyMember.company_id == company_id)
        .all()
    )
    return [{"userId": u.id, "email": u.email, "name": u.name, "role": m.role, "status": m.status} for (m, u) in rows]


# ------------------------------------------------------------
# Companies
# ------------------------------------------------------------
@app.get("/companies")
def list_companies(user_id: int, db: Session = Depends(get_db)):
    memberships = db.query(CompanyMember).filter(CompanyMember.user_id == user_id, CompanyMember.status == "ACTIVE").all()
    company_ids = [m.company_id for m in memberships]
    if not company_ids:
        return []

    companies = db.query(Company).filter(Company.id.in_(company_ids)).all()
    return [
        {
            "id": company.id,
            "companyName": company.company_name,
            "organizationNumber": company.organization_number,
            "address": company.address,
            "postalCode": company.postal_code,
            "city": company.city,
            "country": company.country,
            "vatNumber": company.vat_number,
            "fiscalYearStart": company.fiscal_year_start,
            "fiscalYearEnd": company.fiscal_year_end,
            "accountingStandard": company.accounting_standard,
        }
        for company in companies
    ]


@app.post("/companies")
def create_company(payload: CompanyCreate, db: Session = Depends(get_db)):
    org = (payload.organization_number or "").strip()
    if not org:
        raise HTTPException(status_code=400, detail="organization_number is required")

    existing = db.query(Company).filter(Company.organization_number == org).first()
    if existing:
        raise HTTPException(status_code=409, detail="Company with this organization_number already exists")

    company = Company(
        company_name=payload.company_name,
        organization_number=org,
        address=payload.address,
        postal_code=payload.postal_code,
        city=payload.city,
        country=payload.country,
        vat_number=payload.vat_number,
        fiscal_year_start=payload.fiscal_year_start,
        fiscal_year_end=payload.fiscal_year_end,
        accounting_standard=payload.accounting_standard,
    )
    db.add(company)
    db.commit()
    db.refresh(company)

    membership = CompanyMember(company_id=company.id, user_id=payload.user_id, role="OWNER", status="ACTIVE")
    db.add(membership)
    db.commit()

    return {"id": company.id}
    

@app.post('/companies/join-requests')
def create_company_join_request(payload: CompanyJoinRequestCreate, db: Session = Depends(get_db)):
    # 1) hitta bolag via orgnr
    orgnr = (payload.organization_number or '').strip()
    company = (
        db.query(Company)
        .filter(Company.organization_number == orgnr)
        .first()
    )
    if not company:
        raise HTTPException(status_code=404, detail='Company not found')

    # 2) om redan medlem -> returnera som success men alreadyMember
    existing_membership = (
        db.query(CompanyMember)
        .filter(CompanyMember.company_id == company.id, CompanyMember.user_id == payload.user_id)
        .first()
    )
    if existing_membership:
        return {
            'success': True,
            'companyId': company.id,
            'alreadyMember': True,
            'alreadyRequested': False,
            'requestId': None,
        }

    # 3) om pending redan finns -> returnera den
    existing_req = (
        db.query(CompanyJoinRequest)
        .filter(
            CompanyJoinRequest.company_id == company.id,
            CompanyJoinRequest.requester_user_id == payload.user_id,
            CompanyJoinRequest.status == CompanyJoinRequestStatus.PENDING,
        )
        .first()
    )
    if existing_req:
        return {
            'success': True,
            'companyId': company.id,
            'alreadyMember': False,
            'alreadyRequested': True,
            'requestId': existing_req.id,
        }

    # 4) skapa ny pending
    req = CompanyJoinRequest(
        company_id=company.id,
        requester_user_id=payload.user_id,
        status=CompanyJoinRequestStatus.PENDING,
    )

    db.add(req)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # om race condition -> hämta pending och returnera den
        again = (
            db.query(CompanyJoinRequest)
            .filter(
                CompanyJoinRequest.company_id == company.id,
                CompanyJoinRequest.requester_user_id == payload.user_id,
                CompanyJoinRequest.status == CompanyJoinRequestStatus.PENDING,
            )
            .first()
        )
        return {
            'success': True,
            'companyId': company.id,
            'alreadyMember': False,
            'alreadyRequested': True,
            'requestId': again.id if again else None,
        }

    db.refresh(req)
    return {
        'success': True,
        'companyId': company.id,
        'alreadyMember': False,
        'alreadyRequested': False,
        'requestId': req.id,
    }


@app.get('/companies/{company_id}/join-requests')
def list_company_join_requests(company_id: int, user_id: int, db: Session = Depends(get_db)):
    # bara OWNER/ADMIN ska kunna lista requests
    if not is_company_admin_or_owner(db, company_id, user_id):
        raise HTTPException(status_code=403, detail='Forbidden')

    reqs = (
        db.query(CompanyJoinRequest)
        .filter(
            CompanyJoinRequest.company_id == company_id,
            CompanyJoinRequest.status == CompanyJoinRequestStatus.PENDING,
        )
        .order_by(CompanyJoinRequest.created_at.asc())
        .all()
    )

    requester_ids = [r.requester_user_id for r in reqs]
    users = db.query(User).filter(User.id.in_(requester_ids)).all() if requester_ids else []
    users_by_id = {u.id: u for u in users}

    out = []
    for r in reqs:
        requester = users_by_id.get(r.requester_user_id)
        out.append({
            'id': r.id,
            'companyId': r.company_id,
            'requestedBy': {
                'id': requester.id if requester else r.requester_user_id,
                'email': requester.email if requester else None,
                'name': requester.name if requester else None,
            },
            'status': r.status.value if hasattr(r.status, 'value') else str(r.status),
            'createdAt': r.created_at.isoformat() if r.created_at else None,
        })

    return out


@app.post('/companies/join-requests/{request_id}/decide')
def decide_company_join_request(request_id: int, payload: CompanyJoinRequestDecide, db: Session = Depends(get_db)):
    req = db.query(CompanyJoinRequest).filter(CompanyJoinRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail='Join request not found')

    # bara OWNER/ADMIN får besluta
    if not is_company_admin_or_owner(db, req.company_id, payload.user_id):
        raise HTTPException(status_code=403, detail='Forbidden')

    if req.status != CompanyJoinRequestStatus.PENDING:
        return {
            'success': False,
            'message': 'Request is not pending',
            'status': str(req.status),
        }

    action = (payload.action or '').strip().lower()
    if action not in ['approve', 'reject']:
        raise HTTPException(status_code=400, detail='Invalid action')

    now = datetime.utcnow()

    if action == 'approve':
        # skapa medlemskap om det inte finns
        existing_membership = (
            db.query(CompanyMember)
            .filter(CompanyMember.company_id == req.company_id, CompanyMember.user_id == req.requester_user_id)
            .first()
        )
        if not existing_membership:
            db.add(CompanyMember(
                company_id=req.company_id,
                user_id=req.requester_user_id,
                role='MEMBER',
                status='ACTIVE',
            ))

        req.status = CompanyJoinRequestStatus.APPROVED
        req.decided_at = now
        req.decided_by_user_id = payload.user_id
        db.commit()

        return {
            'success': True,
            'status': 'APPROVED',
            'companyId': req.company_id,
            'userId': req.requester_user_id,
        }

    # reject
    req.status = CompanyJoinRequestStatus.REJECTED
    req.decided_at = now
    req.decided_by_user_id = payload.user_id
    db.commit()

    return {
        'success': True,
        'status': 'REJECTED',
        'companyId': req.company_id,
        'userId': req.requester_user_id,
    }
    
    
@app.get("/companies/for-user")
def list_companies_for_user(user_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(Company, CompanyMember)
        .join(CompanyMember, CompanyMember.company_id == Company.id)
        .filter(CompanyMember.user_id == user_id)
        .filter(CompanyMember.status == 'ACTIVE')
        .all()
    )

    return [
        {
            'id': c.id,
            'companyName': c.company_name,
            'organizationNumber': c.organization_number,
            'address': c.address,
            'postalCode': c.postal_code,
            'city': c.city,
            'country': c.country,
            'vatNumber': c.vat_number,
            'fiscalYearStart': c.fiscal_year_start,
            'fiscalYearEnd': c.fiscal_year_end,
            'accountingStandard': c.accounting_standard,
            'memberRole': m.role,
            'memberStatus': m.status,
        }
        for (c, m) in rows
    ]


@app.put("/companies/{company_id}")
def update_company(company_id: int, payload: CompanyUpdate, user_id: int, db: Session = Depends(get_db)):
    require_company_admin(db, company_id, user_id)
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    new_org = (payload.organization_number or "").strip() if payload.organization_number else None
    if new_org and new_org != company.organization_number:
        existing = db.query(Company).filter(Company.organization_number == new_org).first()
        if existing:
            raise HTTPException(status_code=409, detail="organization_number already in use")
        company.organization_number = new_org

    company.company_name = payload.company_name
    company.address = payload.address
    company.postal_code = payload.postal_code
    company.city = payload.city
    company.country = payload.country
    company.vat_number = payload.vat_number
    company.fiscal_year_start = payload.fiscal_year_start
    company.fiscal_year_end = payload.fiscal_year_end
    company.accounting_standard = payload.accounting_standard
    db.commit()
    return {"id": company.id}


@app.delete("/companies/{company_id}")
def delete_company(company_id: int, user_id: int, db: Session = Depends(get_db)):
    require_company_admin(db, company_id, user_id)
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    db.query(CompanySIEState).filter(CompanySIEState.company_id == company_id).delete()
    db.query(CompanyMember).filter(CompanyMember.company_id == company_id).delete()
    db.delete(company)
    db.commit()
    return {"success": True}
    
    
@app.get('/companies/{company_id}/join-requests')
def list_join_requests(company_id: int, user_id: int, db: Session = Depends(get_db)):
    require_company_admin(db, company_id, user_id)

    rows = (
        db.query(CompanyMember, User)
        .join(User, User.id == CompanyMember.user_id)
        .filter(CompanyMember.company_id == company_id, CompanyMember.status == 'INVITED')
        .all()
    )
    return [
        {'userId': u.id, 'email': u.email, 'name': u.name, 'role': m.role, 'status': m.status}
        for (m, u) in rows
    ]


@app.post('/companies/{company_id}/join-requests/{member_user_id}/approve')
def approve_join_request(company_id: int, member_user_id: int, payload: dict, db: Session = Depends(get_db)):
    admin_user_id = int(payload.get('user_id') or 0)
    require_company_admin(db, company_id, admin_user_id)

    membership = (
        db.query(CompanyMember)
        .filter(CompanyMember.company_id == company_id, CompanyMember.user_id == member_user_id)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=404, detail='Join request not found')

    membership.status = 'ACTIVE'
    db.commit()
    return {'success': True}


@app.delete('/companies/{company_id}/members/{member_user_id}')
def remove_member(company_id: int, member_user_id: int, user_id: int, db: Session = Depends(get_db)):
    require_company_admin(db, company_id, user_id)

    membership = (
        db.query(CompanyMember)
        .filter(CompanyMember.company_id == company_id, CompanyMember.user_id == member_user_id)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=404, detail='Member not found')

    db.delete(membership)
    db.commit()
    return {'success': True}