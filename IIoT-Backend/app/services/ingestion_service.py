from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from sqlalchemy import desc
from app.models import Gateway, TelemetryLog, Alarm, AlarmHistory
from datetime import datetime, timedelta, timezone


class IngestionService:
    DEDUP_WINDOW_SECONDS = 2

    @staticmethod
    def process(db: Session, gateway: Gateway, data: dict):
        gateway_id = gateway.gateway_id

        # ── 0. Bersihkan nilai kosong dari HMI ───────────────────────────────
        # HMI Haiwell kadang kirim string kosong "" saat nilai belum terbaca
        # dari PLC (startup, komunikasi terputus, dsb).
        # Kita simpan payload apa adanya ke DB agar history tetap lengkap,
        # tapi untuk keperluan alarm check kita skip key yang kosong.
        # Frontend (widget-config.ts) sudah handle "" → tampil "—".
        #
        # Kalau ingin TIDAK menyimpan log yang ada value kosong sama sekali,
        # uncomment blok di bawah:
        #
        # has_empty = any(
        #     v == "" or v is None
        #     for v in data.values()
        #     if not isinstance(v, bool)
        # )
        # if has_empty:
        #     print(f"⏭ Payload dengan value kosong diabaikan (gateway={gateway_id})")
        #     gateway.last_ping = func.now()
        #     db.commit()
        #     return

        # ── 1. Deduplication ─────────────────────────────────────────────────
        cutoff = datetime.now(timezone.utc) - timedelta(
            seconds=IngestionService.DEDUP_WINDOW_SECONDS
        )
        last_log = (
            db.query(TelemetryLog)
            .filter(
                TelemetryLog.gateway_id == gateway_id,
                TelemetryLog.created_at >= cutoff,
            )
            .order_by(desc(TelemetryLog.created_at))
            .first()
        )
        if last_log and last_log.payload == data:
            print(
                f"⏭ Duplicate payload diabaikan "
                f"(gateway={gateway_id}, window={IngestionService.DEDUP_WINDOW_SECONDS}s)"
            )
            gateway.last_ping = func.now()
            db.commit()
            return

        # ── 2. Update heartbeat & status gateway ─────────────────────────────
        gateway.last_ping = func.now()
        if gateway.status != "online":
            gateway.status = "online"
            print(f"✅ Gateway {gateway_id} ({gateway.hmi_code}) kembali ONLINE")

        # ── 3. Simpan payload ke telemetry_logs ──────────────────────────────
        new_log = TelemetryLog(gateway_id=gateway_id, payload=data)
        db.add(new_log)

        # ── 4. Alarm check ───────────────────────────────────────────────────
        for key, raw_value in data.items():
            # Skip value kosong — jangan trigger alarm dari data invalid
            if raw_value == "" or raw_value is None:
                continue

            bool_val = IngestionService._to_bool_int(raw_value)
            if bool_val is None:
                continue

            alarm = (
                db.query(Alarm)
                .filter(
                    Alarm.gateway_id == gateway_id,
                    Alarm.mqtt_key == key,
                )
                .first()
            )
            if not alarm:
                continue

            if bool_val == 1 and alarm.status != "ACTIVE":
                alarm.status = "ACTIVE"
                alarm.severity = "CRITICAL"
                alarm.created_at = func.now()

                history = AlarmHistory(
                    alarm_id=alarm.id,
                    gateway_id=gateway_id,
                    alarm_name=alarm.name,
                    mqtt_key=alarm.mqtt_key,
                    message=alarm.message,
                )
                db.add(history)
                print(
                    f"🚨 Alarm ACTIVE: {alarm.name} "
                    f"(key={key}, gateway={gateway_id})"
                )

        db.commit()

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _to_bool_int(value) -> int | None:
        """
        Konversi nilai MQTT ke 0/1 untuk alarm check.
        Return None jika nilai bukan boolean.
        """
        if isinstance(value, bool):
            return 1 if value else 0

        if isinstance(value, str):
            v = value.strip().lower()
            if v == "":
                return None  # string kosong → bukan boolean
            if v in ("1", "true", "on", "yes", "active"):
                return 1
            if v in ("0", "false", "off", "no", "inactive"):
                return 0
            return None

        if isinstance(value, (int, float)):
            if value == 1:
                return 1
            if value == 0:
                return 0
            return None

        return None