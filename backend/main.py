from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

import time
from sqlalchemy.exc import OperationalError

from database import Base, engine, get_db, SessionLocal
from passlib.context import CryptContext
from models import User, SIEFile, Receipt

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


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


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


@app.on_event("startup")
def on_startup():
    max_attempts = 10
    delay_seconds = 2
    for attempt in range(1, max_attempts + 1):
        try:
            Base.metadata.create_all(bind=engine)
            db = SessionLocal()
            try:
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
