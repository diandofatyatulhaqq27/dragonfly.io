import os
import ssl
import paho.mqtt.client as mqtt
from app.mqtt.message_handler import MessageHandler
from app.mqtt.heartbeat_handler import HeartbeatHandler


class MQTTClient:
    def __init__(self):
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect

        username = os.getenv("MQTT_USERNAME")
        password = os.getenv("MQTT_PASSWORD")
        if username and password:
            self.client.username_pw_set(username, password)

        if os.getenv("MQTT_USE_TLS", "false").lower() == "true":
            self.client.tls_set(cert_reqs=ssl.CERT_REQUIRED, tls_version=ssl.PROTOCOL_TLS)

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print("✅ Backend FastAPI Berhasil Terhubung ke Broker MQTT!")
            client.subscribe("data/#")
            client.subscribe("heartbeat/#")
        else:
            print(f"❌ Gagal koneksi ke MQTT, error code: {rc}")

    def on_disconnect(self, client, userdata, rc):
        print(f"⚠️ MQTT Terputus (rc={rc}), paho akan auto-reconnect...")

    def on_message(self, client, userdata, message):
        if message.retain:
            print(f"⚠️ Retained message diabaikan: {message.topic}")
            return

        try:
            payload_str = message.payload.decode("utf-8", errors="ignore")

            if message.topic.startswith("heartbeat/"):
                HeartbeatHandler.handle(message.topic, payload_str)
                return

            print(f"📩 Data Masuk via MQTT [{message.topic}]: {payload_str}")
            MessageHandler.handle(message.topic, payload_str)
        except Exception as e:
            print(f"⚠️ Gagal memproses data MQTT internal FastAPI: {e}")

    def connect_and_start(self):
        host = os.getenv("MQTT_HOST", "127.0.0.1")
        port = int(os.getenv("MQTT_PORT", 1883))
        self.client.connect(host, port, 60)
        self.client.loop_start()
        print(f"🚀 MQTT Worker aktif di background (Connecting to {host}:{port})...")

    def stop(self):
        self.client.loop_stop()
        self.client.disconnect()
        print("🛑 MQTT Worker dihentikan dengan aman")