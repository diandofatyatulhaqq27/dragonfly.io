import json
from app.database import SessionLocal
from app.models import Gateway
from app.services.ingestion_service import IngestionService


class MessageHandler:
    @staticmethod
    def handle(topic: str, payload_str: str):
        if not payload_str or not payload_str.strip():
            print(f"⚠️ Payload kosong diabaikan: {topic}")
            return
    
        try:
            data = json.loads(payload_str)
        except json.JSONDecodeError:
            print(f"⚠️ Payload bukan JSON valid: {payload_str}")
            return

        if not data or not isinstance(data, dict):
            print(f"⚠️ Payload kosong/invalid diabaikan: {topic}")
            return
     
        parts = topic.split("/")
        hmi_code = parts[-1] if parts else None

        if not hmi_code:
            print(f"⚠️ Tidak dapat mengekstrak hmi_code dari topic: {topic}")
            return

        db = SessionLocal()
        try:
            # Lookup gateway berdasarkan hmi_code (Terminal ID dinamis dari HMI)
            gateway = db.query(Gateway).filter(Gateway.hmi_code == str(hmi_code)).first()

            if not gateway:
                print(f"⚠️ HMI Code '{hmi_code}' belum terdaftar sebagai Gateway. Data diabaikan.")
                return

            IngestionService.process(db, gateway, data)
        except Exception as e:
            db.rollback()
            print(f"⚠️ Gagal memproses data MQTT (hmi_code={hmi_code}): {e}")
        finally:
            db.close()