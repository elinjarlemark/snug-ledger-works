from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
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


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    company_name = Column(String(255), nullable=False)
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

    user = relationship("User")


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
    __tablename__ = "company_sie_states"
    __table_args__ = (UniqueConstraint("user_id", "company_id", name="uq_company_sie_states_user_company"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    sie_content = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
