from app.services.preference_learning import extract_preference_signals, relevant_context


def test_explicit_trip_feedback_becomes_confirmed_candidate() -> None:
    signals = extract_preference_signals("We loved the boutique hotel, but it was too noisy.", explicit=True)
    statements = {signal.statement for signal in signals}

    assert "Prefers intimate boutique hotels" in statements
    assert "Avoid noisy environments" in statements
    assert all(signal.confidence >= .9 for signal in signals)


def test_questionnaire_preferences_are_relevant_to_travel() -> None:
    context = relevant_context("travel", [
        ("onboarding:hotel_style", "Intimate boutique"),
        ("onboarding:dietary_requirements", "No shellfish"),
    ])

    assert "hotel style: Intimate boutique" in context
    assert "recorded dietary or wellbeing requirements" in context
