import string
import secrets

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.encryption import decrypt_password
from app.database import SessionLocal
from app.Models.credential import Credential
from app.Models.vault import Vault
from app.Models.user import User
from app.dependencies import get_current_user
from app.schemas.security import (
    PasswordCheckRequest,
    PasswordCheckResponse,
    PasswordGenerateRequest,
    PasswordGenerateResponse
)

router = APIRouter(
    prefix="/security",
    tags=["Security"]
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post(
    "/password-strength",
    response_model=PasswordCheckResponse
)
def password_strength(data: PasswordCheckRequest):
    password = data.password

    has_uppercase = any(c.isupper() for c in password)
    has_lowercase = any(c.islower() for c in password)
    has_number = any(c.isdigit() for c in password)
    has_special = any(c in string.punctuation for c in password)

    score = 0

    if len(password) >= 8:
        score += 20

    if len(password) >= 12:
        score += 20

    if has_uppercase:
        score += 15

    if has_lowercase:
        score += 15

    if has_number:
        score += 15

    if has_special:
        score += 15

    if score < 50:
        strength = "Weak"
    elif score < 80:
        strength = "Medium"
    else:
        strength = "Strong"

    return {
        "score": score,
        "strength": strength,
        "length": len(password),
        "has_uppercase": has_uppercase,
        "has_lowercase": has_lowercase,
        "has_number": has_number,
        "has_special": has_special
    }


@router.post(
    "/generate-password",
    response_model=PasswordGenerateResponse
)
def generate_password(data: PasswordGenerateRequest):
    characters = string.ascii_letters + string.digits + string.punctuation

    password = "".join(
        secrets.choice(characters)
        for _ in range(data.length)
    )

    return {
        "password": password
    }


@router.get("/password-health")
def password_health(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    credentials = (
        db.query(Credential)
        .join(Vault)
        .filter(Vault.user_id == current_user.id)
        .all()
    )

    total = len(credentials)
    weak = 0
    medium = 0
    strong = 0

    for credential in credentials:
        if not credential.encrypted_password:
            weak += 1
            continue

        password = decrypt_password(
            credential.encrypted_password
        )

        score = 0

        if len(password) >= 8:
            score += 20

        if len(password) >= 12:
            score += 20

        if any(c.isupper() for c in password):
            score += 15

        if any(c.islower() for c in password):
            score += 15

        if any(c.isdigit() for c in password):
            score += 15

        if any(c in string.punctuation for c in password):
            score += 15

        if score < 50:
            weak += 1
        elif score < 80:
            medium += 1
        else:
            strong += 1

    if total:
        security_score = round(
            ((strong * 100) + (medium * 60) + (weak * 20)) / total
        )
    else:
        security_score = 100

    return {
        "total_credentials": total,
        "weak": weak,
        "medium": medium,
        "strong": strong,
        "security_score": security_score
    }


@router.get("/password-reuse")
def password_reuse(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    credentials = (
        db.query(Credential)
        .join(Vault)
        .filter(Vault.user_id == current_user.id)
        .all()
    )

    passwords = {}

    for credential in credentials:
        if not credential.encrypted_password:
            continue

        password = decrypt_password(
            credential.encrypted_password
        )

        if password not in passwords:
            passwords[password] = []

        passwords[password].append({
            "credential_id": credential.id,
            "title": credential.title
        })

    reused = []

    for password, credentials_list in passwords.items():
        if len(credentials_list) > 1:
            reused.append({
                "credentials": credentials_list,
                "count": len(credentials_list)
            })

    return {
        "reused_password_groups": len(reused),
        "reused_credentials": sum(
            group["count"] for group in reused
        ),
        "groups": reused
    }