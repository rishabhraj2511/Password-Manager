from pydantic import BaseModel


class CredentialCreate(BaseModel):
    vault_id: int
    title: str
    username: str | None = None
    encrypted_password: str | None = None
    website_url: str | None = None
    notes: str | None = None


class CredentialUpdate(BaseModel):
    title: str
    username: str | None = None
    encrypted_password: str | None = None
    website_url: str | None = None
    notes: str | None = None


class CredentialResponse(BaseModel):
    id: int
    vault_id: int
    title: str
    username: str | None
    website_url: str | None
    notes: str | None

    class Config:
        from_attributes = True


class CredentialListResponse(BaseModel):
    items: list[CredentialResponse]
    total: int
    skip: int
    limit: int