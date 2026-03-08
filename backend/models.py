import enum

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Text,
    Float,
    Boolean,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy import Enum as SAEnum
from datetime import datetime

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)
    role = Column(String(50), default="user", nullable=False)
    name = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    sie_files = relationship("SIEFile", back_populates="user")
    receipts = relationship("Receipt", back_populates="user")

    company_memberships = relationship("CompanyMember", back_populates="user")

    # optional relation for locks (not required for queries, but nice to have)
    locks = relationship("CompanyLock", back_populates="locked_by_user")


class Company(Base):
    """
    Company is a root-entity.
    It is NOT owned by a single user. Access is controlled via CompanyMember.
    """
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(255), nullable=False)

    # Must be unique across ALL companies (one company can only be created once).
    organization_number = Column(String(20), nullable=True)

    address = Column(String(255), nullable=True)
    postal_code = Column(String(20), nullable=True)
    city = Column(String(255), nullable=True)
    country = Column(String(255), nullable=True)
    vat_number = Column(String(50), nullable=True)

    fiscal_year_start = Column(String(10), nullable=True)
    fiscal_year_end = Column(String(10), nullable=True)
    accounting_standard = Column(String(2), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    members = relationship("CompanyMember", back_populates="company")

    # optional: one lock per company
    lock = relationship("CompanyLock", back_populates="company", uselist=False)


# Roles and status are stored as strings for now (simple + easy).
# You can later swap to an Enum if you want.
class CompanyMember(Base):
    __tablename__ = "company_members"
    __table_args__ = (
        UniqueConstraint("company_id", "user_id", name="uq_company_members_company_user"),
        Index("ix_company_members_company_id", "company_id"),
        Index("ix_company_members_user_id", "user_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # OWNER, ADMIN, ACCOUNTANT, MEMBER, READ_ONLY
    role = Column(String(50), nullable=False, default="MEMBER")
    # INVITED, ACTIVE, DISABLED
    status = Column(String(50), nullable=False, default="ACTIVE")

    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company", back_populates="members")
    user = relationship("User", back_populates="company_memberships")


class CompanyLock(Base):
    """
    One lock per company:
    - Only one user can have the company open at a time (for conflict prevention).
    - Lock has an expiry (TTL) so it releases automatically if user closes browser.
    """
    __tablename__ = "company_locks"
    __table_args__ = (
        Index("ix_company_locks_company_id", "company_id", unique=True),
        Index("ix_company_locks_locked_by_user_id", "locked_by_user_id"),
        Index("ix_company_locks_expires_at", "expires_at"),
    )

    # company_id is also the primary key -> exactly one lock row per company
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), primary_key=True)
    locked_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    locked_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)

    company = relationship("Company", back_populates="lock")
    locked_by_user = relationship("User", back_populates="locks")
    
    
class CompanyLockTakeoverStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"


class CompanyLockTakeoverRequest(Base):
    __tablename__ = "company_lock_takeover_requests"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    requested_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    status = Column(
        SAEnum(
            CompanyLockTakeoverStatus,
            name="company_lock_takeover_status",
        ),
        nullable=False,
        default=CompanyLockTakeoverStatus.PENDING,
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    expires_at = Column(DateTime(timezone=True), nullable=False)

    decided_at = Column(DateTime(timezone=True), nullable=True)

    decided_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    company = relationship("Company", backref="lock_takeover_requests")

    requested_by = relationship("User", foreign_keys=[requested_by_user_id])

    decided_by = relationship("User", foreign_keys=[decided_by_user_id])

    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "requested_by_user_id",
            "status",
            name="uq_takeover_company_user_status",
        ),
    )


class SIEFile(Base):
    __tablename__ = "sie_files"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    storage_path = Column(String(512), nullable=False)
    period = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="sie_files")


class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    storage_path = Column(String(512), nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="receipts")


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    type = Column(String(20), nullable=False)
    name = Column(String(255), nullable=False)
    organization_number = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    address = Column(String(255), nullable=False)
    postal_code = Column(String(20), nullable=False)
    city = Column(String(255), nullable=False)
    country = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False)
    includes_vat = Column(Boolean, nullable=False, default=False)
    vat_rate = Column(Float, nullable=False, default=25)
    unit = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class CompanySIEState(Base):
    """
    Store one SIE state per company (not per user).
    """
    __tablename__ = "company_sie_states"
    __table_args__ = (
        UniqueConstraint("company_id", name="uq_company_sie_states_company"),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    sie_content = Column(Text, nullable=False)

    # optimistic version number (will be used later for conflict prevention)
    version = Column(Integer, nullable=False, default=1)

    updated_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    
class CompanyJoinRequestStatus(str, enum.Enum):
    PENDING = 'PENDING'
    APPROVED = 'APPROVED'
    REJECTED = 'REJECTED'


class CompanyJoinRequest(Base):
    __tablename__ = 'company_join_requests'

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey('companies.id', ondelete='CASCADE'), nullable=False, index=True)

    # DB-kolumnen heter requester_user_id (se din \d company_join_requests)
    requester_user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)

    # DB-kolumnen är varchar(20) med default 'PENDING'
    status = Column(String(20), nullable=False, default='PENDING')

    # DB-kolumnen är timestamp without time zone med default now()
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    # Relations
    company = relationship('Company', backref='join_requests')
    requester = relationship('User', foreign_keys=[requester_user_id])

    __table_args__ = (
        # Hindra samma user från att skapa flera PENDING för samma bolag
        UniqueConstraint('company_id', 'requester_user_id', 'status', name='uq_join_request_company_user_status'),
        Index('ix_joinreq_company', 'company_id'),
        Index('ix_joinreq_requester', 'requester_user_id'),
        Index('ix_joinreq_status', 'status'),
    )