import os
import smtplib

from email.message import EmailMessage


SMTP_HOST = os.getenv(
    "SMTP_HOST",
    "smtp.gmail.com"
)

SMTP_PORT = int(
    os.getenv(
        "SMTP_PORT",
        "465"
    )
)

SMTP_EMAIL = os.getenv(
    "SMTP_EMAIL"
)

SMTP_PASSWORD = os.getenv(
    "SMTP_PASSWORD"
)


def send_password_reset_email(
    recipient_email: str,
    reset_link: str
):
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        raise RuntimeError(
            "SMTP email configuration is missing."
        )

    message = EmailMessage()

    message["Subject"] = "VaultX Password Reset"
    message["From"] = SMTP_EMAIL
    message["To"] = recipient_email

    message.set_content(
        f"""
Hello,

We received a request to reset your VaultX password.

Click the link below to reset your password:

{reset_link}

This password reset link will expire in 15 minutes.

If you did not request a password reset,
you can safely ignore this email.

Regards,
VaultX Security Team
"""
    )

    with smtplib.SMTP_SSL(
        SMTP_HOST,
        SMTP_PORT
    ) as smtp:

        smtp.login(
            SMTP_EMAIL,
            SMTP_PASSWORD
        )

        smtp.send_message(message)