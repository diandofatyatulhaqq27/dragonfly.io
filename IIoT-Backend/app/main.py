from dotenv import load_dotenv
load_dotenv()

import os
from datetime import datetime, timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, SessionLocal
from app import models

# Scheduler untuk otomatisasi pembersihan database & health check
from apscheduler.schedulers.background import BackgroundScheduler
from app.routers.telemetry import archive_old_telemetry, ensure_future_partitions

# MQTT Client (modular)
from app.mqtt.mqtt_client import MQTTClient

# Import router CRUD (sessions dihapus — tidak dipakai, digantikan JWT)
from app.routers import (
    auth, users, companies, projects,
    gateways, telemetry, alarms
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
    "http://localhost:3000",
    "https://dragonfly-io.vercel.app",
    "https://dragonfly-fe.vercel.app",
    "https://dragonfly.io",           # domain custom production
    "https://www.dragonfly.io",       # jaga-jaga kalau ada versi www
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auto-create tabel database jika belum ada saat startup
# (telemetry_logs sekarang partitioned table -- parent-nya dibikin di
# sini, tapi partition bulanannya baru muncul lewat trigger_partition_maintenance()
# di bawah, karena create_all() tidak tahu cara bikin child partition)
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
# 4b. CRON JOB: PASTIKAN PARTITION BULAN DEPAN SUDAH SIAP
# Kalau ini gak jalan, insert MQTT bakal ERROR begitu masuk bulan baru
# yang partition-nya belum ada ("no partition found for row").
# Dijalankan tiap hari (bukan cuma awal bulan) supaya tetap aman
# walau scheduler sempat mati beberapa hari.
# ==============================================================================
def trigger_partition_maintenance():
    db = SessionLocal()
    try:
        ensure_future_partitions(db, months_ahead=2)
    except Exception as e:
        print(f"=== [PARTITION MAINTENANCE CRASH]: {str(e)} ===")
    finally:
        db.close()

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
    # PENTING: partition harus disiapkan DULU sebelum MQTT worker mulai
    # nerima data. Kalau kebalik, insert MQTT pertama bisa gagal dengan
    # error "no partition of relation telemetry_logs found for row"
    # karena belum ada partisi bulan ini yang siap nampung.
    try:
        trigger_partition_maintenance()
    except Exception as e:
        print(f"❌ Gagal menyiapkan partition telemetry_logs: {e}")

    try:
        mqtt_client.connect_and_start()
    except Exception as e:
        print(f"❌ Gagal menyalakan MQTT Worker: {e} (Aplikasi tetap berjalan)")

    try:
        scheduler = BackgroundScheduler()
        scheduler.add_job(trigger_monthly_cleanup, 'cron', day=1, hour=1, minute=0)
        scheduler.add_job(trigger_partition_maintenance, 'cron', hour=0, minute=30)
        scheduler.add_job(check_gateway_health, 'interval', seconds=30)
        scheduler.start()

        print("⏰ Scheduler Aktif: Cleanup Bulanan + Partition Maintenance (harian) + Health Check Gateway (30s)")
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