from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

import time
from sqlalchemy.exc import OperationalError

from database import Base, engine, get_db
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
    name: str | None = None


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
        {"id": user.id, "email": user.email, "name": user.name}
        for user in users
    ]


@app.post("/users")
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    user = User(email=payload.email, name=payload.name)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "email": user.email, "name": user.name}


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
