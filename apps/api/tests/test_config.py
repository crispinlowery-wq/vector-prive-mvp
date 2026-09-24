import pytest

from app.config import Settings


def test_production_requires_managed_identity_and_disables_local_passwords():
    with pytest.raises(RuntimeError, match="ALLOW_LOCAL_PASSWORD_AUTH"):
        Settings(environment="production", allow_local_password_auth=True).validate_runtime()

    with pytest.raises(RuntimeError, match="OIDC_ISSUER"):
        Settings(environment="production", allow_local_password_auth=False).validate_runtime()


def test_nuitee_mode_requires_an_api_key():
    with pytest.raises(RuntimeError, match="NUITEE_API_KEY"):
        Settings(partner_provider="nuitee", nuitee_api_key="").validate_runtime()


def test_whatsapp_enabled_requires_complete_credentials():
    with pytest.raises(RuntimeError, match="WhatsApp is enabled"):
        Settings(whatsapp_enabled=True, whatsapp_token="token").validate_runtime()

    Settings(
        whatsapp_enabled=True,
        whatsapp_token="token",
        whatsapp_app_secret="secret",
        whatsapp_verify_token="verify",
        whatsapp_phone_number_id="123",
    ).validate_runtime()
