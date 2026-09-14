from datetime import datetime

from pydantic import BaseModel


class VaultResponse(BaseModel):

    id: int

    user_id: int

    name: str

    created_at: datetime

    updated_at: datetime

    credential_count: int


class VaultListResponse(BaseModel):

    items: list[VaultResponse]

    total: int

    skip: int

    limit: int