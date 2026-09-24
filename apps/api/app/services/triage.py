from dataclasses import dataclass

@dataclass
class TriageResult:
    category:str; urgency:str; confidence:float; draft:str; requires_approval:bool; reasons:list[str]

HIGH_RISK={"aviation","yacht","security","medical","legal","immigration"}
def triage(message:str, category:str="other", budget:float|None=None, preferences:list[str]|None=None)->TriageResult:
    text=message.lower(); inferred=category.lower()
    mapping={"restaurant":"dining","dinner":"dining","driver":"transport","transfer":"transport","hotel":"travel","flight":"travel","helicopter":"aviation"}
    if inferred=="other":
        inferred=next((v for k,v in mapping.items() if k in text),"lifestyle")
    urgent=any(w in text for w in ("urgent","today","tomorrow","changed","cancelled","now"))
    confidence=.72 if inferred in HIGH_RISK else .9
    approval=bool((budget or 0)>5000 or inferred in HIGH_RISK or confidence<.75)
    reasons=[f"Classified as {inferred}","Time-sensitive language detected" if urgent else "No urgent language detected"]
    preferences = [item for item in (preferences or []) if item.strip()][:5]
    if preferences:
        reasons.extend(f"Applied client preference: {item}" for item in preferences)
    if approval: reasons.append("Policy requires human approval")
    preference_note = f" I’m shaping this around {preferences[0]}." if preferences else ""
    draft = f"Thank you — I have this.{preference_note} I’ll return with a clear recommendation before anything is committed."
    return TriageResult(inferred,"urgent" if urgent else "normal",confidence,draft,approval,reasons)
