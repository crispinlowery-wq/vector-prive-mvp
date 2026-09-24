import json

from app.services.openai_research import _extract_output_text, build_research_context, redact_for_research


def test_research_context_removes_common_sensitive_identifiers():
    context = build_research_context(
        reference="VEC-2001",
        title="Trip for private client",
        message="Email me at private@example.com or +44 7700 900123. Passport number 123456789. Card 4242 4242 4242 4242.",
        category="travel",
        urgency="high",
        budget=12000,
        currency="GBP",
        preferences=["Quiet suite; contact pa@example.com", "Aisle seat"],
    )
    serialized = json.dumps(context)
    assert "private@example.com" not in serialized
    assert "pa@example.com" not in serialized
    assert "7700 900123" not in serialized
    assert "4242 4242 4242 4242" not in serialized
    assert "123456789" not in serialized
    assert "Quiet suite" in serialized
    assert context["budget"] == "GBP 12000.00"


def test_redaction_limits_payload_size():
    assert len(redact_for_research("x" * 5000, limit=200)) == 200


def test_extracts_structured_response_output_text():
    assert _extract_output_text({
        "output": [{"content": [{"type": "output_text", "text": '{"headline":"Ready"}'}]}],
    }) == '{"headline":"Ready"}'
