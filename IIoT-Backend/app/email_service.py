import os
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType

conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME", ""),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD", ""),
    MAIL_FROM=os.getenv("MAIL_FROM", "noreply@dragonfly.io"),
    MAIL_FROM_NAME=os.getenv("MAIL_FROM_NAME", "Dragonfly.io"),
    MAIL_PORT=int(os.getenv("MAIL_PORT", 587)),
    MAIL_SERVER=os.getenv("MAIL_SERVER", "smtp.gmail.com"),
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
)

async def send_reset_email(email: str, reset_link: str):
    print("\n" + "="*60)
    print(f"=== [EMAIL] Attempting to send to: {email}")
    print(f"=== [EMAIL] MAIL_SERVER: {os.getenv('MAIL_SERVER')}")
    print(f"=== [EMAIL] MAIL_USERNAME: {os.getenv('MAIL_USERNAME')}")
    print(f"=== [EMAIL] MAIL_PORT: {os.getenv('MAIL_PORT')}")
    print(f"=== [EMAIL] Reset link: {reset_link}")
    print("="*60)

    try:
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f9fafb; border-radius: 12px;">
          <h2 style="font-size: 20px; font-weight: 900; color: #111827; margin-bottom: 8px;">
            Dragonfly<span style="color: #9ca3af;">.</span><span style="color: #2563eb;">io</span>
          </h2>
          <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px;">Password Reset Request</p>
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
            <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">
              We received a request to reset your password. Click the button below.
              This link expires in <strong>15 minutes</strong>.
            </p>
            <a href="{reset_link}"
               style="display: inline-block; background: #2563eb; color: white; text-decoration: none;
                      padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">
              Reset Password →
            </a>
          </div>
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
        """

        message = MessageSchema(
            subject="Reset your Dragonfly.io password",
            recipients=[email],
            body=html,
            subtype=MessageType.html,
        )

        fm = FastMail(conf)
        await fm.send_message(message)
        print(f"=== [EMAIL] ✅ Successfully sent to: {email}")

    except Exception as e:
        print(f"=== [EMAIL] ❌ FAILED to send to {email}")
        print(f"=== [EMAIL] Error type: {type(e).__name__}")
        print(f"=== [EMAIL] Error detail: {str(e)}")