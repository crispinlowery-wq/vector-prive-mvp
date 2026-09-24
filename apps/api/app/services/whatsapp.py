from __future__ import annotations

import hashlib
import hmac
from dataclasses import dataclass
from typing import Any

import httpx

from app.config import settings


class WhatsAppError(RuntimeError):
    pass


@dataclass(frozen=True)
class IncomingWhatsAppMessage:
    message_id: str
    sender: str
    message_type: str
    body: str | None
    timestamp: str | None


@dataclass(frozen=True)
class WhatsAppStatus:
    message_id: str
    status: str


def normalize_whatsapp_phone(value: str | None) -> str | None:
    digits = "".join(character for character in (value or "") if character.isdigit())
    if not 8 <= len(digits) <= 15:
        return None
    return f"+{digits}"


def verify_webhook_signature(raw_body: bytes, signature_header: str | None, app_secret: str) -> bool:
    if not signature_header or not app_secret or not signature_header.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(app_secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)


def parse_webhook(payload: dict[str, Any]) -> tuple[list[IncomingWhatsAppMessage], list[WhatsAppStatus]]:
    messages: list[IncomingWhatsAppMessage] = []
    statuses: list[WhatsAppStatus] = []
    if payload.get("object") != "whatsapp_business_account":
        return messages, statuses
    for entry in payload.get("entry") or []:
        for change in entry.get("changes") or []:
            value = change.get("value") or {}
            for message in value.get("messages") or []:
                message_type = str(message.get("type") or "unknown")
                body = None
                if message_type == "text":
                    body = (message.get("text") or {}).get("body")
                messages.append(IncomingWhatsAppMessage(
                    message_id=str(message.get("id") or ""),
                    sender=str(message.get("from") or ""),
                    message_type=message_type,
                    body=str(body)[:10000] if body is not None else None,
                    timestamp=str(message.get("timestamp")) if message.get("timestamp") is not None else None,
                ))
            for status in value.get("statuses") or []:
                statuses.append(WhatsAppStatus(
                    message_id=str(status.get("id") or ""),
                    status=str(status.get("status") or "unknown")[:32],
                ))
    return [message for message in messages if message.message_id], [status for status in statuses if status.message_id]


class WhatsAppCloudAdapter:
    async def send_text(self, to: str, body: str) -> tuple[str, str]:
        if not settings.whatsapp_enabled:
            raise WhatsAppError("WhatsApp is not enabled")
        recipient = normalize_whatsapp_phone(to)
        if not recipient:
            raise WhatsAppError("The client does not have a valid WhatsApp telephone number")
        url = f"https://graph.facebook.com/{settings.whatsapp_graph_version}/{settings.whatsapp_phone_number_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": recipient.removeprefix("+"),
            "type": "text",
            "text": {"preview_url": False, "body": body},
        }
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.post(url, headers={
                    "Authorization": f"Bearer {settings.whatsapp_token}",
                    "Content-Type": "application/json",
                }, json=payload)
            response.raise_for_status()
            data = response.json()
            message = (data.get("messages") or [{}])[0]
            message_id = str(message.get("id") or "")
            if not message_id:
                raise WhatsAppError("WhatsApp accepted the request without returning a message ID")
            return message_id, str(message.get("message_status") or "accepted")
        except httpx.HTTPStatusError as exc:
            raise WhatsAppError(f"WhatsApp rejected the message ({exc.response.status_code})") from exc
        except (httpx.HTTPError, ValueError) as exc:
            raise WhatsAppError("WhatsApp is temporarily unavailable or returned an invalid response") from exc
