from datetime import datetime, timezone
from typing import Iterable

import jwt
import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import settings
from app.models import Client, Delegation, UserAccount, UserRole, UserSession
from app.services.auth import hash_token


bearer = HTTPBearer(auto_error=False)


def oidc_claims(token: str) -> dict | None:
    if not (settings.oidc_issuer and settings.oidc_audience and settings.oidc_jwks_url):
        return None
    try:
        signing_key = jwt.PyJWKClient(settings.oidc_jwks_url, cache_keys=True).get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token, signing_key.key, algorithms=["RS256", "ES256"],
            audience=settings.oidc_audience, issuer=settings.oidc_issuer,
            options={"require": ["exp", "iat", "sub"]},
        )
        return claims
    except jwt.PyJWTError:
        return None


async def oidc_userinfo(token: str, expected_subject: str) -> dict | None:
    if not settings.oidc_issuer:
        return None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{settings.oidc_issuer.rstrip('/')}/userinfo",
                headers={"Authorization": f"Bearer {token}"},
            )
        if response.status_code != 200:
            return None
        profile = response.json()
        return profile if str(profile.get("sub")) == expected_subject else None
    except (httpx.HTTPError, ValueError):
        return None


async def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> UserAccount:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(401, "Authentication required", headers={"WWW-Authenticate": "Bearer"})
    now = datetime.now(timezone.utc)
    session = await db.scalar(
        select(UserSession).where(
            UserSession.token_hash == hash_token(credentials.credentials),
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > now,
        )
    )
    if session:
        user = await db.get(UserAccount, session.user_id)
    else:
        claims = oidc_claims(credentials.credentials)
        subject = str(claims["sub"]) if claims else None
        if claims and subject and not claims.get("email"):
            profile = await oidc_userinfo(credentials.credentials, subject)
            if profile:
                claims = {**claims, **profile}
        claim_email = str(claims.get("email", "")).lower().strip() if claims else ""
        configured_admin_email = settings.initial_admin_email.lower().strip()
        matches_admin_subject = bool(
            settings.initial_admin_subject and subject == settings.initial_admin_subject
        )
        matches_verified_admin_email = bool(
            claims
            and claims.get("email_verified") is True
            and configured_admin_email
            and claim_email == configured_admin_email
        )
        user = await db.scalar(select(UserAccount).where(UserAccount.external_subject == subject)) if subject else None
        if (
            not user and subject and configured_admin_email
            and (matches_admin_subject or matches_verified_admin_email)
        ):
            user = UserAccount(
                external_subject=subject,
                email=configured_admin_email,
                full_name=settings.initial_admin_name,
                role=UserRole.admin,
                is_active=True,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
        elif (
            not user and subject and claims
            and claims.get("email_verified") is True and claim_email
        ):
            full_name = str(claims.get("name") or claim_email.split("@", 1)[0]).strip()[:160]
            client = await db.scalar(select(Client).where(Client.email == claim_email))
            if not client:
                raise HTTPException(403, "Membership approval is required before creating private access")
            user = UserAccount(
                external_subject=subject,
                client_id=client.id,
                email=claim_email,
                full_name=full_name,
                role=UserRole.client,
                is_active=True,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
    if not user or not user.is_active:
        raise HTTPException(401, "Session is invalid, expired, or not provisioned", headers={"WWW-Authenticate": "Bearer"})
    if user.client_id:
        client = await db.get(Client, user.client_id)
        membership_status = (client.profile_data or {}).get("membership_status") if client else None
        if membership_status in {"payment_pending", "past_due", "suspended", "cancelled"}:
            raise HTTPException(403, "Membership payment or approval is required before private access is enabled")
    return user


def require_roles(*roles: UserRole):
    allowed = set(roles)

    async def dependency(user: UserAccount = Depends(current_user)) -> UserAccount:
        if user.role not in allowed:
            raise HTTPException(403, "You are not authorised for this action")
        return user

    return dependency


async def accessible_client_ids(user: UserAccount, db: AsyncSession, scope: str) -> set:
    if user.role in {UserRole.operator, UserRole.admin}:
        return set()
    ids = {user.client_id} if user.client_id else set()
    if user.role == UserRole.pa:
        now = datetime.now(timezone.utc)
        delegations: Iterable[Delegation] = (
            await db.scalars(
                select(Delegation).where(
                    Delegation.delegate_user_id == user.id,
                    Delegation.revoked_at.is_(None),
                )
            )
        ).all()
        for delegation in delegations:
            if delegation.starts_at and delegation.starts_at > now:
                continue
            if delegation.expires_at and delegation.expires_at <= now:
                continue
            if scope in delegation.scopes or "*" in delegation.scopes:
                ids.add(delegation.principal_client_id)
    return ids


async def assert_client_access(user: UserAccount, client_id, db: AsyncSession, scope: str) -> None:
    if user.role in {UserRole.operator, UserRole.admin}:
        return
    if client_id not in await accessible_client_ids(user, db, scope):
        raise HTTPException(403, "You are not authorised for this client")
