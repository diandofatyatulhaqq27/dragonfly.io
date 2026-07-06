import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Railway, Render, dll inject env var langsung -- tidak perlu baca file .env manual
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

if not SQLALCHEMY_DATABASE_URL:
    # Fallback untuk development lokal pakai docker-compose
    DB_USER = os.getenv("DB_USER", "user")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "password")
    DB_HOST = os.getenv("DB_HOST", "db")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME", "iiot_db")
    SQLALCHEMY_DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Railway kasih URL dengan prefix postgres:// -- SQLAlchemy versi baru butuh postgresql://
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

print("\n" + "="*70)
print(f"=== [DATABASE] Connecting to: {SQLALCHEMY_DATABASE_URL.split('@')[-1]}")
print("="*70 + "\n")

# 🌟 Connection pool tuning -- penting karena ada 2 sumber beban bersamaan:
#    1. MQTT ingestion (insert terus-menerus, bisa >1x per detik kalau
#       puluhan gateway publish bergantian)
#    2. Dashboard/API request dari banyak user sekaligus
#
# pool_size       : jumlah koneksi yang tetap dibuka & siap pakai
# max_overflow    : koneksi tambahan sementara kalau pool_size penuh
# pool_pre_ping   : test koneksi sebelum dipakai -- mencegah error
#                   "connection already closed" kalau Postgres/network
#                   sempat drop koneksi idle (umum terjadi di VPS)
# pool_recycle    : paksa buat ulang koneksi tiap 30 menit, jaga-jaga
#                   ada firewall/load balancer yang motong koneksi idle
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=1800,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()