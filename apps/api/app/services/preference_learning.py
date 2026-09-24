from dataclasses import dataclass
import re


@dataclass(frozen=True)
class PreferenceSignal:
    category: str
    statement: str
    confidence: float


PATTERNS: tuple[tuple[str, str, str, float], ...] = (
    (r"\b(quiet|serene|peaceful|low[- ]interruption)\b", "travel_atmosphere", "Prefers quiet, serene environments", .88),
    (r"\b(boutique|intimate) hotel", "hotel_style", "Prefers intimate boutique hotels", .9),
    (r"\b(connecting|interconnecting) rooms?\b", "hotel_room", "Connecting rooms are important", .94),
    (r"\baisle seat", "flight_seat", "Prefers an aisle seat", .94),
    (r"\bwindow seat", "flight_seat", "Prefers a window seat", .94),
    (r"\bchild seat\b", "transport", "Requires a child seat for relevant transfers", .96),
    (r"\b(avoid|not|nothing) (very )?formal|\binformal luxury\b", "service_style", "Prefers warm, informal service over formality", .9),
    (r"\bone clear recommendation\b|\bnot the search\b", "service_style", "Prefers one clear recommendation", .91),
    (r"\b(shortlist|two or three options)\b", "service_style", "Prefers a concise shortlist", .84),
    (r"\bpescatarian\b", "dietary", "Pescatarian dining is required when relevant", .96),
    (r"\b(halal|kosher|vegan|vegetarian)\b", "dietary", "Recorded dietary requirement", .92),
    (r"\b(no|avoid|allerg(?:y|ic to)) shellfish\b", "dietary", "Avoid shellfish", .98),
    (r"\btoo noisy\b", "travel_atmosphere", "Avoid noisy environments", .94),
    (r"\btoo formal\b", "service_style", "Avoid overly formal service", .94),
)


def extract_preference_signals(text: str, *, explicit: bool = False) -> list[PreferenceSignal]:
    compact = " ".join(text.strip().split())
    lowered = compact.lower()
    signals: list[PreferenceSignal] = []
    seen: set[tuple[str, str]] = set()
    confidence_boost = .06 if explicit else 0
    for pattern, category, statement, confidence in PATTERNS:
        if re.search(pattern, lowered, re.IGNORECASE):
            key = (category, statement.lower())
            if key not in seen:
                seen.add(key)
                signals.append(PreferenceSignal(category, statement, min(1.0, confidence + confidence_boost)))

    for match in re.finditer(r"\b(?:i|we)\s+(?:prefer|like|love|always choose|do not like|don't like)\s+([^.!?\n]{3,160})", compact, re.IGNORECASE):
        phrase = match.group(0).strip()
        key = ("general", phrase.lower())
        if key not in seen:
            seen.add(key)
            signals.append(PreferenceSignal("general", phrase, .96 if explicit else .82))
    return signals[:12]


def context_label(category: str, statement: str) -> str:
    if category.startswith("onboarding:dietary") or category in {"dietary", "accessibility"}:
        return "recorded dietary or wellbeing requirements"
    if category.startswith("onboarding:"):
        category = category.removeprefix("onboarding:")
    label = category.replace("_", " ").strip()
    clean_statement = " ".join(statement.split())[:120]
    return f"{label}: {clean_statement}" if label else clean_statement


def relevant_context(category: str, preferences: list[tuple[str, str]]) -> list[str]:
    category = category.lower()
    relevant_prefixes = {
        "travel": ("travel", "hotel", "flight", "service", "dietary", "accessibility", "general"),
        "aviation": ("flight", "travel", "service", "accessibility", "general"),
        "dining": ("dietary", "service", "general", "interest"),
        "transport": ("transport", "travel", "accessibility", "general"),
    }.get(category, ("service", "general", "interest", "onboarding"))
    matches = [
        context_label(pref_category, statement)
        for pref_category, statement in preferences
        if pref_category.removeprefix("onboarding:").startswith(relevant_prefixes)
    ]
    return list(dict.fromkeys(matches))[:5]
