import os
from datetime import datetime
from fastapi import FastAPI, Depends, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert

import time
from sqlalchemy.exc import OperationalError

from pathlib import Path
from alembic import command
from alembic.config import Config

from database import get_db, SessionLocal, DATABASE_URL
from passlib.context import CryptContext
from models import User, SIEFile, Receipt, Company, Customer, Product, CompanySIEState

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def is_password_hashed(password: str) -> bool:
    return pwd_context.identify(password) is not None


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




class CompanySIEStateUpsert(BaseModel):
    user_id: int
    sie_content: str

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
    includes_vat: bool
    vat_rate: float
    unit: str | None = None


class ProductUpdate(BaseModel):
    name: str
    description: str | None = None
    price: float
    includes_vat: bool
    vat_rate: float
    unit: str | None = None


@app.on_event("startup")
def on_startup():
    max_attempts = 10
    delay_seconds = 2
    for attempt in range(1, max_attempts + 1):
        try:
            alembic_cfg = Config(str(Path(__file__).with_name("alembic.ini")))
            migrations_path = Path(__file__).parent / "alembic"
            alembic_cfg.set_main_option("script_location", str(migrations_path))
            alembic_cfg.set_main_option("sqlalchemy.url", DATABASE_URL)
            command.upgrade(alembic_cfg, "head")
            db = SessionLocal()
            try:
                changes = False
                existing = db.query(User).filter(User.email == "test@test.com").first()
                if not existing:
                    db.add(
                        User(
                            email="test@test.com",
                            password=hash_password("test"),
                            name="Test User",
                            role="user",
                        )
                    )
                    changes = True
                elif not is_password_hashed(existing.password):
                    existing.password = hash_password("test")
                    changes = True
                admin = db.query(User).filter(User.email == "admin@snug.local").first()
                if not admin:
                    db.add(
                        User(
                            email="admin@snug.local",
                            password=hash_password("admin"),
                            name="Admin User",
                            role="admin",
                        )
                    )
                    changes = True
                elif not is_password_hashed(admin.password):
                    admin.password = hash_password("admin")
                    changes = True
                if changes:
                    db.commit()
            finally:
                db.close()
            return
        except OperationalError:
            if attempt == max_attempts:
                raise
            time.sleep(delay_seconds)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/users")
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [
        {"id": user.id, "email": user.email, "name": user.name, "role": user.role}
        for user in users
    ]


@app.post("/users")
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    user = User(
        email=payload.email,
        password=hash_password(payload.password),
        name=payload.name,
        role="user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "email": user.email, "name": user.name}


@app.post("/auth/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password):
        return {"success": False, "error": "Invalid email or password"}
    return {
        "success": True,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
        },
    }


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
    return {
        "success": True,
        "user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role},
    }


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


@app.get("/companies/{company_id}/sie-state")
def get_company_sie_state(company_id: int, user_id: int, db: Session = Depends(get_db)):
    state = (
        db.query(CompanySIEState)
        .filter(CompanySIEState.company_id == company_id, CompanySIEState.user_id == user_id)
        .first()
    )

    if not state:
        return {
            "companyId": company_id,
            "userId": user_id,
            "sieContent": None,
            "updatedAt": None,
        }

    return {
        "id": state.id,
        "companyId": state.company_id,
        "userId": state.user_id,
        "sieContent": state.sie_content,
        "updatedAt": state.updated_at.isoformat() if state.updated_at else None,
    }


@app.put("/companies/{company_id}/sie-state")
def upsert_company_sie_state(company_id: int, payload: CompanySIEStateUpsert, db: Session = Depends(get_db)):
    company = (
        db.query(Company)
        .filter(Company.id == company_id, Company.user_id == payload.user_id)
        .first()
    )
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    now = datetime.utcnow()
    upsert_stmt = (
        pg_insert(CompanySIEState)
        .values(
            user_id=payload.user_id,
            company_id=company_id,
            sie_content=payload.sie_content,
            updated_at=now,
        )
        .on_conflict_do_update(
            index_elements=[CompanySIEState.user_id, CompanySIEState.company_id],
            set_={
                "sie_content": payload.sie_content,
                "updated_at": now,
            },
        )
        .returning(
            CompanySIEState.id,
            CompanySIEState.company_id,
            CompanySIEState.user_id,
            CompanySIEState.updated_at,
        )
    )

    row = db.execute(upsert_stmt).one()
    db.commit()

    return {
        "id": row.id,
        "companyId": row.company_id,
        "userId": row.user_id,
        "updatedAt": row.updated_at.isoformat() if row.updated_at else None,
    }


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


@app.get("/customers")
def list_customers(user_id: int, company_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(Customer).filter(Customer.user_id == user_id)
    if company_id is not None:
        query = query.filter(Customer.company_id == company_id)
    customers = query.order_by(Customer.created_at.asc()).all()
    return [
        {
            "id": customer.id,
            "user_id": customer.user_id,
            "company_id": customer.company_id,
            "type": customer.type,
            "name": customer.name,
            "organization_number": customer.organization_number,
            "email": customer.email,
            "phone": customer.phone,
            "address": customer.address,
            "postal_code": customer.postal_code,
            "city": customer.city,
            "country": customer.country,
            "created_at": customer.created_at.isoformat() if customer.created_at else None,
        }
        for customer in customers
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
    return {"id": customer.id}


@app.delete("/customers/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    db.delete(customer)
    db.commit()
    return {"success": True}


@app.get("/products")
def list_products(user_id: int, company_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(Product).filter(Product.user_id == user_id)
    if company_id is not None:
        query = query.filter(Product.company_id == company_id)
    products = query.order_by(Product.created_at.asc()).all()
    return [
        {
            "id": product.id,
            "user_id": product.user_id,
            "company_id": product.company_id,
            "name": product.name,
            "description": product.description,
            "price": product.price,
            "includes_vat": product.includes_vat,
            "vat_rate": product.vat_rate,
            "unit": product.unit,
            "created_at": product.created_at.isoformat() if product.created_at else None,
        }
        for product in products
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
    return {"id": product.id}


@app.delete("/products/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
    return {"success": True}


@app.get("/companies")
def list_companies(user_id: int, db: Session = Depends(get_db)):
    companies = db.query(Company).filter(Company.user_id == user_id).all()
    return [
        {
            "id": company.id,
            "user_id": company.user_id,
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
    company = Company(
        user_id=payload.user_id,
        company_name=payload.company_name,
        organization_number=payload.organization_number,
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
    return {"id": company.id}


@app.put("/companies/{company_id}")
def update_company(company_id: int, payload: CompanyUpdate, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    company.company_name = payload.company_name
    company.organization_number = payload.organization_number
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
def delete_company(company_id: int, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    db.query(CompanySIEState).filter(CompanySIEState.company_id == company_id).delete()
    db.delete(company)
    db.commit()
    return {"success": True}
