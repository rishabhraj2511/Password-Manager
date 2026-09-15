from datetime import datetime, timedelta, timezone
import hashlib
import secrets
import os

from jose import (
    jwt,
    JWTError,
    ExpiredSignatureError
)

from passlib.context import CryptContext


# =========================================================
# JWT CONFIGURATION
# =========================================================

# Production mein SECRET_KEY ko .env file se lena chahiye.
# Existing project compatibility ke liye fallback rakha gaya hai.
SECRET_KEY = os.getenv(
    "VAULTX_SECRET_KEY",
    "CHANGE_THIS_LATER"
)

ALGORITHM = "HS256"


# Access token short-lived rahega.
# Expire hone par refresh token use hoga.
ACCESS_TOKEN_EXPIRE_MINUTES = 30


# Refresh token long-lived hoga.
# Isse user ko baar-baar email/password enter nahi karna padega.
REFRESH_TOKEN_EXPIRE_DAYS = 30


# Password reset token ki existing expiry.
RESET_TOKEN_EXPIRE_MINUTES = 15


# =========================================================
# PASSWORD HASHING
# =========================================================

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


def hash_password(password: str) -> str:
    """
    Password ya PIN ko securely hash karta hai.
    """
    return pwd_context.hash(password)


def verify_password(
    password: str,
    password_hash: str
) -> bool:
    """
    Plain password/PIN ko stored hash ke against verify karta hai.
    """
    return pwd_context.verify(
        password,
        password_hash
    )


# =========================================================
# ACCESS TOKEN
# =========================================================

def create_access_token(
    user_id: int
) -> str:
    """
    Short-lived access token create karta hai.
    Is token ka use protected API requests ke liye hoga.
    """

    expire = (
        datetime.now(timezone.utc)
        + timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )
    )

    payload = {
        "sub": str(user_id),
        "type": "access",
        "exp": expire
    }

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


def decode_access_token(token: str):
    """
    Access token decode karta hai.

    Valid token par user_id return karega.
    Invalid ya expired token par None return karega.
    """

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("sub")
        token_type = payload.get("type")

        if not user_id:
            return None

        if token_type != "access":
            return None

        return user_id

    except ExpiredSignatureError:
        return None

    except JWTError:
        return None


# =========================================================
# REFRESH TOKEN
# =========================================================

def create_refresh_token(
    user_id: int
) -> str:
    """
    Long-lived refresh token create karta hai.

    Refresh token ka use new access token generate
    karne ke liye hoga.
    """

    expire = (
        datetime.now(timezone.utc)
        + timedelta(
            days=REFRESH_TOKEN_EXPIRE_DAYS
        )
    )

    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "exp": expire
    }

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


def decode_refresh_token(token: str):
    """
    Refresh token decode karta hai.

    Valid refresh token par user_id return karega.
    Invalid ya expired token par None return karega.
    """

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("sub")
        token_type = payload.get("type")

        if not user_id:
            return None

        if token_type != "refresh":
            return None

        return user_id

    except ExpiredSignatureError:
        return None

    except JWTError:
        return None


# =========================================================
# PASSWORD RESET TOKEN
# =========================================================

def create_reset_token() -> str:
    """
    Password reset ke liye random token create karta hai.
    """
    return secrets.token_urlsafe(32)


def hash_reset_token(token: str) -> str:
    """
    Password reset token ko SHA-256 hash karta hai.
    """
    return hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()


def reset_token_expiry() -> datetime:
    """
    Password reset token ki expiry time return karta hai.
    """
    return (
        datetime.now(timezone.utc)
        + timedelta(
            minutes=RESET_TOKEN_EXPIRE_MINUTES
        )
    )