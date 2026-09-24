from app.services.triage import triage

def test_high_value_requires_approval(): assert triage("Family hotel in Kyoto","travel",18000).requires_approval
def test_private_aviation_requires_approval(): assert triage("Book helicopter from Nice","aviation",3200).requires_approval
def test_routine_transport_can_be_triaged():
    result=triage("Move tomorrow's driver and retain the child seat","transport",280)
    assert result.urgency=="urgent" and not result.requires_approval

def test_suggestion_references_recorded_preferences():
    result = triage("Find a hotel in Rome", "travel", 2400, ["hotel style: intimate boutique"])
    assert "intimate boutique" in result.draft
    assert any("Applied client preference" in reason for reason in result.reasons)
