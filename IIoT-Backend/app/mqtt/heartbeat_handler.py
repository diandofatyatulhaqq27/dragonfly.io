from app.database import SessionLocal
from app.models import Gateway
from sqlalchemy.sql import func


class HeartbeatHandler:
    """
    Menangani pesan heartbeat -- topik TERPISAH dari data telemetry.
    Tujuannya cuma update last_ping/status gateway, TANPA insert ke
    telemetry_logs. Ini yang bikin status online/offline tetap akurat
    walau HMI di-set "Variable Change Record" (telemetry cuma publish
    saat nilai berubah, bukan tiap detik).
    """

    @staticmethod
    def handle(topic: str, payload_str: str):
        parts = topic.split("/")
        hmi_code = parts[-1] if parts else None
        if not hmi_code:
            return

        db = SessionLocal()
        try:
            gateway = db.query(Gateway).filter(Gateway.hmi_code == str(hmi_code)).first()
            if not gateway:
                print(f"⚠️ Heartbeat dari HMI Code '{hmi_code}' belum terdaftar sebagai Gateway.")
                return

            gateway.last_ping = func.now()
            if gateway.status != "online":
                gateway.status = "online"
                print(f"✅ Gateway {gateway.gateway_id} ({gateway.hmi_code}) kembali ONLINE (heartbeat)")

            db.commit()
        except Exception as e:
            db.rollback()
            print(f"⚠️ Gagal memproses heartbeat (hmi_code={hmi_code}): {e}")
        finally:
            db.close()