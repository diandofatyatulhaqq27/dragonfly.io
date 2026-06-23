from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from app.models import Gateway, TelemetryLog, Alarm, AlarmHistory


class IngestionService:
    @staticmethod
    def process(db: Session, gateway: Gateway, data: dict):
        gateway_id = gateway.gateway_id

        # 1. Update heartbeat & status gateway
        gateway.last_ping = func.now()
        if gateway.status != "online":
            gateway.status = "online"
            print(f"✅ Gateway {gateway_id} ({gateway.hmi_code}) kembali ONLINE")

        # 2. Simpan payload mentah ke telemetry_logs
        new_log = TelemetryLog(gateway_id=gateway_id, payload=data)
        db.add(new_log)

        # 3. Iterasi data payload MQTT dari PLC/HMI
        for key, value in data.items():
            try:
                val = int(float(value))
            except (ValueError, TypeError):
                continue

            if val not in [0, 1]:
                continue

            alarm = db.query(Alarm).filter(
                Alarm.gateway_id == gateway_id,
                Alarm.mqtt_key == key
            ).first()

            if not alarm:
                continue

            # Hanya set ACTIVE dari MQTT, RESOLVED hanya dari user verify di web
            if val == 1 and alarm.status != "ACTIVE":
                alarm.status = "ACTIVE"
                alarm.severity = "CRITICAL"
                alarm.created_at = func.now()

                # Catat ke history hanya saat pertama kali ACTIVE
                history = AlarmHistory(
                    alarm_id=alarm.id,
                    gateway_id=gateway_id,
                    alarm_name=alarm.name,
                    mqtt_key=alarm.mqtt_key,
                    message=alarm.message,
                )
                db.add(history)
                print(f"🚨 Alarm ACTIVE: {alarm.name} (key={key}, gateway={gateway_id})")

        db.commit()