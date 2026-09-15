from typing import Optional

from pydantic import BaseModel, EmailStr, Field


# =========================================================
# REGISTER
# =========================================================

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(
        min_length=8,
        max_length=128
    )


# =========================================================
# LOGIN
# =========================================================

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(
        min_length=1,
        max_length=128
    )


# =========================================================
# LOGIN RESPONSE
# =========================================================

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

    # Persistent login ke liye refresh token
    refresh_token: Optional[str] = None

    # 2FA login flow ke liye
    requires_2fa: bool = False

    # Session expire hone par OTP-only reauthentication
    requires_session_2fa: bool = False


# =========================================================
# LOGIN 2FA VERIFICATION
# =========================================================

class Login2FAVerifyRequest(BaseModel):
    email: EmailStr
    password: str = Field(
        min_length=1,
        max_length=128
    )
    otp: str = Field(
        min_length=6,
        max_length=6
    )


# =========================================================
# SESSION REFRESH
# =========================================================

class SessionRefreshRequest(BaseModel):
    refresh_token: str = Field(
        min_length=1
    )

    # 2FA enabled hone par optional OTP.
    # Pehle request mein OTP nahi hoga,
    # backend requires_session_2fa return karega.
    otp: Optional[str] = Field(
        default=None,
        min_length=6,
        max_length=6
    )


# =========================================================
# CHANGE PASSWORD
# =========================================================

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(
        min_length=1,
        max_length=128
    )

    new_password: str = Field(
        min_length=8,
        max_length=128
    )


# =========================================================
# FORGOT PASSWORD
# =========================================================

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


# =========================================================
# RESET PASSWORD
# =========================================================

class ResetPasswordRequest(BaseModel):
    token: str = Field(
        min_length=1
    )

    new_password: str = Field(
        min_length=8,
        max_length=128
    )