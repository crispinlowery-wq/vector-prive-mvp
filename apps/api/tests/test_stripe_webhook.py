import hashlib
import hmac
import time

from app.config import settings
from app.main import valid_stripe_signature


def test_validates_stripe_signature_and_accepts_multiple_v1_values(monkeypatch):
    monkeypatch.setattr(settings, "stripe_webhook_secret", "whsec_test_secret")
    payload = b'{"type":"checkout.session.completed"}'
    timestamp = str(int(time.time()))
    expected = hmac.new(
        b"whsec_test_secret", f"{timestamp}.".encode() + payload, hashlib.sha256
    ).hexdigest()

    assert valid_stripe_signature(payload, f"t={timestamp},v1=not-valid,v1={expected}")
    assert not valid_stripe_signature(payload + b"x", f"t={timestamp},v1={expected}")
