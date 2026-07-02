import os
from datetime import datetime, timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, SessionLocal
from app import models

# Scheduler untuk otomatisasi pembersihan database & health check
from apscheduler.schedulers.background import BackgroundScheduler
from app.routers.telemetry import archive_old_telemetry

# MQTT Client (modular)
from app.mqtt.mqtt_client import MQTTClient

# Import 9 router CRUD
from app.routers import (
    auth, users, companies, projects,
    gateways, telemetry, alarms, sessions
)

app = FastAPI(
    title="Centralized Gas Monitoring System API",
    description="Backend API Multi-Tenant untuk Monitoring Sensor Gas",
    version="1.0.0"
)

# ==============================================================================
# 1. SETUP CORS (Diperbarui untuk Deployment Vercel & Hostinger)
# ==============================================================================
origins = [
    "http://localhost:3000",             # Akses Development Lokal
    "https://dragonfly-io.vercel.app",   # Akses dari Frontend Vercel (URL Terbaru)
    "https://dragonfly-fe.vercel.app",   # Akses dari Frontend Vercel (URL Lama - dibiarkan sebagai cadangan)
    # "https://domain-anda.com",         # (Opsional) Buka komen ini jika nanti pakai custom domain
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, # Mengganti ["*"] menjadi daftar origin spesifik demi keamanan produksi
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auto-create tabel database jika belum ada saat startup
models.Base.metadata.create_all(bind=engine)

# ==============================================================================
# 2. REGISTER ROUTER CRUD KE FASTAPI
# ==============================================================================
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(companies.router)
app.include_router(projects.router)
app.include_router(gateways.router)
app.include_router(telemetry.router)
app.include_router(alarms.router)
app.include_router(sessions.router)

# ==============================================================================
# 3. MQTT WORKER (Modular: mqtt_client + message_handler + ingestion_service)
# ==============================================================================
mqtt_client = MQTTClient()

# ==============================================================================
# 4. CRON JOB: PEMBERSIHAN DATA BERUMUR > 6 BULAN
# ==============================================================================
def trigger_monthly_cleanup():
    db = SessionLocal()
    try:
        print("\n" + "="*70)
        print("=== [CRON JOB AUTOMATION] STARTING ARCHIVING OLD DATA (+6 MONTHS) ===")
        print("="*70)
        response = archive_old_telemetry(db=db)
        print(f"=== [CRON JOB RESULT]: {response.get('message')} ===")
    except Exception as e:
        print(f"=== [CRON JOB CRASH]: Gagal eksekusi otomatisasi: {str(e)} ===")
    finally:
        db.close()
        print("="*70 + "\n")

# ==============================================================================
# 5. CRON JOB: CEK KESEHATAN GATEWAY (DETEKSI OFFLINE)
# ==============================================================================
def check_gateway_health():
    db = SessionLocal()
    try:
        threshold = datetime.utcnow() - timedelta(seconds=60)
        stale_gateways = db.query(models.Gateway).filter(
            models.Gateway.last_ping < threshold,
            models.Gateway.status == "online"
        ).all()

        for gw in stale_gateways:
            gw.status = "offline"
            print(f"⚠️ Gateway {gw.gateway_id} ({gw.name}) terdeteksi OFFLINE (no data > 60s)")

        if stale_gateways:
            db.commit()
    except Exception as e:
        db.rollback()
        print(f"=== [HEALTH CHECK CRASH]: {str(e)} ===")
    finally:
        db.close()

# ==============================================================================
# 6. LIFECYCLE HANDLER
# ==============================================================================
@app.on_event("startup")
def startup_event():
    # A. Jalankan MQTT Client Background Loop
    try:
        mqtt_client.connect_and_start()
    except Exception as e:
        print(f"❌ Gagal menyalakan MQTT Worker: {e} (Aplikasi tetap berjalan)")

    # B. Jalankan Scheduler
    try:
        scheduler = BackgroundScheduler()

        # Pembersihan data bulanan
        scheduler.add_job(trigger_monthly_cleanup, 'cron', day=1, hour=1, minute=0)

        # Health check gateway setiap 30 detik
        scheduler.add_job(check_gateway_health, 'interval', seconds=30)

        scheduler.start()
        print("⏰ Scheduler Aktif: Cleanup Bulanan + Health Check Gateway (30s)")
    except Exception as e:
        print(f"❌ Gagal mengaktifkan Engine Scheduler: {e}")

@app.on_event("shutdown")
def shutdown_event():
    mqtt_client.stop()
    print("🛑 Backend Berhasil Dimatikan dengan Aman")

@app.get("/")
def read_root():
    return {
        "status": "IIoT Centralized Backend Running",
        "mqtt_connected": mqtt_client.client.is_connected()
    }