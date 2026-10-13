"""
Sign-in for the API, backed by Supabase Auth.

With Supabase configured (SUPABASE_URL or VITE_SUPABASE_URL), every request must
carry the signed-in user's access token. Without it — the local desktop setup —
there is a single implicit admin user. That fallback refuses to run on Vercel, so
a missing environment variable can never leave the hosted app open.
"""
import hashlib
import json
import os
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, Header, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import models
from database import get_db

SUPABASE_URL = (os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or "").rstrip("/")
SUPABASE_KEY = (
    os.environ.get("SUPABASE_PUBLISHABLE_KEY")
    or os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
    or ""
)
AUTH_ENABLED = bool(SUPABASE_URL)
ON_VERCEL = bool(os.environ.get("VERCEL"))


@dataclass
class CurrentUser:
    id: Optional[str]
    email: str
    is_admin: bool


LOCAL_USER = CurrentUser(id=None, email="local", is_admin=True)

_jwks_client = None
_hs256_cache: dict = {}   # sha256(token) → (expires_at, claims)


def _jwks():
    global _jwks_client
    if _jwks_client is None:
        import jwt  # imported lazily so the local SQLite setup runs without PyJWT installed
        _jwks_client = jwt.PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json", timeout=10)
    return _jwks_client


def _claims_from_supabase(token: str) -> dict:
    """Projects still on the legacy shared JWT secret (HS256): ask Supabase Auth
    whether the token is valid, as Supabase recommends, and cache the answer briefly."""
    key = hashlib.sha256(token.encode()).hexdigest()
    hit = _hs256_cache.get(key)
    if hit and hit[0] > time.time():
        return hit[1]

    req = urllib.request.Request(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            user = json.load(resp)
    except urllib.error.HTTPError:
        raise HTTPException(status_code=401, detail="Your session has expired. Please sign in again.")
    except urllib.error.URLError:
        raise HTTPException(status_code=503, detail="Could not reach the sign-in service.")

    claims = {"sub": user["id"], "email": user.get("email") or ""}
    if len(_hs256_cache) > 1000:
        _hs256_cache.clear()
    _hs256_cache[key] = (time.time() + 60, claims)
    return claims


def _verify_token(token: str) -> dict:
    import jwt

    try:
        if jwt.get_unverified_header(token).get("alg") == "HS256":
            return _claims_from_supabase(token)
        signing_key = _jwks().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            leeway=30,
        )
    except jwt.PyJWKClientConnectionError:
        raise HTTPException(status_code=503, detail="Could not reach the sign-in service.")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Your session has expired. Please sign in again.")


def current_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> CurrentUser:
    if not AUTH_ENABLED:
        if ON_VERCEL:
            raise HTTPException(status_code=500, detail="Server misconfigured: Supabase sign-in is not set up.")
        return LOCAL_USER

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Please sign in.")
    claims = _verify_token(authorization[7:].strip())

    profile = db.get(models.Profile, claims["sub"])
    if profile is None:
        # Normally created by the auth.users trigger; covers users added before it existed
        profile = models.Profile(id=claims["sub"], email=claims.get("email") or "", is_admin=False)
        db.add(profile)
        try:
            db.commit()
        except IntegrityError:   # a concurrent request created it first
            db.rollback()
            profile = db.get(models.Profile, claims["sub"])

    return CurrentUser(id=profile.id, email=profile.email or claims.get("email") or "", is_admin=bool(profile.is_admin))


def require_admin(user: CurrentUser = Depends(current_user)) -> CurrentUser:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Only admins can change the machine and material library.")
    return user
