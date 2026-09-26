"""Persistent application state for data previously stored only in the browser."""
import json
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from models import User, Company, CompanyMember, WorkspaceState

router = APIRouter(prefix="/workspace", tags=["workspace"])


class WorkspaceUpdate(BaseModel):
    user_id: int
    version: int = Field(ge=0)
    values: dict[str, str]


def authorize(db, kind, scope_id, user_id, write=False):
    # This API follows the existing local-only backend's user/membership model.
    # Docker publishes only the frontend on 127.0.0.1; this is not a public API.
    if not db.get(User, user_id):
        raise HTTPException(403, "Unknown user")
    if kind == "user":
        if scope_id != user_id:
            raise HTTPException(403, "Access denied")
        parent = db.query(User).filter(User.id == scope_id)
    else:
        member = db.query(CompanyMember).filter_by(company_id=scope_id, user_id=user_id, status="ACTIVE").first()
        if not member or (write and member.role == "READ_ONLY"):
            raise HTTPException(403, "Access denied")
        parent = db.query(Company).filter(Company.id == scope_id)
    # Serialize all updates to the same scope, including first insert.
    if write:
        parent = parent.with_for_update()
    if not parent.first():
        raise HTTPException(404, "Scope not found")


@router.get("/{kind}/{scope_id}")
def read_workspace(kind: Literal["company", "user"], scope_id: int, user_id: int, db: Session = Depends(get_db)):
    authorize(db, kind, scope_id, user_id)
    row = db.get(WorkspaceState, f"{kind}:{scope_id}")
    return {"version": row.version if row else 0, "values": json.loads(row.values_json) if row else {}}


@router.put("/{kind}/{scope_id}")
def write_workspace(kind: Literal["company", "user"], scope_id: int, payload: WorkspaceUpdate, db: Session = Depends(get_db)):
    authorize(db, kind, scope_id, payload.user_id, write=True)
    serialized = json.dumps(payload.values, ensure_ascii=False)
    if len(serialized.encode("utf-8")) > 40 * 1024 * 1024:
        raise HTTPException(413, "Företagets sparade data överstiger 40 MB. Minska storleken på bilagorna.")
    if any(len(key) > 300 for key in payload.values):
        raise HTTPException(422, "Invalid storage key")
    key = f"{kind}:{scope_id}"
    row = db.get(WorkspaceState, key)
    if payload.version != (row.version if row else 0):
        raise HTTPException(409, "Data har ändrats i en annan flik eller av en annan användare. Dina ändringar har inte skrivits över.")
    if not row:
        row = WorkspaceState(scope=key, company_id=scope_id if kind == "company" else None,
                             user_id=scope_id if kind == "user" else None, version=0)
        db.add(row)
    row.values_json = serialized
    row.version += 1
    db.commit()
    return {"version": row.version}
