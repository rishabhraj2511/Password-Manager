from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.Models.credential import Credential
from app.Models.vault import Vault
from app.Models.user import User
from app.dependencies import get_current_user
from app.encryption import encrypt_password, decrypt_password

from app.schemas.credential import (
    CredentialCreate,
    CredentialUpdate,
    CredentialResponse,
    CredentialListResponse
)

from urllib.parse import urlparse


router = APIRouter(
    prefix="/credentials",
    tags=["Credentials"]
)


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def normalize_hostname(
    hostname: str
) -> str:
    return (
        hostname
        .lower()
        .replace("www.", "")
        .strip()
    )


def get_credential_hostname(
    website_url: str | None
) -> str | None:

    if not website_url:
        return None

    try:
        parsed = urlparse(
            website_url
        )

        if not parsed.hostname:
            return None

        return normalize_hostname(
            parsed.hostname
        )

    except Exception:
        return None


@router.post(
    "/",
    response_model=CredentialResponse
)
def create_credential(
    data: CredentialCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    )
):
    vault = (
        db.query(Vault)
        .filter(
            Vault.id == data.vault_id,
            Vault.user_id == current_user.id
        )
        .first()
    )

    if not vault:
        raise HTTPException(
            status_code=404,
            detail="Vault not found"
        )

    credential = Credential(
        vault_id=data.vault_id,
        title=data.title,
        username=data.username,
        encrypted_password=(
            encrypt_password(
                data.encrypted_password
            )
            if data.encrypted_password
            else None
        ),
        website_url=data.website_url,
        notes=data.notes
    )

    db.add(credential)
    db.commit()
    db.refresh(credential)

    return credential


@router.get(
    "/",
    response_model=CredentialListResponse
)
def get_credentials(
    search: str | None = None,
    vault_id: int | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    )
):
    query = (
        db.query(Credential)
        .join(Vault)
        .filter(
            Vault.user_id ==
            current_user.id
        )
    )

    if search:
        search_term = f"%{search}%"

        query = query.filter(
            (Credential.title.ilike(
                search_term
            )) |
            (Credential.username.ilike(
                search_term
            )) |
            (Credential.website_url.ilike(
                search_term
            ))
        )

    if vault_id is not None:
        query = query.filter(
            Credential.vault_id ==
            vault_id
        )

    total = query.count()

    credentials = (
        query
        .order_by(
            Credential.id.asc()
        )
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {
        "items": credentials,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.post(
    "/{credential_id}/reveal"
)
def reveal_password(
    credential_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    )
):
    credential = (
        db.query(Credential)
        .join(Vault)
        .filter(
            Credential.id ==
            credential_id,

            Vault.user_id ==
            current_user.id
        )
        .first()
    )

    if not credential:
        raise HTTPException(
            status_code=404,
            detail="Credential not found"
        )

    if not credential.encrypted_password:
        raise HTTPException(
            status_code=404,
            detail="Password not found"
        )

    password = decrypt_password(
        credential.encrypted_password
    )

    return {
        "credential_id":
            credential.id,

        "password":
            password
    }


@router.put(
    "/{credential_id}",
    response_model=CredentialResponse
)
def update_credential(
    credential_id: int,
    data: CredentialUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    )
):
    credential = (
        db.query(Credential)
        .join(Vault)
        .filter(
            Credential.id ==
            credential_id,

            Vault.user_id ==
            current_user.id
        )
        .first()
    )

    if not credential:
        raise HTTPException(
            status_code=404,
            detail="Credential not found"
        )

    credential.title = data.title
    credential.username = data.username
    credential.website_url = (
        data.website_url
    )
    credential.notes = data.notes

    if data.encrypted_password:
        credential.encrypted_password = (
            encrypt_password(
                data.encrypted_password
            )
        )

    db.commit()
    db.refresh(credential)

    return credential


@router.delete(
    "/{credential_id}"
)
def delete_credential(
    credential_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    )
):
    credential = (
        db.query(Credential)
        .join(Vault)
        .filter(
            Credential.id ==
            credential_id,

            Vault.user_id ==
            current_user.id
        )
        .first()
    )

    if not credential:
        raise HTTPException(
            status_code=404,
            detail="Credential not found"
        )

    db.delete(credential)
    db.commit()

    return {
        "message":
            "Credential deleted successfully"
    }