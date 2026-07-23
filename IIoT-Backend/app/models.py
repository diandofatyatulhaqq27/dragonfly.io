import json
from sqlalchemy import Column, Integer, String, TEXT, Boolean, DateTime, ForeignKey, Float, Text, UniqueConstraint, BigInteger, Index
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from .database import Base

# ==========================================
# 1. TABEL COMPANIES (TENANT UTAMA)
# ==========================================
class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    address = Column(TEXT)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    invitation_code = Column(String, unique=True, index=True)


# ==========================================
# 2. TABEL USERS (TERIKAT KE COMPANY)
# ==========================================
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    role = Column(String, default="operator")
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"))
    is_approved = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ==========================================
# 3. TABEL PROJECTS (TERIKAT KE COMPANY)
# ==========================================
class Project(Base):
    __tablename__ = "projects"

    project_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    display_name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    config = Column(JSONB, default=[])
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"))
    gateways = relationship("Gateway", back_populates="project", cascade="all, delete-orphan")


# ==========================================
# 4. TABEL GATEWAYS (TERIKAT KE PROJECT & COMPANY)
# ==========================================
class Gateway(Base):
    __tablename__ = "gateways"

    gateway_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    hmi_code = Column(String, nullable=True)
    name = Column(String, nullable=False)
    status = Column(String, default="offline")
    last_ping = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    project_id = Column(Integer, ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=True)
    project = relationship("Project", back_populates="gateways")
    config = Column(JSONB, default=[])
    chiller_image_url = Column(String, nullable=True)
    hmi_image_url = Column(String, nullable=True)

# ==========================================
# 5. TABEL TELEMETRY LOGS (DATA SENSOR GAS)
# ==========================================
class TelemetryLog(Base):
    __tablename__ = "telemetry_logs"
    __table_args__ = (
        Index('idx_telemetry_gateway_created', 'gateway_id', 'created_at'),
        Index('idx_telemetry_payload_gin', 'payload', postgresql_using='gin'),
        {'postgresql_partition_by': 'RANGE (created_at)'},
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    payload = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), primary_key=True, server_default=func.now())
    gateway_id = Column(Integer, ForeignKey("gateways.gateway_id", ondelete="CASCADE"))


# ==========================================
# 6. TABEL ALARMS (SISTEM BAHAYA / KEBOCORAN)
# ==========================================
class Alarm(Base):
    __tablename__ = "alarms"

    id = Column(Integer, primary_key=True, index=True)
    gateway_id = Column(Integer, ForeignKey("gateways.gateway_id", ondelete="CASCADE"))
    name = Column(String, nullable=True)
    message = Column(TEXT, nullable=False)
    severity = Column(String, default="CRITICAL")
    status = Column(String, default="ACTIVE")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    mqtt_key = Column(String(100), nullable=False, index=True)
    __table_args__ = (
        UniqueConstraint('gateway_id', 'mqtt_key', name='unique_gateway_mqtt_key'),
    )


# ==========================================
# 7. TABEL TOKEN RESET PASSWORD
# ==========================================
class PasswordReset(Base):
    __tablename__ = "password_resets"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True, nullable=False)
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_used = Column(Boolean, default=False)
    
# ==========================================
# 8. TABEL Alarm History (REKAM JEJAK ALARM YANG SUDAH TRIGGERED)
# ==========================================
class AlarmHistory(Base):
    __tablename__ = "alarm_history"

    id = Column(Integer, primary_key=True, index=True)
    alarm_id = Column(Integer, ForeignKey("alarms.id", ondelete="CASCADE"))
    gateway_id = Column(Integer, ForeignKey("gateways.gateway_id", ondelete="CASCADE"))
    alarm_name = Column(String, nullable=True)
    mqtt_key = Column(String(100), nullable=True)
    message = Column(TEXT, nullable=True)
    triggered_at = Column(DateTime(timezone=True), server_default=func.now())
    verified_at = Column(DateTime(timezone=True), nullable=True)
    verified_by = Column(String, nullable=True)