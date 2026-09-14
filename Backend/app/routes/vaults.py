from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.Models.vault import Vault
from app.Models.credential import Credential
from app.Models.user import User
from app.dependencies import get_current_user
from app.schemas.vaults import VaultListResponse


router = APIRouter(
    prefix="/vaults",
    tags=["Vaults"]
)


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


@router.post("/")
def create_vault(
    name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    vault = Vault(
        user_id=current_user.id,
        name=name
    )

    db.add(vault)
    db.commit()
    db.refresh(vault)

    return {
        "id": vault.id,
        "name": vault.name
    }


@router.get(
    "/",
    response_model=VaultListResponse
)
def get_vaults(
    search: str | None = None,
    skip: int = 0,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = (
        db.query(Vault)
        .filter(
            Vault.user_id == current_user.id
        )
    )

    if search:
        query = query.filter(
            Vault.name.ilike(
                f"%{search}%"
            )
        )

    total = query.count()

    vaults = (
        query
        .offset(skip)
        .limit(limit)
        .all()
    )

    items = []

    for vault in vaults:

        credential_count = (
            db.query(Credential)
            .filter(
                Credential.vault_id == vault.id
            )
            .count()
        )

        items.append({
            "id": vault.id,
            "user_id": vault.user_id,
            "name": vault.name,
            "created_at": vault.created_at,
            "updated_at": vault.updated_at,
            "credential_count": credential_count
        })

    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.put("/{vault_id}")
def update_vault(
    vault_id: int,
    name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    vault = (
        db.query(Vault)
        .filter(
            Vault.id == vault_id,
            Vault.user_id == current_user.id
        )
        .first()
    )

    if not vault:
        raise HTTPException(
            status_code=404,
            detail="Vault not found"
        )

    if not name.strip():
        raise HTTPException(
            status_code=400,
            detail="Vault name cannot be empty"
        )

    vault.name = name.strip()

    db.commit()
    db.refresh(vault)

    return {
        "id": vault.id,
        "name": vault.name
    }


@router.delete("/{vault_id}")
def delete_vault(
    vault_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    vault = (
        db.query(Vault)
        .filter(
            Vault.id == vault_id,
            Vault.user_id == current_user.id
        )
        .first()
    )

    if not vault:
        raise HTTPException(
            status_code=404,
            detail="Vault not found"
        )

    credential_count = (
        db.query(Credential)
        .filter(
            Credential.vault_id == vault_id
        )
        .count()
    )

    if credential_count > 0:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot delete vault. "
                f"It contains {credential_count} credential(s). "
                f"Delete the credentials first."
            )
        )

    db.delete(vault)
    db.commit()

    return {
        "message": "Vault deleted successfully"
    }