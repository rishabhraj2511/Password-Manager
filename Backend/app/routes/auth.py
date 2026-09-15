from datetime import datetime, timedelta, timezone

import os
import json
import re
import base64
import html
import urllib.parse
import urllib.request
import urllib.error

import pyotp

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.Models.user import User

from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    Login2FAVerifyRequest,
    SessionRefreshRequest,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest
)

from app.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    create_reset_token,
    hash_reset_token,
    reset_token_expiry
)

from app.dependencies import get_current_user

from app.services.email_service import (
    send_password_reset_email
)


# =========================================================
# DATABASE
# =========================================================

def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


# =========================================================
# PASSWORD VIEW PIN SCHEMAS
# =========================================================

class PasswordViewPinSetRequest(BaseModel):
    pin: str = Field(min_length=6, max_length=6)


class PasswordViewPinVerifyRequest(BaseModel):
    pin: str = Field(min_length=6, max_length=6)


class PasswordViewPinChangeRequest(BaseModel):
    current_pin: str = Field(min_length=6, max_length=6)
    new_pin: str = Field(min_length=6, max_length=6)


def validate_password_view_pin(pin: str) -> None:
    if not re.fullmatch(r"\d{6}", pin):
        raise HTTPException(
            status_code=400,
            detail="PIN must be exactly 6 digits."
        )


def get_authenticated_user(
    db: Session,
    current_user: User
) -> User:
    """
    Fetch the authenticated user using the endpoint's
    active database session.
    """
    user = db.query(User).filter(
        User.id == current_user.id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    return user


# =========================================================
# PASSWORD VIEW PIN STATUS
# =========================================================

@router.get("/password-view-pin/status")
def password_view_pin_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = get_authenticated_user(
        db,
        current_user
    )

    return {
        "pin_set": bool(
            user.password_view_pin_hash
        )
    }


# =========================================================
# SET PASSWORD VIEW PIN
# =========================================================

@router.post("/password-view-pin/set")
def set_password_view_pin(
    data: PasswordViewPinSetRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    validate_password_view_pin(data.pin)

    user = get_authenticated_user(
        db,
        current_user
    )

    if user.password_view_pin_hash:
        raise HTTPException(
            status_code=400,
            detail="Password view PIN is already set. Use change PIN instead."
        )

    user.password_view_pin_hash = hash_password(
        data.pin
    )

    db.commit()
    db.refresh(user)

    return {
        "message": "Password view PIN set successfully.",
        "pin_set": True
    }


# =========================================================
# VERIFY PASSWORD VIEW PIN
# =========================================================

@router.post("/password-view-pin/verify")
def verify_password_view_pin(
    data: PasswordViewPinVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    validate_password_view_pin(data.pin)

    user = get_authenticated_user(
        db,
        current_user
    )

    if not user.password_view_pin_hash:
        raise HTTPException(
            status_code=400,
            detail="Password view PIN is not set."
        )

    if not verify_password(
        data.pin,
        user.password_view_pin_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect password view PIN."
        )

    return {
        "verified": True,
        "message": "PIN verified successfully."
    }


# =========================================================
# CHANGE PASSWORD VIEW PIN
# =========================================================

@router.put("/password-view-pin/change")
def change_password_view_pin(
    data: PasswordViewPinChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    validate_password_view_pin(data.current_pin)
    validate_password_view_pin(data.new_pin)

    user = get_authenticated_user(
        db,
        current_user
    )

    if data.current_pin == data.new_pin:
        raise HTTPException(
            status_code=400,
            detail="New PIN must be different from current PIN."
        )

    if not user.password_view_pin_hash:
        raise HTTPException(
            status_code=400,
            detail="Password view PIN is not set."
        )

    if not verify_password(
        data.current_pin,
        user.password_view_pin_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect current password view PIN."
        )

    user.password_view_pin_hash = hash_password(
        data.new_pin
    )

    db.commit()
    db.refresh(user)

    return {
        "message": "Password view PIN changed successfully."
    }



# =========================================================
# GOOGLE OAUTH CONFIGURATION
# =========================================================

GOOGLE_CLIENT_ID = os.getenv(
    "GOOGLE_CLIENT_ID",
    "39063674742-fchrcdvkro4de4iqburbe3viuracq9qb.apps.googleusercontent.com"
)

GOOGLE_CLIENT_SECRET = os.getenv(
    "GOOGLE_CLIENT_SECRET"
)

GOOGLE_REDIRECT_URI = (
    "https://gnpnangocpkahjaamombopniiiejhieb.chromiumapp.org/oauth2"
)

GOOGLE_TOKEN_URL = (
    "https://oauth2.googleapis.com/token"
)

GOOGLE_PROFILE_URL = (
    "https://gmail.googleapis.com/gmail/v1/users/me/profile"
)

GMAIL_API_BASE_URL = (
    "https://gmail.googleapis.com/gmail/v1/users/me"
)


# =========================================================
# GOOGLE TOKEN REFRESH
# =========================================================

def refresh_google_access_token(user, db):
    if not user.google_refresh_token:
        raise HTTPException(
            status_code=401,
            detail=(
                "Google refresh token is missing. "
                "Please reconnect Google account."
            )
        )

    if not GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=500,
            detail=(
                "Google OAuth client secret is not configured."
            )
        )

    token_data = urllib.parse.urlencode({
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "refresh_token": user.google_refresh_token,
        "grant_type": "refresh_token"
    }).encode()

    token_request = urllib.request.Request(
        GOOGLE_TOKEN_URL,
        data=token_data,
        headers={
            "Content-Type": "application/x-www-form-urlencoded"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(
            token_request,
            timeout=15
        ) as response:
            token_response = json.loads(
                response.read().decode("utf-8")
            )

    except urllib.error.HTTPError as error:
        error_body = error.read().decode(
            "utf-8",
            errors="replace"
        )

        print(
            "Google access token refresh failed:",
            error.code,
            error_body
        )

        raise HTTPException(
            status_code=401,
            detail=(
                "Google session expired. "
                "Please reconnect Google account."
            )
        )

    except Exception as error:
        print(
            "Google access token refresh error:",
            error
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "Unable to refresh Google access token."
            )
        )

    new_access_token = token_response.get(
        "access_token"
    )

    expires_in = token_response.get(
        "expires_in"
    )

    if not new_access_token:
        raise HTTPException(
            status_code=401,
            detail=(
                "Google did not return a new access token. "
                "Please reconnect Google account."
            )
        )

    user.google_access_token = new_access_token

    if expires_in:
        user.google_token_expires_at = (
            datetime.now(timezone.utc)
            + timedelta(
                seconds=int(expires_in)
            )
        )

    db.commit()
    db.refresh(user)

    print(
        "Google access token refreshed successfully."
    )

    return new_access_token


# =========================================================
# GET VALID GOOGLE ACCESS TOKEN
# =========================================================

def get_valid_google_access_token(user, db):
    if not user.google_access_token:
        raise HTTPException(
            status_code=400,
            detail=(
                "Google account is not connected."
            )
        )

    expires_at = user.google_token_expires_at

    if expires_at:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(
                tzinfo=timezone.utc
            )

        now = datetime.now(timezone.utc)

        if expires_at <= (
            now + timedelta(minutes=2)
        ):
            return refresh_google_access_token(
                user,
                db
            )

    return user.google_access_token


# =========================================================
# GOOGLE CONNECT
# =========================================================

@router.post("/google/connect")
def connect_google_account(
    code: str,
    code_verifier: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not code or not isinstance(code, str):
        raise HTTPException(
            status_code=400,
            detail="Invalid Google authorization code."
        )

    if not code_verifier or not isinstance(
        code_verifier,
        str
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid PKCE verifier."
        )

    if not GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=500,
            detail=(
                "Google OAuth client secret is not configured."
            )
        )

    token_data = urllib.parse.urlencode({
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "code": code,
        "code_verifier": code_verifier,
        "grant_type": "authorization_code",
        "redirect_uri": GOOGLE_REDIRECT_URI
    }).encode()

    token_request = urllib.request.Request(
        GOOGLE_TOKEN_URL,
        data=token_data,
        headers={
            "Content-Type": "application/x-www-form-urlencoded"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(
            token_request,
            timeout=15
        ) as response:
            token_response = json.loads(
                response.read().decode("utf-8")
            )

    except urllib.error.HTTPError as error:
        error_body = error.read().decode(
            "utf-8",
            errors="replace"
        )

        print(
            "Google OAuth token exchange failed:",
            error.code,
            error_body
        )

        raise HTTPException(
            status_code=400,
            detail=(
                "Google token exchange failed. "
                "Check backend terminal logs."
            )
        )

    except Exception as error:
        print(
            "Google OAuth token exchange error:",
            error
        )

        raise HTTPException(
            status_code=400,
            detail=(
                "Unable to connect Google account."
            )
        )

    access_token = token_response.get(
        "access_token"
    )

    refresh_token = token_response.get(
        "refresh_token"
    )

    expires_in = token_response.get(
        "expires_in"
    )

    if not access_token:
        raise HTTPException(
            status_code=400,
            detail=(
                "Google did not return an access token."
            )
        )

    profile_request = urllib.request.Request(
        GOOGLE_PROFILE_URL,
        headers={
            "Authorization": f"Bearer {access_token}"
        },
        method="GET"
    )

    try:
        with urllib.request.urlopen(
            profile_request,
            timeout=15
        ) as response:
            profile_data = json.loads(
                response.read().decode("utf-8")
            )

    except urllib.error.HTTPError as error:
        error_body = error.read().decode(
            "utf-8",
            errors="replace"
        )

        print(
            "Google Gmail profile lookup failed:",
            error.code,
            error_body
        )

        raise HTTPException(
            status_code=400,
            detail=(
                "Unable to verify Google account."
            )
        )

    except Exception as error:
        print(
            "Google Gmail profile lookup error:",
            error
        )

        raise HTTPException(
            status_code=400,
            detail=(
                "Unable to verify Google account."
            )
        )

    google_email = profile_data.get(
        "emailAddress"
    )

    if not google_email:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unable to determine Google account email."
            )
        )

    user = db.query(User).filter(
        User.id == current_user.id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    user.google_access_token = access_token

    if refresh_token:
        user.google_refresh_token = refresh_token

    if expires_in:
        user.google_token_expires_at = (
            datetime.now(timezone.utc)
            + timedelta(
                seconds=int(expires_in)
            )
        )

    user.google_account_email = google_email

    db.commit()

    return {
        "message": (
            "Google account connected successfully."
        ),
        "google_account_email": google_email
    }


# =========================================================
# GOOGLE DISCONNECT
# =========================================================

@router.post("/google/disconnect")
def disconnect_google_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = db.query(User).filter(
        User.id == current_user.id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    user.google_access_token = None
    user.google_refresh_token = None
    user.google_token_expires_at = None
    user.google_account_email = None

    db.commit()

    return {
        "message": (
            "Google account disconnected successfully."
        )
    }


# =========================================================
# GOOGLE STATUS
# =========================================================

@router.get("/google/status")
def google_connection_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = db.query(User).filter(
        User.id == current_user.id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    return {
        "connected": bool(
            user.google_refresh_token
            or user.google_access_token
        ),
        "google_account_email": (
            user.google_account_email
        )
    }


# =========================================================
# GMAIL API REQUEST
# =========================================================

def gmail_api_request(endpoint, access_token):
    request = urllib.request.Request(
        f"{GMAIL_API_BASE_URL}/{endpoint}",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json"
        },
        method="GET"
    )

    with urllib.request.urlopen(
        request,
        timeout=20
    ) as response:
        return json.loads(
            response.read().decode("utf-8")
        )


# =========================================================
# BASE64 GMAIL DECODER
# =========================================================

def decode_gmail_body(data):
    if not data:
        return ""

    try:
        padding = "=" * (
            (-len(data)) % 4
        )

        decoded = base64.urlsafe_b64decode(
            data + padding
        )

        return decoded.decode(
            "utf-8",
            errors="ignore"
        )

    except Exception as error:
        print(
            "Gmail body decoding error:",
            error
        )

        return ""


# =========================================================
# HTML TO PLAIN TEXT
# =========================================================

def html_to_text(value):
    if not value:
        return ""

    text = html.unescape(value)

    text = re.sub(
        r"(?is)<script.*?>.*?</script>",
        " ",
        text
    )

    text = re.sub(
        r"(?is)<style.*?>.*?</style>",
        " ",
        text
    )

    text = re.sub(
        r"(?is)<!--.*?-->",
        " ",
        text
    )

    text = re.sub(
        r"(?i)<br\s*/?>",
        "\n",
        text
    )

    text = re.sub(
        r"(?i)</p\s*>",
        "\n",
        text
    )

    text = re.sub(
        r"(?i)</div\s*>",
        "\n",
        text
    )

    text = re.sub(
        r"<[^>]+>",
        " ",
        text
    )

    text = re.sub(
        r"[ \t]+",
        " ",
        text
    )

    text = re.sub(
        r"\n\s*\n+",
        "\n",
        text
    )

    return text.strip()


# =========================================================
# EXTRACT GMAIL MESSAGE TEXT
# =========================================================

def extract_gmail_message_text(payload):
    text_parts = []

    def walk_parts(part):
        if not part:
            return

        mime_type = (
            part.get("mimeType") or ""
        ).lower()

        body = part.get(
            "body",
            {}
        )

        encoded_data = body.get(
            "data"
        )

        if encoded_data:
            decoded_text = decode_gmail_body(
                encoded_data
            )

            if decoded_text:
                text_parts.append(
                    decoded_text
                )

                if "html" in mime_type:
                    text_parts.append(
                        html_to_text(
                            decoded_text
                        )
                    )

        for child in part.get(
            "parts",
            []
        ):
            walk_parts(child)

    walk_parts(payload)

    return "\n".join(text_parts)


# =========================================================
# NORMALIZE EMAIL TEXT
# =========================================================

def normalize_email_text(text):
    if not text:
        return ""

    text = html_to_text(text)

    text = text.replace(
        "\u200b",
        ""
    )

    text = text.replace(
        "\ufeff",
        ""
    )

    text = re.sub(
        r"\s+",
        " ",
        text
    )

    return text.strip()


# =========================================================
# EXTRACT OTP FROM EMAIL
# =========================================================

def extract_otp_from_text(text):
    """
    Extract the actual OTP.

    Priority:
    1. OTP-related keyword followed by a number.
    2. OTP-related keyword before a number.
    3. Standalone six-digit number only if it is not
       a repeated/dummy number.
    """

    if not text:
        return None

    text = normalize_email_text(text)

    if not text:
        return None

    # Remove common dummy/repeated values.
    invalid_otps = {
        "000000",
        "111111",
        "222222",
        "333333",
        "444444",
        "555555",
        "666666",
        "777777",
        "888888",
        "999999"
    }

    def valid_otp(value):
        if not value:
            return None

        value = str(value).strip()

        if not value.isdigit():
            return None

        if len(value) != 6:
            return None

        if value in invalid_otps:
            return None

        return value

    # Pattern 1:
    # OTP: 104737
    # OTP is 104737
    # Your OTP 104737
    # verification code: 104737
    keyword_patterns = [
        r"\b(?:otp|o\.t\.p\.|one[-\s]?time password)"
        r"\b[\s:=\-#]*(\d{6})\b",

        r"\b(?:verification code|verify code|verification otp)"
        r"\b[\s:=\-#]*(\d{6})\b",

        r"\b(?:security code|authentication code)"
        r"\b[\s:=\-#]*(\d{6})\b",

        r"\b(?:login code|sign[-\s]?in code)"
        r"\b[\s:=\-#]*(\d{6})\b",

        r"\b(?:use|enter|type|input)"
        r"\s+(?:the\s+)?(?:otp|code)"
        r"\s*(?:is|:)?\s*(\d{6})\b"
    ]

    for pattern in keyword_patterns:
        matches = re.findall(
            pattern,
            text,
            flags=re.IGNORECASE
        )

        for match in matches:
            otp = valid_otp(match)

            if otp:
                return otp

    # Pattern 2:
    # 104737 is your OTP
    # 104737 is your verification code
    reverse_patterns = [
        r"\b(\d{6})\b"
        r"\s+(?:is|was)\s+your\s+"
        r"(?:otp|code|verification code)\b",

        r"\b(\d{6})\b"
        r"\s+(?:is|was)\s+the\s+"
        r"(?:otp|code|verification code)\b"
    ]

    for pattern in reverse_patterns:
        matches = re.findall(
            pattern,
            text,
            flags=re.IGNORECASE
        )

        for match in matches:
            otp = valid_otp(match)

            if otp:
                return otp

    # Pattern 3:
    # Find all six-digit numbers.
    # Do not blindly use the first number.
    all_numbers = re.findall(
        r"(?<!\d)(\d{6})(?!\d)",
        text
    )

    valid_numbers = []

    for number in all_numbers:
        otp = valid_otp(number)

        if otp and otp not in valid_numbers:
            valid_numbers.append(otp)

    # If exactly one valid six-digit number exists,
    # it is safe to use it.
    if len(valid_numbers) == 1:
        return valid_numbers[0]

    # If multiple numbers exist but one appears near
    # OTP-related words, choose that one.
    for number in valid_numbers:
        number_position = text.find(number)

        if number_position == -1:
            continue

        nearby_text = text[
            max(0, number_position - 100):
            number_position + 100
        ].lower()

        if any(keyword in nearby_text for keyword in [
            "otp",
            "one-time",
            "verification",
            "verify",
            "security code",
            "authentication",
            "login code",
            "sign-in code"
        ]):
            return number

    return None


# =========================================================
# GET GMAIL HEADER
# =========================================================

def get_gmail_header(headers, header_name):
    for header in headers:
        if (
            header.get("name", "").lower()
            == header_name.lower()
        ):
            return header.get(
                "value",
                ""
            )

    return ""


# =========================================================
# GET GMAIL INTERNAL DATE
# =========================================================

def get_message_timestamp(message_data):
    internal_date = message_data.get(
        "internalDate"
    )

    try:
        return int(
            internal_date
        )
    except (
        TypeError,
        ValueError
    ):
        return 0


# =========================================================
# FIND OTP IN ONE GMAIL MESSAGE
# =========================================================

def extract_otp_from_gmail_message(message_data):
    payload = message_data.get(
        "payload",
        {}
    )

    headers = payload.get(
        "headers",
        []
    )

    subject = get_gmail_header(
        headers,
        "Subject"
    )

    sender = get_gmail_header(
        headers,
        "From"
    )

    body_text = extract_gmail_message_text(
        payload
    )

    complete_text = (
        f"{subject}\n"
        f"{sender}\n"
        f"{body_text}"
    )

    otp = extract_otp_from_text(
        complete_text
    )

    return {
        "otp": otp,
        "subject": subject,
        "sender": sender,
        "body": body_text
    }


# =========================================================
# LATEST GMAIL OTP
# =========================================================

@router.get("/google/latest-otp")
def get_latest_gmail_otp(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = db.query(User).filter(
        User.id == current_user.id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    access_token = get_valid_google_access_token(
        user,
        db
    )

    print(
        "VaultX: Gmail OTP request started."
    )

    search_queries = [
        "newer_than:1d (OTP OR verification OR code)",
        "newer_than:1d (one-time OR security OR authentication)",
        "newer_than:1d (login OR sign-in OR verify)"
    ]

    all_message_ids = set()

    try:
        for raw_query in search_queries:
            encoded_query = urllib.parse.quote(
                raw_query
            )

            messages_data = gmail_api_request(
                (
                    "messages?"
                    f"q={encoded_query}"
                    "&maxResults=50"
                ),
                access_token
            )

            for message in messages_data.get(
                "messages",
                []
            ):
                message_id = message.get(
                    "id"
                )

                if message_id:
                    all_message_ids.add(
                        message_id
                    )

        if not all_message_ids:
            print(
                "VaultX: No recent Gmail messages found."
            )

            return {
                "success": True,
                "otp": None,
                "message": (
                    "No recent OTP email found."
                )
            }

        print(
            "VaultX: Gmail messages found:",
            len(all_message_ids)
        )

        complete_messages = []

        for message_id in all_message_ids:
            message_data = gmail_api_request(
                (
                    f"messages/{message_id}"
                    "?format=full"
                ),
                access_token
            )

            extracted = extract_otp_from_gmail_message(
                message_data
            )

            complete_messages.append({
                "timestamp": get_message_timestamp(
                    message_data
                ),
                "message_id": message_id,
                "message_data": message_data,
                "extracted": extracted
            })

        # Sort newest email first using Gmail internalDate.
        complete_messages.sort(
            key=lambda item: item["timestamp"],
            reverse=True
        )

        for item in complete_messages:
            extracted = item["extracted"]

            subject = extracted["subject"]
            sender = extracted["sender"]
            otp = extracted["otp"]

            print(
                "VaultX checking email:",
                subject,
                "| Sender:",
                sender,
                "| OTP:",
                otp
            )

            if otp:
                print(
                    "VaultX: Latest valid OTP detected:",
                    otp
                )

                return {
                    "success": True,
                    "otp": otp,
                    "message": (
                        "Latest OTP found."
                    )
                }

        print(
            "VaultX: No valid OTP found in recent emails."
        )

        return {
            "success": True,
            "otp": None,
            "message": (
                "No valid OTP found in recent emails."
            )
        }

    except urllib.error.HTTPError as error:
        error_body = error.read().decode(
            "utf-8",
            errors="replace"
        )

        print(
            "Gmail API HTTP error:",
            error.code,
            error_body
        )

        if error.code == 401:
            print(
                "VaultX: Access token expired. "
                "Trying refresh."
            )

            new_access_token = (
                refresh_google_access_token(
                    user,
                    db
                )
            )

            try:
                encoded_query = urllib.parse.quote(
                    "newer_than:1d (OTP OR verification OR code)"
                )

                messages_data = gmail_api_request(
                    (
                        "messages?"
                        f"q={encoded_query}"
                        "&maxResults=50"
                    ),
                    new_access_token
                )

                messages = messages_data.get(
                    "messages",
                    []
                )

                complete_messages = []

                for message in messages:
                    message_id = message.get(
                        "id"
                    )

                    if not message_id:
                        continue

                    message_data = gmail_api_request(
                        (
                            f"messages/{message_id}"
                            "?format=full"
                        ),
                        new_access_token
                    )

                    extracted = (
                        extract_otp_from_gmail_message(
                            message_data
                        )
                    )

                    complete_messages.append({
                        "timestamp": (
                            get_message_timestamp(
                                message_data
                            )
                        ),
                        "extracted": extracted
                    })

                complete_messages.sort(
                    key=lambda item: item["timestamp"],
                    reverse=True
                )

                for item in complete_messages:
                    otp = item["extracted"]["otp"]

                    if otp:
                        print(
                            "VaultX: OTP found after refresh:",
                            otp
                        )

                        return {
                            "success": True,
                            "otp": otp,
                            "message": (
                                "Latest OTP found."
                            )
                        }

                return {
                    "success": True,
                    "otp": None,
                    "message": (
                        "No valid OTP found in recent emails."
                    )
                }

            except Exception as retry_error:
                print(
                    "Gmail retry after token refresh failed:",
                    retry_error
                )

                raise HTTPException(
                    status_code=401,
                    detail=(
                        "Google authentication expired. "
                        "Please reconnect Google account."
                    )
                )

        raise HTTPException(
            status_code=502,
            detail=(
                "Unable to read Gmail messages. "
                "Check backend terminal logs."
            )
        )

    except HTTPException:
        raise

    except Exception as error:
        print(
            "Gmail OTP detection error:",
            error
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to detect OTP from Gmail."
            )
        )


# =========================================================
# REGISTER
# =========================================================

@router.post("/register")
def register(
    data: RegisterRequest,
    db: Session = Depends(get_db)
):
    existing_user = db.query(User).filter(
        User.email == data.email
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    user = User(
        email=data.email,
        password_hash=hash_password(
            data.password
        )
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "message": (
            "User registered successfully"
        ),
        "user_id": user.id
    }


# =========================================================
# LOGIN
# =========================================================

@router.post(
    "/login",
    response_model=TokenResponse
)
def login(
    data: LoginRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.email == data.email
    ).first()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not verify_password(
        data.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="User account is inactive"
        )

    if user.two_factor_enabled:
        return {
            "access_token": None,
            "token_type": "bearer",
            "refresh_token": None,
            "requires_2fa": True,
            "requires_session_2fa": False
        }

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "refresh_token": refresh_token,
        "requires_2fa": False,
        "requires_session_2fa": False
    }


# =========================================================
# LOGIN 2FA VERIFICATION
# =========================================================

@router.post(
    "/2fa/login-verify",
    response_model=TokenResponse
)
def verify_login_2fa(
    data: Login2FAVerifyRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.email == data.email
    ).first()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not verify_password(
        data.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="User account is inactive"
        )

    if not user.two_factor_enabled:
        raise HTTPException(
            status_code=400,
            detail=(
                "Two-factor authentication "
                "is not enabled."
            )
        )

    if not user.two_factor_secret:
        raise HTTPException(
            status_code=400,
            detail=(
                "2FA secret is not configured."
            )
        )

    if not data.otp.isdigit() or len(data.otp) != 6:
        raise HTTPException(
            status_code=400,
            detail="OTP must contain exactly 6 digits."
        )

    if not pyotp.TOTP(
        user.two_factor_secret
    ).verify(data.otp):
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired OTP."
        )

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "refresh_token": refresh_token,
        "requires_2fa": False,
        "requires_session_2fa": False
    }


# =========================================================
# REFRESH ACCESS TOKEN
# =========================================================

@router.post(
    "/session/refresh",
    response_model=TokenResponse
)
def refresh_session(
    data: SessionRefreshRequest,
    db: Session = Depends(get_db)
):
    user_id = decode_refresh_token(
        data.refresh_token
    )

    if not user_id:
        raise HTTPException(
            status_code=401,
            detail=(
                "Refresh token is invalid or expired. "
                "Please login again."
            )
        )

    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=401,
            detail="Invalid refresh token."
        )

    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="User account is inactive."
        )

    if user.two_factor_enabled:
        if not data.otp:
            return {
                "access_token": None,
                "token_type": "bearer",
                "refresh_token": data.refresh_token,
                "requires_2fa": False,
                "requires_session_2fa": True
            }

        if (
            not data.otp.isdigit()
            or len(data.otp) != 6
        ):
            raise HTTPException(
                status_code=400,
                detail="OTP must contain exactly 6 digits."
            )

        if not user.two_factor_secret:
            raise HTTPException(
                status_code=400,
                detail=(
                    "2FA secret is not configured."
                )
            )

        if not pyotp.TOTP(
            user.two_factor_secret
        ).verify(
            data.otp,
            valid_window=1
        ):
            raise HTTPException(
                status_code=400,
                detail="Invalid or expired OTP."
            )

    access_token = create_access_token(user.id)
    new_refresh_token = create_refresh_token(user.id)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "refresh_token": new_refresh_token,
        "requires_2fa": False,
        "requires_session_2fa": False
    }


# =========================================================
# CURRENT USER
# =========================================================

@router.get("/me")
def get_me(
    current_user: User = Depends(get_current_user)
):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "is_active": current_user.is_active
    }


# =========================================================
# 2FA SETUP
# =========================================================

@router.post("/2fa/setup")
def setup_two_factor(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = db.query(User).filter(
        User.id == current_user.id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    if user.two_factor_enabled:
        raise HTTPException(
            status_code=400,
            detail=(
                "Two-factor authentication "
                "is already enabled."
            )
        )

    secret = pyotp.random_base32()

    user.two_factor_secret = secret

    db.commit()

    otp_uri = pyotp.TOTP(
        secret
    ).provisioning_uri(
        name=user.email,
        issuer_name="VaultX"
    )

    return {
        "message": (
            "2FA setup initialized successfully."
        ),
        "secret": secret,
        "otpauth_url": otp_uri
    }


# =========================================================
# 2FA VERIFY
# =========================================================

@router.post("/2fa/verify")
def verify_two_factor(
    otp: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = db.query(User).filter(
        User.id == current_user.id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    if not user.two_factor_secret:
        raise HTTPException(
            status_code=400,
            detail="Please setup 2FA first."
        )

    if not pyotp.TOTP(
        user.two_factor_secret
    ).verify(otp):
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired OTP."
        )

    user.two_factor_enabled = True

    db.commit()

    return {
        "message": (
            "Two-factor authentication "
            "verified and enabled successfully."
        ),
        "two_factor_enabled": True
    }


# =========================================================
# 2FA TOGGLE
# =========================================================

@router.post("/2fa/toggle")
def toggle_two_factor(
    enabled: bool,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = db.query(User).filter(
        User.id == current_user.id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    if enabled:
        raise HTTPException(
            status_code=400,
            detail=(
                "Use the 2FA setup and verification "
                "flow to enable 2FA."
            )
        )

    user.two_factor_enabled = False
    user.two_factor_secret = None

    db.commit()

    return {
        "message": (
            "Two-factor authentication "
            "disabled successfully."
        ),
        "two_factor_enabled": False
    }


# =========================================================
# CHANGE PASSWORD
# =========================================================

@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = db.query(User).filter(
        User.id == current_user.id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    if not verify_password(
        data.current_password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=400,
            detail="Current password is incorrect"
        )

    if (
        data.current_password ==
        data.new_password
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "New password must be different "
                "from current password"
            )
        )

    if len(data.new_password) < 8:
        raise HTTPException(
            status_code=400,
            detail=(
                "New password must be at least "
                "8 characters long"
            )
        )

    user.password_hash = hash_password(
        data.new_password
    )

    db.commit()

    return {
        "message": (
            "Password changed successfully!"
        )
    }


# =========================================================
# FORGOT PASSWORD
# =========================================================

@router.post("/forgot-password")
def forgot_password(
    data: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.email == data.email
    ).first()

    if not user:
        return {
            "message": (
                "If an account exists with this email, "
                "a password reset link has been sent."
            )
        }

    reset_token = create_reset_token()

    user.reset_token_hash = hash_reset_token(
        reset_token
    )

    user.reset_token_expires_at = (
        reset_token_expiry()
    )

    db.commit()

    frontend_url = os.getenv(
        "FRONTEND_URL",
        "http://localhost:5173"
    )

    reset_link = (
        f"{frontend_url}/reset-password"
        f"?token={reset_token}"
    )

    try:
        send_password_reset_email(
            user.email,
            reset_link
        )

    except Exception as error:
        user.reset_token_hash = None
        user.reset_token_expires_at = None

        db.commit()

        print(
            "Password reset email error:",
            error
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to send password reset email."
            )
        )

    return {
        "message": (
            "If an account exists with this email, "
            "a password reset link has been sent."
        )
    }


# =========================================================
# RESET PASSWORD
# =========================================================

@router.post("/reset-password")
def reset_password(
    data: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    token_hash = hash_reset_token(
        data.token
    )

    user = db.query(User).filter(
        User.reset_token_hash == token_hash
    ).first()

    if not user:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token"
        )

    if not user.reset_token_expires_at:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token"
        )

    expiry_time = (
        user.reset_token_expires_at
    )

    if expiry_time.tzinfo is None:
        expiry_time = expiry_time.replace(
            tzinfo=timezone.utc
        )

    if expiry_time < datetime.now(timezone.utc):
        user.reset_token_hash = None
        user.reset_token_expires_at = None

        db.commit()

        raise HTTPException(
            status_code=400,
            detail="Reset token has expired"
        )

    if len(data.new_password) < 8:
        raise HTTPException(
            status_code=400,
            detail=(
                "New password must be at least "
                "8 characters long"
            )
        )

    user.password_hash = hash_password(
        data.new_password
    )

    user.reset_token_hash = None
    user.reset_token_expires_at = None

    db.commit()

    return {
        "message": (
            "Password reset successfully!"
        )
    }