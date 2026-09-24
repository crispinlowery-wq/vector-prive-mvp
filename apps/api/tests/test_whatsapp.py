import hashlib
import hmac

from app.services.whatsapp import normalize_whatsapp_phone, parse_webhook, verify_webhook_signature


def test_signature_verification():
    body = b'{"object":"whatsapp_business_account"}'
    signature = "sha256=" + hmac.new(b"secret", body, hashlib.sha256).hexdigest()
    assert verify_webhook_signature(body, signature, "secret") is True
    assert verify_webhook_signature(body + b"x", signature, "secret") is False
    assert verify_webhook_signature(body, None, "secret") is False


def test_phone_normalization():
    assert normalize_whatsapp_phone("+44 7700 900 123") == "+447700900123"
    assert normalize_whatsapp_phone("123") is None


def test_parse_text_and_delivery_status():
    payload = {
        "object": "whatsapp_business_account",
        "entry": [{"changes": [{"value": {
            "messages": [{"id": "wamid.in", "from": "447700900123", "timestamp": "1", "type": "text", "text": {"body": "Please arrange Paris"}}],
            "statuses": [{"id": "wamid.out", "status": "delivered"}],
        }}]}],
    }
    messages, statuses = parse_webhook(payload)
    assert messages[0].message_id == "wamid.in"
    assert messages[0].body == "Please arrange Paris"
    assert statuses[0].status == "delivered"
