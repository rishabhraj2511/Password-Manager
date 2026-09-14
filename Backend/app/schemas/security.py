from pydantic import BaseModel


class PasswordCheckRequest(BaseModel):
    password: str


class PasswordCheckResponse(BaseModel):
    score: int
    strength: str
    length: int
    has_uppercase: bool
    has_lowercase: bool
    has_number: bool
    has_special: bool
class PasswordGenerateRequest(BaseModel):
    length: int = 16


class PasswordGenerateResponse(BaseModel):
    password: str